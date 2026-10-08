/* ------------------------------------------------------------------
   Procedural texture factory.  Everything (cloth weave, wood grain,
   leather pockets, ball shells) is generated on <canvas> at runtime so
   the build stays a single self-contained file (APK friendly).
-------------------------------------------------------------------*/
import { BALL_COLORS, FRAME, H, JAWS, POCKETS, RAILS, Skin, W, isStripe } from "./constants";

export function cnv(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/* deterministic pseudo random so textures look identical every load */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function noiseTile(size: number, alpha: number, seed: number, mono = true) {
  const c = cnv(size, size);
  const g = c.getContext("2d")!;
  const img = g.createImageData(size, size);
  const r = rng(seed);
  for (let i = 0; i < size * size; i++) {
    const v = mono ? 128 + (r() - 0.5) * 255 : 0;
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = mono ? v : r() * 255;
    img.data[i * 4 + 2] = mono ? v : r() * 255;
    img.data[i * 4 + 3] = alpha * 255 * (0.4 + r() * 0.6);
  }
  g.putImageData(img, 0, 0);
  return c;
}

/** woven cloth tile: a plain over/under weave plus fibre speckle.
 *  `size` must stay a multiple of 2*THREAD so the checker tiles seamlessly. */
function clothTile(hex: string, size = 96) {
  const c = cnv(size, size);
  const g = c.getContext("2d")!;
  g.fillStyle = hex;
  g.fillRect(0, 0, size, size);
  const r = rng(7);

  /* Plain weave: each cell shows either the warp or the weft thread on top,
     alternating in a checkerboard. Lit along the thread that is "up".
     THREAD must divide `size` into an EVEN number of cells or the checker
     will not tile seamlessly — makeTable requests 128px tiles, so pick a
     thread width that satisfies both constraints. */
  let THREAD = 4;
  for (const t of [4, 3, 2]) {
    if (size % t === 0 && (size / t) % 2 === 0) { THREAD = t; break; }
  }
  const n = size / THREAD;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const warpUp = (i + j) % 2 === 0;
      const x = i * THREAD, y = j * THREAD;
      // the raised thread catches light; the recessed one falls into shadow
      g.fillStyle = warpUp ? "rgba(255,255,255,0.055)" : "rgba(0,0,0,0.06)";
      g.fillRect(x, y, THREAD, THREAD);
      // a hairline on the leading edge of each thread gives the weave definition
      g.fillStyle = warpUp ? "rgba(255,255,255,0.075)" : "rgba(0,0,0,0.075)";
      if (warpUp) g.fillRect(x, y, THREAD, 0.7);
      else g.fillRect(x, y, 0.7, THREAD);
    }
  }

  /* fine fibre speckle, elongated along the thread direction */
  for (let i = 0; i < 1400; i++) {
    const x = r() * size, y = r() * size;
    const light = r() > 0.5;
    g.fillStyle = light ? "rgba(255,255,255,0.045)" : "rgba(0,0,0,0.055)";
    if (r() > 0.5) g.fillRect(x, y, 1.8, 0.8);
    else g.fillRect(x, y, 0.8, 1.8);
  }

  /* very subtle nap so large flat areas are not perfectly uniform */
  const nap = g.createLinearGradient(0, 0, size, size);
  nap.addColorStop(0, "rgba(255,255,255,0.02)");
  nap.addColorStop(0.5, "rgba(0,0,0,0.012)");
  nap.addColorStop(1, "rgba(255,255,255,0.018)");
  g.fillStyle = nap;
  g.fillRect(0, 0, size, size);
  return c;
}

function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (amt > 0) { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
  else { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

/* ------------------------------------------------------------------
   BALLS
-------------------------------------------------------------------*/
export interface BallSkin {
  base: HTMLCanvasElement; // shaded sphere
  feat: HTMLCanvasElement; // rolling pattern (number / stripe / logo)
}

export const BALL_RS = 44; // sprite radius in px

function sphere(g: CanvasRenderingContext2D, rs: number, color: string, lightX = -0.34, lightY = -0.4) {
  const cx = rs, cy = rs;
  const grd = g.createRadialGradient(cx + lightX * rs, cy + lightY * rs, rs * 0.06, cx, cy, rs * 1.06);
  grd.addColorStop(0, shade(color, 0.62));
  grd.addColorStop(0.28, shade(color, 0.2));
  grd.addColorStop(0.62, color);
  grd.addColorStop(0.88, shade(color, -0.34));
  grd.addColorStop(1, shade(color, -0.58));
  g.fillStyle = grd;
  g.beginPath();
  g.arc(cx, cy, rs, 0, Math.PI * 2);
  g.fill();
}

export function makeBallSkins(): Record<number, BallSkin> {
  const out: Record<number, BallSkin> = {};
  const size = BALL_RS * 2;
  for (let id = 0; id <= 15; id++) {
    const base = cnv(size, size);
    const bg = base.getContext("2d")!;
    const stripe = isStripe(id);
    const color = BALL_COLORS[id];
    sphere(bg, BALL_RS, id === 0 ? "#f8f5ec" : stripe ? "#f6f3ea" : color);
    if (stripe) {
      // subtle resin sheen on the white shell
      const sh = bg.createLinearGradient(0, 0, 0, size);
      sh.addColorStop(0, "rgba(255,255,255,0.5)");
      sh.addColorStop(0.5, "rgba(255,255,255,0)");
      sh.addColorStop(1, "rgba(0,0,0,0.12)");
      bg.fillStyle = sh;
      bg.beginPath(); bg.arc(BALL_RS, BALL_RS, BALL_RS, 0, Math.PI * 2); bg.fill();
    }

    const feat = cnv(size, size);
    const fg = feat.getContext("2d")!;
    const rs = BALL_RS;

    if (stripe) {
      const bandH = rs * 1.02;
      const grd = fg.createLinearGradient(0, rs - bandH / 2, 0, rs + bandH / 2);
      grd.addColorStop(0, shade(color, -0.28));
      grd.addColorStop(0.22, shade(color, 0.22));
      grd.addColorStop(0.55, color);
      grd.addColorStop(1, shade(color, -0.4));
      fg.fillStyle = grd;
      fg.fillRect(-rs * 2, rs - bandH / 2, rs * 6, bandH);
      fg.globalAlpha = 0.25;
      fg.fillStyle = "#000";
      fg.fillRect(-rs * 2, rs + bandH / 2 - 2, rs * 6, 3);
      fg.globalAlpha = 1;
    }

    if (id > 0) {
      // number disc
      const dr = rs * 0.4;
      fg.save();
      fg.shadowColor = "rgba(0,0,0,0.45)";
      fg.shadowBlur = rs * 0.12;
      fg.fillStyle = "#fbf8ef";
      fg.beginPath(); fg.arc(rs, rs, dr, 0, Math.PI * 2); fg.fill();
      fg.restore();
      const ig = fg.createRadialGradient(rs - dr * 0.3, rs - dr * 0.35, dr * 0.1, rs, rs, dr);
      ig.addColorStop(0, "#ffffff");
      ig.addColorStop(1, "#ded6c2");
      fg.fillStyle = ig;
      fg.beginPath(); fg.arc(rs, rs, dr, 0, Math.PI * 2); fg.fill();
      fg.fillStyle = id === 8 ? "#0d0d0d" : "#1b1b1b";
      fg.font = `700 ${Math.round(dr * 1.28)}px "Helvetica Neue", Arial, sans-serif`;
      fg.textAlign = "center";
      fg.textBaseline = "middle";
      fg.fillText(String(id), rs, rs + dr * 0.05);
    } else {
      // cue ball: soft logo so the roll reads visually
      fg.save();
      fg.globalAlpha = 0.55;
      fg.fillStyle = "#b8243a";
      fg.beginPath(); fg.arc(rs, rs, rs * 0.2, 0, Math.PI * 2); fg.fill();
      fg.globalAlpha = 0.4;
      fg.strokeStyle = "#b8243a";
      fg.lineWidth = rs * 0.06;
      fg.beginPath(); fg.arc(rs, rs, rs * 0.32, 0, Math.PI * 2); fg.stroke();
      fg.restore();
    }
    out[id] = { base, feat };
  }
  return out;
}

/** specular + rim falloff drawn above every ball.
 *  Polished resin reads as a sphere from three cues: a tight specular dot, a
 *  broad soft highlight around it, and a cool bounce light on the shadow side. */
export function makeGloss(rs: number) {
  const size = rs * 2;
  const c = cnv(size, size);
  const g = c.getContext("2d")!;
  g.save();
  g.beginPath(); g.arc(rs, rs, rs, 0, Math.PI * 2); g.clip();

  /* terminator: darken toward the edge so the ball separates from the cloth */
  const rim = g.createRadialGradient(rs * 0.94, rs * 0.92, rs * 0.5, rs, rs, rs);
  rim.addColorStop(0, "rgba(0,0,0,0)");
  rim.addColorStop(0.72, "rgba(0,0,0,0.1)");
  rim.addColorStop(0.9, "rgba(0,0,0,0.34)");
  rim.addColorStop(1, "rgba(0,0,0,0.68)");
  g.fillStyle = rim;
  g.fillRect(0, 0, size, size);

  /* cool bounce light off the cloth, opposite the key light */
  const bounce = g.createRadialGradient(rs * 1.36, rs * 1.44, 0, rs * 1.36, rs * 1.44, rs * 0.78);
  bounce.addColorStop(0, "rgba(150,235,255,0.3)");
  bounce.addColorStop(0.55, "rgba(150,235,255,0.1)");
  bounce.addColorStop(1, "rgba(150,235,255,0)");
  g.fillStyle = bounce;
  g.fillRect(0, 0, size, size);

  /* broad soft highlight — the wide sheen of a polished surface */
  const soft = g.createRadialGradient(rs * 0.66, rs * 0.6, 0, rs * 0.66, rs * 0.6, rs * 0.95);
  soft.addColorStop(0, "rgba(255,255,255,0.4)");
  soft.addColorStop(0.45, "rgba(255,255,255,0.14)");
  soft.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = soft;
  g.fillRect(0, 0, size, size);

  /* tight specular core */
  const spec = g.createRadialGradient(rs * 0.62, rs * 0.56, 0, rs * 0.62, rs * 0.56, rs * 0.4);
  spec.addColorStop(0, "rgba(255,255,255,0.98)");
  spec.addColorStop(0.4, "rgba(255,255,255,0.42)");
  spec.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = spec;
  g.fillRect(0, 0, size, size);

  /* the hard pinpoint that sells the gloss */
  g.fillStyle = "rgba(255,255,255,0.97)";
  g.beginPath();
  g.ellipse(rs * 0.6, rs * 0.53, rs * 0.1, rs * 0.068, -0.5, 0, Math.PI * 2);
  g.fill();

  /* thin rim highlight along the lit edge */
  g.strokeStyle = "rgba(255,255,255,0.22)";
  g.lineWidth = rs * 0.045;
  g.beginPath();
  g.arc(rs, rs, rs * 0.975, Math.PI * 1.06, Math.PI * 1.72);
  g.stroke();

  g.restore();
  return c;
}

/* ------------------------------------------------------------------
   TABLE
-------------------------------------------------------------------*/
export interface TableTex {
  canvas: HTMLCanvasElement;
  ppi: number; // pixels per inch inside the texture
}

export function makeTable(skin: Skin, ppi: number): TableTex {
  const tw = W + FRAME * 2, th = H + FRAME * 2;
  const cw = Math.round(tw * ppi), ch = Math.round(th * ppi);
  const c = cnv(cw, ch);
  const g = c.getContext("2d")!;
  g.save();
  g.translate(FRAME * ppi, FRAME * ppi);
  g.scale(ppi, ppi);

  const r = rng(skin.id.length * 977 + 13);

  /* ---- outer wooden cabinet ---------------------------------- */
  const fw = W + FRAME * 2, fh = H + FRAME * 2;
  g.save();
  g.translate(-FRAME, -FRAME);
  roundRect(g, 0, 0, fw, fh, 2.4);
  const woodBase = g.createLinearGradient(0, 0, fw * 0.3, fh);
  woodBase.addColorStop(0, skin.wood[2]);
  woodBase.addColorStop(0.45, skin.wood[0]);
  woodBase.addColorStop(1, skin.wood[1]);
  g.fillStyle = woodBase;
  g.fill();
  g.clip();

  // grain
  g.globalAlpha = 0.16;
  for (let i = 0; i < 240; i++) {
    const y = r() * fh;
    const amp = 0.4 + r() * 1.6;
    g.strokeStyle = r() > 0.5 ? shade(skin.wood[2], 0.28) : shade(skin.wood[1], -0.2);
    g.lineWidth = 0.15 + r() * 0.85;
    g.beginPath();
    g.moveTo(-2, y);
    for (let x = 0; x <= fw + 2; x += 6) {
      g.lineTo(x, y + Math.sin((x + i * 30) * 0.045) * amp + Math.sin(x * 0.011 + i) * amp * 0.6);
    }
    g.stroke();
  }
  g.globalAlpha = 1;
  // knots
  for (let i = 0; i < 9; i++) {
    const x = r() * fw, y = r() * fh;
    for (let k = 0; k < 6; k++) {
      g.strokeStyle = `rgba(0,0,0,${0.05 + k * 0.012})`;
      g.lineWidth = 0.2;
      g.beginPath();
      g.ellipse(x, y, 0.5 + k * 0.42, 0.28 + k * 0.24, r() * 3, 0, Math.PI * 2);
      g.stroke();
    }
  }
  // lacquer sheen
  const sheen = g.createLinearGradient(0, 0, fw * 0.2, fh);
  sheen.addColorStop(0, "rgba(255,255,255,0.16)");
  sheen.addColorStop(0.35, "rgba(255,255,255,0.02)");
  sheen.addColorStop(0.6, "rgba(0,0,0,0.1)");
  sheen.addColorStop(1, "rgba(255,255,255,0.09)");
  g.fillStyle = sheen;
  g.fillRect(0, 0, fw, fh);
  // pores
  const pores = g.createPattern(noiseTile(64, 0.5, 21), "repeat");
  if (pores) {
    g.globalCompositeOperation = "overlay";
    g.globalAlpha = 0.5;
    g.fillStyle = pores;
    g.fillRect(0, 0, fw, fh);
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
  }
  g.restore();

  /* ---- bevel between wood and cloth ---------------------------- */
  g.save();
  g.translate(-FRAME, -FRAME);
  roundRect(g, FRAME - 0.95, FRAME - 0.95, W + 1.9, H + 1.9, 0.5);
  g.strokeStyle = "rgba(0,0,0,0.55)";
  g.lineWidth = 1.1;
  g.stroke();
  roundRect(g, FRAME - 1.5, FRAME - 1.5, W + 3, H + 3, 0.7);
  g.strokeStyle = "rgba(255,255,255,0.14)";
  g.lineWidth = 0.5;
  g.stroke();
  g.restore();

  /* ---- cloth bed ------------------------------------------------ */
  const feltTile = clothTile(skin.felt, 128);
  const CLOTH_K = 21; // px-tile maps to ~6" of real cloth
  g.save();
  g.beginPath();
  g.rect(-FRAME + 1.6, -FRAME + 1.6, W + FRAME * 2 - 3.2, H + FRAME * 2 - 3.2);
  g.clip();
  const pat = g.createPattern(clothTile(skin.feltDeep), "repeat");
  if (pat) {
    g.save();
    g.scale(1 / CLOTH_K, 1 / CLOTH_K);
    g.fillStyle = pat;
    g.fillRect((-FRAME + 1.6) * CLOTH_K, (-FRAME + 1.6) * CLOTH_K, (W + FRAME * 2) * CLOTH_K, (H + FRAME * 2) * CLOTH_K);
    g.restore();
  }
  g.restore();

  /* ---- playfield felt ------------------------------------------- */
  g.save();
  g.beginPath(); g.rect(0, 0, W, H); g.clip();
  const feltG = g.createLinearGradient(0, 0, 0, H);
  feltG.addColorStop(0, shade(skin.felt, 0.05));
  feltG.addColorStop(0.5, skin.felt);
  feltG.addColorStop(1, shade(skin.felt, -0.1));
  g.fillStyle = feltG;
  g.fillRect(0, 0, W, H);

  const fpat = g.createPattern(feltTile, "repeat");
  if (fpat) {
    g.globalAlpha = 0.55;
    g.save();
    g.scale(1 / CLOTH_K, 1 / CLOTH_K);
    g.fillStyle = fpat;
    g.fillRect(0, 0, W * CLOTH_K, H * CLOTH_K);
    g.restore();
    g.globalAlpha = 1;
  }

  // overhead light pool
  const light = g.createRadialGradient(W * 0.5, H * 0.42, 4, W * 0.5, H * 0.5, W * 0.62);
  light.addColorStop(0, shade(skin.feltLight, 0.1));
  light.addColorStop(0.35, "rgba(255,255,255,0.045)");
  light.addColorStop(1, "rgba(0,0,0,0.34)");
  g.globalCompositeOperation = "soft-light";
  g.fillStyle = light;
  g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = "source-over";

  const glow = g.createRadialGradient(W * 0.5, H * 0.45, 2, W * 0.5, H * 0.5, W * 0.5);
  glow.addColorStop(0, "rgba(255,246,214,0.16)");
  glow.addColorStop(0.55, "rgba(255,246,214,0.03)");
  glow.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = glow;
  g.fillRect(0, 0, W, H);

  // cushion cast shadows
  g.fillStyle = "rgba(0,0,0,0.3)";
  const sh = 1.5;
  g.fillRect(0, 0, W, sh);
  g.fillRect(0, H - sh, W, sh);
  g.fillRect(0, 0, sh, H);
  g.fillRect(W - sh, 0, sh, H);
  const sgr = g.createLinearGradient(0, 0, 0, 3.4);
  sgr.addColorStop(0, "rgba(0,0,0,0.32)");
  sgr.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = sgr;
  g.fillRect(0, 0, W, 3.4);
  const sgr2 = g.createLinearGradient(0, H, 0, H - 3.4);
  sgr2.addColorStop(0, "rgba(0,0,0,0.32)");
  sgr2.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = sgr2;
  g.fillRect(0, H - 3.4, W, 3.4);
  const sgl = g.createLinearGradient(0, 0, 3.4, 0);
  sgl.addColorStop(0, "rgba(0,0,0,0.32)");
  sgl.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = sgl;
  g.fillRect(0, 0, 3.4, H);
  const sgr3 = g.createLinearGradient(W, 0, W - 3.4, 0);
  sgr3.addColorStop(0, "rgba(0,0,0,0.32)");
  sgr3.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = sgr3;
  g.fillRect(W - 3.4, 0, 3.4, H);
  g.restore();

  /* ---- markings -------------------------------------------------- */
  g.save();
  g.globalAlpha = 0.16;
  g.strokeStyle = "#ffffff";
  g.lineWidth = 0.16;
  g.beginPath(); g.moveTo(W * 0.25, 0); g.lineTo(W * 0.25, H); g.stroke();
  g.globalAlpha = 0.3;
  for (const s of [{ x: W * 0.25, y: H / 2 }, { x: W * 0.75, y: H / 2 }, { x: W * 0.5, y: H / 2 }]) {
    g.fillStyle = "#ffffff";
    g.beginPath(); g.arc(s.x, s.y, 0.22, 0, Math.PI * 2); g.fill();
  }
  g.restore();

  /* ---- cushion bodies ------------------------------------------- */
  const cd = 3.15; // cushion depth outward from the nose line
  let cushionPat: CanvasPattern | null = null;
  for (const s of RAILS) {
    const dx = s.bx - s.ax, dy = s.by - s.ay;
    const len = Math.hypot(dx, dy);
    const ux = dx / len, uy = dy / len;
    let nx = -uy, ny = ux;
    // outward normal points away from table centre
    const mx = (s.ax + s.bx) / 2 - W / 2, my = (s.ay + s.by) / 2 - H / 2;
    if (nx * mx + ny * my < 0) { nx = -nx; ny = -ny; }
    g.beginPath();
    g.moveTo(s.ax, s.ay);
    g.lineTo(s.bx, s.by);
    g.lineTo(s.bx + nx * cd - ux * 0.9, s.by + ny * cd - uy * 0.9);
    g.lineTo(s.ax + nx * cd + ux * 0.9, s.ay + ny * cd + uy * 0.9);
    g.closePath();
    const cg = g.createLinearGradient(s.ax, s.ay, s.ax + nx * cd, s.ay + ny * cd);
    cg.addColorStop(0, shade(skin.felt, 0.16));
    cg.addColorStop(0.25, shade(skin.felt, 0.02));
    cg.addColorStop(1, shade(skin.feltDeep, -0.16));
    g.fillStyle = cg;
    g.fill();
    const cp = cushionPat ?? (cushionPat = g.createPattern(feltTile, "repeat"));
    if (cp) {
      g.save(); g.clip(); g.globalAlpha = 0.45;
      g.save();
      g.scale(1 / CLOTH_K, 1 / CLOTH_K);
      g.fillStyle = cp;
      g.fillRect(-FRAME * CLOTH_K, -FRAME * CLOTH_K, (W + FRAME * 2) * CLOTH_K, (H + FRAME * 2) * CLOTH_K);
      g.restore();
      g.restore();
    }
    // nose highlight
    g.strokeStyle = "rgba(255,255,255,0.24)";
    g.lineWidth = 0.22;
    g.beginPath(); g.moveTo(s.ax, s.ay); g.lineTo(s.bx, s.by); g.stroke();
    g.strokeStyle = "rgba(0,0,0,0.4)";
    g.lineWidth = 0.3;
    g.beginPath();
    g.moveTo(s.ax + nx * cd, s.ay + ny * cd);
    g.lineTo(s.bx + nx * cd, s.by + ny * cd);
    g.stroke();
  }

  /* ---- pocket throats (leather) ---------------------------------- */
  for (const j of JAWS) {
    g.strokeStyle = shade(skin.leather, -0.2);
    g.lineWidth = 1.5;
    g.lineCap = "round";
    g.beginPath(); g.moveTo(j.ax, j.ay); g.lineTo(j.bx, j.by); g.stroke();
    g.strokeStyle = "rgba(0,0,0,0.85)";
    g.lineWidth = 0.9;
    g.beginPath(); g.moveTo(j.ax, j.ay); g.lineTo(j.bx, j.by); g.stroke();
  }

  /* ---- pocket holes ---------------------------------------------- */
  for (const p of POCKETS) {
    // leather surround
    const sur = g.createRadialGradient(p.x, p.y, p.vr * 0.6, p.x, p.y, p.vr * 1.75);
    sur.addColorStop(0, shade(skin.leather, 0.06));
    sur.addColorStop(0.55, shade(skin.leather, -0.25));
    sur.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = sur;
    g.beginPath(); g.arc(p.x, p.y, p.vr * 1.75, 0, Math.PI * 2); g.fill();

    g.save();
    g.beginPath(); g.arc(p.x, p.y, p.vr, 0, Math.PI * 2); g.clip();
    const hole = g.createRadialGradient(p.x - p.vr * 0.2, p.y - p.vr * 0.25, p.vr * 0.1, p.x, p.y, p.vr * 1.15);
    hole.addColorStop(0, "#000000");
    hole.addColorStop(0.62, "#050505");
    hole.addColorStop(0.9, "#191410");
    hole.addColorStop(1, "#3a2c1e");
    g.fillStyle = hole;
    g.fillRect(p.x - p.vr, p.y - p.vr, p.vr * 2, p.vr * 2);
    // netting hint
    g.globalAlpha = 0.16;
    g.strokeStyle = "#c9b48d";
    g.lineWidth = 0.09;
    for (let i = -p.vr; i < p.vr; i += 0.5) {
      g.beginPath(); g.moveTo(p.x + i, p.y - p.vr); g.lineTo(p.x + i + p.vr, p.y + p.vr); g.stroke();
      g.beginPath(); g.moveTo(p.x + i, p.y - p.vr); g.lineTo(p.x + i - p.vr, p.y + p.vr); g.stroke();
    }
    g.globalAlpha = 1;
    g.restore();

    // chrome ring
    g.strokeStyle = "rgba(0,0,0,0.75)";
    g.lineWidth = 0.34;
    g.beginPath(); g.arc(p.x, p.y, p.vr, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = "rgba(255,255,255,0.16)";
    g.lineWidth = 0.16;
    g.beginPath(); g.arc(p.x, p.y, p.vr + 0.28, Math.PI * 0.9, Math.PI * 1.9); g.stroke();
  }

  /* ---- brass sights (diamonds) ------------------------------------ */
  const sights: [number, number][] = [];
  for (let i = 1; i <= 3; i++) {
    sights.push([(W / 2) * (i / 4), -FRAME / 2 - 0.15]);
    sights.push([(W / 2) * (i / 4) + W / 2, -FRAME / 2 - 0.15]);
    sights.push([(W / 2) * (i / 4), H + FRAME / 2 + 0.15]);
    sights.push([(W / 2) * (i / 4) + W / 2, H + FRAME / 2 + 0.15]);
  }
  for (let i = 1; i <= 3; i++) {
    sights.push([-FRAME / 2 - 0.15, H * (i / 4)]);
    sights.push([W + FRAME / 2 + 0.15, H * (i / 4)]);
  }
  for (const [sx, sy] of sights) {
    const d = 0.52;
    g.save();
    g.translate(sx, sy);
    g.rotate(Math.PI / 4);
    const dg = g.createLinearGradient(-d, -d, d, d);
    dg.addColorStop(0, "#fffbe8");
    dg.addColorStop(0.45, skin.diamond);
    dg.addColorStop(1, "#8a6a22");
    g.fillStyle = dg;
    g.fillRect(-d / 2, -d / 2, d, d);
    g.strokeStyle = "rgba(0,0,0,0.55)";
    g.lineWidth = 0.08;
    g.strokeRect(-d / 2, -d / 2, d, d);
    g.restore();
  }

  /* ---- inner shadow over everything ------------------------------- */
  g.save();
  g.translate(-FRAME, -FRAME);
  const vig = g.createRadialGradient(fw / 2, fh / 2, Math.min(fw, fh) * 0.3, fw / 2, fh / 2, Math.max(fw, fh) * 0.62);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(0,0,0,0.45)");
  g.fillStyle = vig;
  g.fillRect(0, 0, fw, fh);
  g.restore();

  g.restore();
  return { canvas: c, ppi };
}

export function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
