import {
  Cue, FRAME, HEAD_STRING, H, OBSTACLES as OBSTACLE_LIST, POCKETS, R, Skin, W, clamp,
} from "./constants";
import { Ball, World } from "./physics";
import { BALL_RS, BallSkin, TableTex, cnv, makeBallSkins, makeGloss, makeTable } from "./textures";

export interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; max: number; size: number; color: string; drag: number;
}
export interface Ring {
  x: number; y: number; r: number; max: number; life: number; maxLife: number;
  color: string; width: number;
}

export interface RenderState {
  world: World;
  aim: number | null;
  power: number;
  pull: number; // cue pull back in inches
  showCue: boolean;
  guides: boolean;
  guideLen: number;
  guideBounces: number;
  cueDef: Cue;
  spin: { x: number; y: number };
  ballInHand: boolean;
  placeGhost: { x: number; y: number; valid: boolean } | null;
  highlights: number[];
  kitchen: boolean;
  focus: number | null;
  time: number;
}

interface RayHit {
  t: number;
  kind: "ball" | "rail" | "pocket";
  ball?: Ball;
  nx: number; ny: number;
}

function rayCircle(ox: number, oy: number, dx: number, dy: number, cx: number, cy: number, r: number) {
  const ex = cx - ox, ey = cy - oy;
  const proj = ex * dx + ey * dy;
  if (proj <= 0) return Infinity;
  const perp2 = ex * ex + ey * ey - proj * proj;
  if (perp2 > r * r) return Infinity;
  const t = proj - Math.sqrt(r * r - perp2);
  return t > 0.0001 ? t : Infinity;
}

export class Renderer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  dpr = 1;
  ppi = 8;
  ox = 0;
  oy = 0;
  cssW = 0;
  cssH = 0;
  private table: TableTex | null = null;
  private tableKey = "";
  private skins: Record<number, BallSkin>;
  private gloss: HTMLCanvasElement;
  private cueCache = new Map<string, HTMLCanvasElement>();
  particles: Particle[] = [];
  rings: Ring[] = [];
  shake = 0;
  skin: Skin | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: true })!;
    this.skins = makeBallSkins();
    this.gloss = makeGloss(BALL_RS);
  }

  resize(cssW: number, cssH: number, dpr: number) {
    const prev = this.ppi;
    this.cssW = cssW;
    this.cssH = cssH;
    this.dpr = dpr;
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    const tw = W + FRAME * 2, th = H + FRAME * 2;
    this.ppi = Math.min(cssW / tw, cssH / th);
    this.ox = (cssW - W * this.ppi) / 2;
    this.oy = (cssH - H * this.ppi) / 2;
    this.buildCached();
    // only rebuild the (expensive) table texture when the scale really changed
    if (Math.abs(prev - this.ppi) / Math.max(prev, this.ppi) > 0.02) this.tableKey = "";
  }

  private shadowSprite: HTMLCanvasElement = cnv(2, 2);
  private dropGrad: CanvasGradient | null = null;
  private sheenGrad: CanvasGradient | null = null;

  private buildCached() {
    const ctx = this.ctx;
    const tx = this.ox - FRAME * this.ppi;
    const ty = this.oy - FRAME * this.ppi;
    const tw = (W + FRAME * 2) * this.ppi;
    const th = (H + FRAME * 2) * this.ppi;
    const ds = ctx.createRadialGradient(tx + tw / 2, ty + th / 2, tw * 0.3, tx + tw / 2, ty + th / 2, tw * 0.62);
    ds.addColorStop(0, "rgba(0,0,0,0.55)");
    ds.addColorStop(1, "rgba(0,0,0,0)");
    this.dropGrad = ds;
    const sh = ctx.createLinearGradient(tx, ty, tx + tw * 0.7, ty + th);
    sh.addColorStop(0, "rgba(255,255,255,0.05)");
    sh.addColorStop(0.35, "rgba(255,255,255,0.0)");
    sh.addColorStop(0.62, "rgba(255,255,255,0.03)");
    sh.addColorStop(1, "rgba(255,255,255,0)");
    this.sheenGrad = sh;

    const sr = 48;
    const sc = cnv(sr * 2, sr * 2);
    const sg = sc.getContext("2d")!;
    const g2 = sg.createRadialGradient(sr, sr, sr * 0.12, sr, sr, sr);
    g2.addColorStop(0, "rgba(0,0,0,0.92)");
    g2.addColorStop(0.45, "rgba(0,0,0,0.5)");
    g2.addColorStop(0.75, "rgba(0,0,0,0.16)");
    g2.addColorStop(1, "rgba(0,0,0,0)");
    sg.fillStyle = g2;
    sg.fillRect(0, 0, sr * 2, sr * 2);
    this.shadowSprite = sc;
  }

  setSkin(skin: Skin) {
    if (this.skin?.id === skin.id) return;
    this.skin = skin;
    this.tableKey = "";
  }

  private ensureTable() {
    if (!this.skin) return;
    const ppi = clamp(this.ppi * this.dpr, 3, 15);
    const key = `${this.skin.id}:${ppi.toFixed(1)}`;
    if (this.table && this.tableKey === key) return;
    this.table = makeTable(this.skin, ppi);
    this.tableKey = key;
  }

  sx(x: number) { return this.ox + x * this.ppi; }
  sy(y: number) { return this.oy + y * this.ppi; }
  toWorld(px: number, py: number) { return { x: (px - this.ox) / this.ppi, y: (py - this.oy) / this.ppi }; }
  br() { return R * this.ppi; }

  /* -------------------------------------------------- fx --------- */
  private push(p: Particle) {
    if (this.particles.length > 420) this.particles.shift();
    this.particles.push(p);
  }

  chalk(x: number, y: number, ang: number, power: number) {
    const n = Math.round(8 + power * 16);
    for (let i = 0; i < n; i++) {
      const a = ang + Math.PI + (Math.random() - 0.5) * 1.5;
      const sp = 6 + Math.random() * 34 * (0.4 + power);
      this.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.3 + Math.random() * 0.45, max: 0.75,
        size: 0.06 + Math.random() * 0.16,
        color: Math.random() > 0.4 ? "#9fd4ff" : "#ffffff",
        drag: 2.6,
      });
    }
  }

  impact(x: number, y: number, v: number) {
    const n = clamp(Math.round(v / 42), 1, 9);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 8 + Math.random() * (18 + v * 0.24);
      this.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.14 + Math.random() * 0.2, max: 0.34,
        size: 0.05 + Math.random() * 0.1,
        color: Math.random() > 0.5 ? "#fff6d8" : "#ffffff", drag: 3.4,
      });
    }
    if (v > 90) this.rings.push({ x, y, r: R * 0.4, max: R * (1.2 + v / 220), life: 0.28, maxLife: 0.28, color: "rgba(255,255,255,0.5)", width: 1.4 });
  }

  pocketFx(x: number, y: number, color: string) {
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 10 + Math.random() * 60;
      this.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.3 + Math.random() * 0.5, max: 0.8,
        size: 0.08 + Math.random() * 0.2,
        color: Math.random() > 0.55 ? color : "#ffe6a8", drag: 2.2,
      });
    }
    this.rings.push({ x, y, r: R * 0.5, max: R * 4.2, life: 0.5, maxLife: 0.5, color: "rgba(255,225,160,0.75)", width: 2.4 });
  }

  kick(x: number, y: number) {
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2;
      this.push({
        x, y, vx: Math.cos(a) * 14, vy: Math.sin(a) * 14,
        life: 0.2 + Math.random() * 0.2, max: 0.4, size: 0.07,
        color: "#e8ffd8", drag: 3,
      });
    }
  }

  private stepFx(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) { this.particles.splice(i, 1); continue; }
      const d = Math.max(0, 1 - p.drag * dt);
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= d; p.vy *= d;
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt;
      if (r.life <= 0) { this.rings.splice(i, 1); continue; }
      const k = 1 - r.life / r.maxLife;
      r.r = r.max * (1 - Math.pow(1 - k, 2.2));
    }
    this.shake = Math.max(0, this.shake - dt * 3.2);
  }

  /* -------------------------------------------------- cue sprite -- */
  private cueSprite(cue: Cue) {
    const hit = this.cueCache.get(cue.id);
    if (hit) return hit;
    const len = 1240, hh = 52;
    const c = cnv(len, hh);
    const g = c.getContext("2d")!;
    const mid = hh / 2;
    const tipH = hh * 0.36, buttH = hh * 0.62;
    g.beginPath();
    g.moveTo(4, mid - tipH / 2);
    g.lineTo(len - 10, mid - buttH / 2);
    g.quadraticCurveTo(len, mid - buttH / 2, len, mid - buttH / 2 + 4);
    g.lineTo(len, mid + buttH / 2 - 4);
    g.quadraticCurveTo(len, mid + buttH / 2, len - 10, mid + buttH / 2);
    g.lineTo(4, mid + tipH / 2);
    g.quadraticCurveTo(0, mid, 4, mid - tipH / 2);
    g.closePath();
    g.save();
    g.clip();

    const topY = (x: number) => mid - (tipH + (buttH - tipH) * (x / len)) / 2;
    const botY = (x: number) => mid + (tipH + (buttH - tipH) * (x / len)) / 2;
    const band = (x0: number, x1: number, fill: string | CanvasGradient) => {
      g.fillStyle = fill;
      g.beginPath();
      g.moveTo(x0, topY(x0)); g.lineTo(x1, topY(x1)); g.lineTo(x1, botY(x1)); g.lineTo(x0, botY(x0));
      g.closePath(); g.fill();
    };
    const cyl = (a: string, b: string, cc: string) => {
      const gr = g.createLinearGradient(0, 0, 0, hh);
      gr.addColorStop(0, b); gr.addColorStop(0.28, a); gr.addColorStop(0.55, cc);
      gr.addColorStop(0.82, b); gr.addColorStop(1, "rgba(0,0,0,0.55)");
      return gr;
    };

    band(0, 22, cyl("#4f9fd8", "#1c4f78", "#2f77ab")); // tip
    band(22, 60, cyl("#fffdf3", "#c8c0a8", "#f0ead6")); // ferrule
    band(60, 640, cyl("#f0d3a2", "#8a5f2e", "#c8a26a")); // shaft
    // shaft grain
    g.globalAlpha = 0.16;
    for (let i = 0; i < 90; i++) {
      const x = 60 + Math.random() * 580;
      g.strokeStyle = Math.random() > 0.5 ? "#6d4a20" : "#fff3dc";
      g.lineWidth = 0.6 + Math.random();
      g.beginPath(); g.moveTo(x, topY(x)); g.lineTo(x + 8 + Math.random() * 30, botY(x)); g.stroke();
    }
    g.globalAlpha = 1;
    band(640, 668, cyl(cue.ring, "#5c4413", cue.ring)); // collar
    band(668, 700, cyl("#f6efdc", "#a99c7c", "#ddd2b4")); // joint
    band(700, 950, cyl(cue.wrap, "#000000", "#3a3a3a")); // wrap
    g.globalAlpha = 0.28;
    g.strokeStyle = "#c9c9c9";
    g.lineWidth = 2.4;
    for (let x = 700; x < 950; x += 11) {
      g.beginPath(); g.moveTo(x, topY(x)); g.lineTo(x + 22, botY(x)); g.stroke();
    }
    g.globalAlpha = 1;
    band(950, 976, cyl(cue.ring, "#4a3410", cue.ring));
    band(976, 1200, cyl(cue.wood[0], cue.wood[1], cue.accent)); // butt
    g.globalAlpha = 0.22;
    for (let i = 0; i < 70; i++) {
      const x = 976 + Math.random() * 224;
      g.strokeStyle = Math.random() > 0.5 ? "#000" : cue.accent;
      g.lineWidth = 0.7 + Math.random();
      g.beginPath(); g.moveTo(x, topY(x)); g.lineTo(x + 10, botY(x)); g.stroke();
    }
    g.globalAlpha = 1;
    // inlay points
    for (let i = 0; i < 4; i++) {
      const x = 1000 + i * 46;
      g.fillStyle = cue.accent;
      g.beginPath();
      g.moveTo(x, mid - 8); g.lineTo(x + 8, mid); g.lineTo(x, mid + 8); g.lineTo(x - 8, mid);
      g.closePath(); g.fill();
      g.strokeStyle = "rgba(0,0,0,0.4)"; g.lineWidth = 1; g.stroke();
    }
    band(1200, len, cyl("#2a2a2a", "#000", "#151515")); // bumper

    // global shading
    const sh = g.createLinearGradient(0, 0, 0, hh);
    sh.addColorStop(0, "rgba(255,255,255,0.24)");
    sh.addColorStop(0.34, "rgba(255,255,255,0.06)");
    sh.addColorStop(0.62, "rgba(0,0,0,0.18)");
    sh.addColorStop(1, "rgba(0,0,0,0.6)");
    g.fillStyle = sh;
    g.fillRect(0, 0, len, hh);
    g.restore();

    this.cueCache.set(cue.id, c);
    return c;
  }

  /* -------------------------------------------------- raycast ----- */
  private rayBall(ox: number, oy: number, dx: number, dy: number, b: Ball) {
    return rayCircle(ox, oy, dx, dy, b.x, b.y, R * 2);
  }

  private raySeg(ox: number, oy: number, dx: number, dy: number, s: { ax: number; ay: number; bx: number; by: number }) {
    const sx = s.bx - s.ax, sy = s.by - s.ay;
    const l2 = sx * sx + sy * sy;
    let nx = -sy, ny = sx;
    const nl = Math.hypot(nx, ny) || 1;
    nx /= nl; ny /= nl;
    if ((ox - s.ax) * nx + (oy - s.ay) * ny < 0) { nx = -nx; ny = -ny; }
    const dn = dx * nx + dy * ny;
    let best = Infinity, bnx = nx, bny = ny;
    if (dn < -1e-7) {
      const t = (R - ((ox - s.ax) * nx + (oy - s.ay) * ny)) / dn;
      if (t > 0.002 && t < best) {
        const px = ox + dx * t, py = oy + dy * t;
        const pr = ((px - s.ax) * sx + (py - s.ay) * sy) / l2;
        if (pr >= 0 && pr <= 1) { best = t; }
      }
    }
    for (const e of [[s.ax, s.ay], [s.bx, s.by]]) {
      const t = rayCircle(ox, oy, dx, dy, e[0], e[1], R);
      if (t < best) {
        best = t;
        const px = ox + dx * t, py = oy + dy * t;
        const d = Math.hypot(px - e[0], py - e[1]) || 1;
        bnx = (px - e[0]) / d; bny = (py - e[1]) / d;
      }
    }
    return { t: best, nx: bnx, ny: bny };
  }

  castRay(world: World, ox: number, oy: number, dx: number, dy: number, maxDist: number): RayHit | null {
    let best: RayHit | null = null;
    for (const b of world.balls) {
      if (!b.on || b.drop > 0 || b.id === 0) continue;
      const t = this.rayBall(ox, oy, dx, dy, b);
      if (t < maxDist && (!best || t < best.t)) {
        const px = ox + dx * t, py = oy + dy * t;
        const d = Math.hypot(b.x - px, b.y - py) || 1;
        best = { t, kind: "ball", ball: b, nx: (b.x - px) / d, ny: (b.y - py) / d };
      }
    }
    for (const s of OBSTACLE_LIST) {
      const r = this.raySeg(ox, oy, dx, dy, s);
      if (r.t < maxDist && (!best || r.t < best.t)) best = { t: r.t, kind: "rail", nx: r.nx, ny: r.ny };
    }
    for (const p of POCKETS) {
      const t = rayCircle(ox, oy, dx, dy, p.x, p.y, p.cr * 0.92);
      if (t < maxDist && (!best || t < best.t)) best = { t, kind: "pocket", nx: -dx, ny: -dy };
    }
    return best;
  }

  /* -------------------------------------------------- draw -------- */
  draw(s: RenderState, dt: number) {
    const ctx = this.ctx;
    this.ensureTable();
    this.stepFx(dt);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.cssW, this.cssH);
    if (!this.table) return;

    const shk = this.shake;
    ctx.save();
    if (shk > 0) {
      ctx.translate((Math.random() - 0.5) * shk * 12, (Math.random() - 0.5) * shk * 12);
    }

    const tx = this.ox - FRAME * this.ppi;
    const ty = this.oy - FRAME * this.ppi;
    const tw = (W + FRAME * 2) * this.ppi;
    const th = (H + FRAME * 2) * this.ppi;

    // drop shadow under the cabinet
    if (this.dropGrad) {
      ctx.save();
      ctx.fillStyle = this.dropGrad;
      ctx.fillRect(tx - tw * 0.25, ty - th * 0.35, tw * 1.5, th * 1.8);
      ctx.restore();
    }

    ctx.drawImage(this.table.canvas, tx, ty, tw, th);

    const br = this.br();
    const world = s.world;

    /* kitchen overlay while placing on the break */
    if (s.kitchen && s.ballInHand) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(this.sx(HEAD_STRING), this.sy(0), this.sx(W) - this.sx(HEAD_STRING), H * this.ppi);
      ctx.fillStyle = "rgba(255,90,90,0.10)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.setLineDash([6, 6]);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(this.sx(HEAD_STRING), this.sy(0));
      ctx.lineTo(this.sx(HEAD_STRING), this.sy(H));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    /* target highlights */
    if (s.highlights.length) {
      const pulse = 0.5 + 0.5 * Math.sin(s.time * 3.4);
      for (const b of world.balls) {
        if (!b.on || b.drop > 0 || s.highlights.indexOf(b.id) < 0) continue;
        ctx.save();
        ctx.strokeStyle = `rgba(255,225,150,${0.22 + pulse * 0.3})`;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(this.sx(b.x), this.sy(b.y), br * (1.36 + pulse * 0.1), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }
    if (s.focus !== null) {
      const b = world.byId(s.focus);
      if (b && b.on) {
        const pulse = 0.5 + 0.5 * Math.sin(s.time * 6);
        ctx.save();
        ctx.strokeStyle = `rgba(255,110,110,${0.35 + pulse * 0.4})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.arc(this.sx(b.x), this.sy(b.y), br * 1.6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    /* shadows */
    for (const b of world.balls) {
      if (!b.on) continue;
      const k = b.drop > 0 ? 1 - b.drop : 1;
      if (k <= 0) continue;
      const p = this.dropPos(b);
      ctx.save();
      ctx.globalAlpha = 0.5 * k;
      ctx.translate(this.sx(p.x) + br * 0.3, this.sy(p.y) + br * 0.42);
      ctx.scale(1.5, 1.3);
      ctx.drawImage(this.shadowSprite, -br, -br, br * 2, br * 2);
      ctx.restore();
    }

    /* guides */
    if (s.aim !== null && s.guides && s.ballInHand === false) {
      this.drawGuide(ctx, s, br);
    }

    /* balls */
    const ordered = world.balls.slice().sort((a, b) => (a.drop > 0 ? 1 : 0) - (b.drop > 0 ? 1 : 0));
    for (const b of ordered) {
      if (!b.on) continue;
      this.drawBall(ctx, b, br);
    }

    /* ball in hand ghost */
    if (s.placeGhost) {
      const gp = s.placeGhost;
      ctx.save();
      ctx.globalAlpha = 0.75;
      ctx.drawImage(this.skins[0].base, this.sx(gp.x) - br, this.sy(gp.y) - br, br * 2, br * 2);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = gp.valid ? "rgba(120,255,170,0.95)" : "rgba(255,90,90,0.95)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.sx(gp.x), this.sy(gp.y), br * 1.45, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([4, 5]);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(this.sx(gp.x), this.sy(gp.y), br * 1.9 + Math.sin(s.time * 4) * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    /* cue stick */
    if (s.showCue && s.aim !== null) {
      this.drawCueStick(ctx, s, br);
    }

    /* particles + rings */
    for (const r of this.rings) {
      const a = r.life / r.maxLife;
      ctx.save();
      ctx.globalAlpha = a * 0.8;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.width * a;
      ctx.beginPath();
      ctx.arc(this.sx(r.x), this.sy(r.y), r.r * this.ppi, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    for (const p of this.particles) {
      const a = clamp(p.life / p.max, 0, 1);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(this.sx(p.x), this.sy(p.y), Math.max(0.4, p.size * this.ppi * (0.4 + a * 0.8)), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    /* glass sheen over the whole table */
    if (this.sheenGrad) {
      ctx.fillStyle = this.sheenGrad;
      ctx.fillRect(tx, ty, tw, th);
    }

    ctx.restore();
  }

  private dropPos(b: Ball) {
    if (b.drop <= 0) return { x: b.x, y: b.y };
    const p = POCKETS[b.pocketIdx] ?? POCKETS[0];
    const t = b.drop * b.drop * 0.4 + b.drop * 0.6;
    return { x: b.x + (p.x - b.x) * t, y: b.y + (p.y - b.y) * t };
  }

  private drawBall(ctx: CanvasRenderingContext2D, b: Ball, br: number) {
    const sk = this.skins[b.id] ?? this.skins[1];
    const speed = Math.hypot(b.vx, b.vy);
    let px = b.x, py = b.y;
    let scale = 1;
    let alpha = 1;
    if (b.drop > 0) {
      const p = this.dropPos(b);
      px = p.x; py = p.y;
      scale = 1 - 0.7 * b.drop;
      alpha = clamp(1 - b.drop * b.drop * 1.1, 0, 1);
      if (alpha <= 0.01) return;
    }
    const cx = this.sx(px), cy = this.sy(py);
    const r = br * scale;

    // motion trail
    if (speed > 95 && b.drop === 0) {
      const steps = 3;
      const ux = b.vx / speed, uy = b.vy / speed;
      ctx.save();
      for (let i = steps; i >= 1; i--) {
        const back = (i * Math.min(speed, 420)) / 190;
        ctx.globalAlpha = 0.1 * (1 - i / (steps + 1)) * clamp(speed / 200, 0, 1);
        ctx.drawImage(sk.base, cx - ux * back * this.ppi - r, cy - uy * back * this.ppi - r, r * 2, r * 2);
      }
      ctx.restore();
    }

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, cy);
    ctx.drawImage(sk.base, -r, -r, r * 2, r * 2);

    // rolling pattern
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.985, 0, Math.PI * 2);
    ctx.clip();
    const lim = r;
    const ox = (b.px / R) * r * (1 / 1);
    const oy = (b.py / R) * r;
    const d2 = ox * ox + oy * oy;
    if (d2 < lim * lim) {
      const kx = Math.sqrt(Math.max(0.06, 1 - (ox * ox) / (lim * lim)));
      const ky = Math.sqrt(Math.max(0.06, 1 - (oy * oy) / (lim * lim)));
      const fade = clamp((lim - Math.sqrt(d2)) / (lim * 0.42), 0, 1);
      ctx.rotate(b.prot);
      ctx.translate(ox, oy);
      ctx.scale(kx, ky);
      ctx.globalAlpha = alpha * fade;
      ctx.drawImage(sk.feat, -r, -r, r * 2, r * 2);
    }
    ctx.restore();

    ctx.globalAlpha = alpha;
    ctx.drawImage(this.gloss, -r, -r, r * 2, r * 2);

    if (b.flash > 0.02) {
      ctx.globalAlpha = b.flash * 0.5;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = Math.max(1, r * 0.14);
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.95, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawCueStick(ctx: CanvasRenderingContext2D, s: RenderState, br: number) {
    const c = s.world.cue();
    if (!c.on) return;
    const sprite = this.cueSprite(s.cueDef);
    const lenPx = 58 * this.ppi;
    const hPx = lenPx * (52 / 1240);
    const gap = br + 2 + s.pull * this.ppi;
    const cx = this.sx(c.x), cy = this.sy(c.y);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((s.aim ?? 0) + Math.PI);
    ctx.globalAlpha = 0.3;
    ctx.drawImage(sprite, gap + br * 0.35, -hPx / 2 + br * 0.5, lenPx, hPx);
    ctx.globalAlpha = 1;
    ctx.drawImage(sprite, gap, -hPx / 2, lenPx, hPx);
    ctx.restore();
  }

  private drawGuide(ctx: CanvasRenderingContext2D, s: RenderState, br: number) {
    const world = s.world;
    const c = world.cue();
    if (!c.on || s.aim === null) return;
    const maxDist = Math.hypot(W, H) * s.guideLen;
    let ox = c.x, oy = c.y;
    let dx = Math.cos(s.aim), dy = Math.sin(s.aim);
    let remaining = maxDist;
    const bounces = s.guideBounces;

    ctx.save();
    ctx.lineCap = "round";
    for (let bounce = 0; bounce <= bounces; bounce++) {
      const hit = this.castRay(world, ox, oy, dx, dy, remaining);
      const t = hit ? hit.t : remaining;
      const ex = ox + dx * t, ey = oy + dy * t;
      this.guideLine(ctx, this.sx(ox), this.sy(oy), this.sx(ex), this.sy(ey), bounce === 0);
      if (!hit) break;
      remaining -= t;
      if (remaining < 3) break;

      if (hit.kind === "ball" && hit.ball) {
        const b = hit.ball;
        // ghost ball
        ctx.save();
        ctx.strokeStyle = "rgba(255,255,255,0.85)";
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.arc(this.sx(ex), this.sy(ey), br, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 0.14;
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.beginPath();
        ctx.arc(this.sx(ex), this.sy(ey), Math.max(1, br * 0.12), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // object ball path
        const odx = b.x - ex, ody = b.y - ey;
        const ol = Math.hypot(odx, ody) || 1;
        const oux = odx / ol, ouy = ody / ol;
        const oHit = this.castRayFor(world, b.x, b.y, oux, ouy, Math.min(remaining * 1.4, 130), b.id);
        const ot = oHit ? (oHit.kind === "pocket" ? oHit.t + 1.4 : oHit.t) : Math.min(remaining * 1.4, 130);
        ctx.save();
        ctx.strokeStyle = "rgba(255,236,170,0.9)";
        ctx.lineWidth = Math.max(1.4, br * 0.2);
        ctx.setLineDash([]);
        ctx.shadowColor = "rgba(255,214,120,0.7)";
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.moveTo(this.sx(b.x), this.sy(b.y));
        ctx.lineTo(this.sx(b.x + oux * ot), this.sy(b.y + ouy * ot));
        ctx.stroke();
        ctx.shadowBlur = 0;
        // arrow head
        const hx = b.x + oux * ot, hy = b.y + ouy * ot;
        ctx.fillStyle = "rgba(255,236,170,0.9)";
        ctx.beginPath();
        ctx.moveTo(this.sx(hx + oux * 1.6), this.sy(hy + ouy * 1.6));
        ctx.lineTo(this.sx(hx - ouy * 0.8), this.sy(hy + oux * 0.8));
        ctx.lineTo(this.sx(hx + ouy * 0.8), this.sy(hy - oux * 0.8));
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // cue ball deflection (tangent)
        const dot = dx * oux + dy * ouy;
        let tx2 = dx - oux * dot, ty2 = dy - ouy * dot;
        const tl = Math.hypot(tx2, ty2);
        if (tl > 0.06) {
          tx2 /= tl; ty2 /= tl;
          const len = clamp(16 * s.guideLen + 6, 6, 26);
          ctx.save();
          ctx.strokeStyle = "rgba(255,255,255,0.42)";
          ctx.lineWidth = 1.2;
          ctx.setLineDash([3.5, 4.5]);
          ctx.beginPath();
          ctx.moveTo(this.sx(ex), this.sy(ey));
          ctx.lineTo(this.sx(ex + tx2 * len), this.sy(ey + ty2 * len));
          ctx.stroke();
          ctx.restore();
        }
        break;
      }

      if (hit.kind === "pocket") {
        ctx.save();
        ctx.strokeStyle = "rgba(255,225,150,0.75)";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(this.sx(ex), this.sy(ey), br * 0.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        break;
      }

      // cushion: reflect and continue
      ctx.save();
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.beginPath();
      ctx.arc(this.sx(ex), this.sy(ey), Math.max(1.2, br * 0.16), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      const d = dx * hit.nx + dy * hit.ny;
      dx = dx - 2 * d * hit.nx;
      dy = dy - 2 * d * hit.ny;
      ox = ex + dx * 0.02;
      oy = ey + dy * 0.02;
    }
    ctx.restore();
  }

  private castRayFor(world: World, ox: number, oy: number, dx: number, dy: number, maxDist: number, ignore: number) {
    let best: RayHit | null = null;
    for (const b of world.balls) {
      if (!b.on || b.drop > 0 || b.id === ignore) continue;
      const t = this.rayBall(ox, oy, dx, dy, b);
      if (t < maxDist && (!best || t < best.t)) best = { t, kind: "ball", ball: b, nx: 0, ny: 0 };
    }
    for (const s of OBSTACLE_LIST) {
      const r = this.raySeg(ox, oy, dx, dy, s);
      if (r.t < maxDist && (!best || r.t < best.t)) best = { t: r.t, kind: "rail", nx: r.nx, ny: r.ny };
    }
    for (const p of POCKETS) {
      const t = rayCircle(ox, oy, dx, dy, p.x, p.y, p.cr * 0.92);
      if (t < maxDist && (!best || t < best.t)) best = { t, kind: "pocket", nx: -dx, ny: -dy };
    }
    return best;
  }

  private guideLine(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, primary: boolean) {
    ctx.save();
    ctx.strokeStyle = primary ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.12)";
    ctx.lineWidth = primary ? 4.5 : 3;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.strokeStyle = primary ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.5)";
    ctx.lineWidth = primary ? 1.5 : 1.1;
    ctx.setLineDash([7, 7]);
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.restore();
  }
}


