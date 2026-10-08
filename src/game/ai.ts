import {
  BALL_D, Cue, Difficulty, FOOT_SPOT, H, POCKETS, R, RAILS, W, clamp, cueMaxSpeed, groupOf,
} from "./constants";
import { Ball, ShotSpec, simulateShot } from "./physics";
import { Match } from "./rules";

export interface AiShot extends ShotSpec {
  note: string;
  quality: number;
  target: number;
  pocketIdx: number;
}

interface Cand {
  angle: number;
  power: number;
  spinX: number;
  spinY: number;
  ball: number;
  pocket: number;
  geo: number;
  kind: "pot" | "kick" | "safety";
}

function segClear(balls: Ball[], ax: number, ay: number, bx: number, by: number, ignore: number[], radius: number) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  for (const b of balls) {
    if (!b.on || b.drop > 0 || ignore.indexOf(b.id) >= 0) continue;
    let t = l2 > 1e-9 ? ((b.x - ax) * dx + (b.y - ay) * dy) / l2 : 0;
    t = clamp(t, 0, 1);
    const px = ax + dx * t, py = ay + dy * t;
    if (Math.hypot(b.x - px, b.y - py) < radius) return false;
  }
  return true;
}

function gauss() {
  return (Math.random() + Math.random() + Math.random() + Math.random() - 2) / 2;
}

/** how many follow-up pots are available from a cue-ball position */
function positionScore(balls: Ball[], cx: number, cy: number, group: string | null, isBreakDone: boolean) {
  let n = 0;
  for (const b of balls) {
    if (!b.on || b.id === 0 || b.drop > 0) continue;
    if (!isBreakDone) continue;
    if (group && groupOf(b.id) !== group && b.id !== 8) continue;
    if (!group && b.id === 8) continue;
    for (const p of POCKETS) {
      const dx = p.x - b.x, dy = p.y - b.y;
      const dp = Math.hypot(dx, dy);
      if (dp < 3) continue;
      const ux = dx / dp, uy = dy / dp;
      const gx = b.x - ux * BALL_D, gy = b.y - uy * BALL_D;
      if (Math.hypot(gx - cx, gy - cy) < BALL_D * 1.1) continue;
      if (!segClear(balls, cx, cy, gx, gy, [0, b.id], BALL_D - 0.03)) continue;
      if (!segClear(balls, b.x, b.y, p.x, p.y, [b.id], BALL_D - 0.03)) continue;
      n++;
      break;
    }
  }
  return n;
}

export function chooseShot(match: Match, cue: Cue, diff: Difficulty): AiShot {
  const world = match.world;
  const balls = world.balls;
  const cb = world.cue();
  const mode = world.mode;

  /* ---------------- the break ---------------- */
  if (match.isBreak) {
    const apex = world.balls.find((b) => Math.abs(b.x - FOOT_SPOT.x) < 4 && Math.abs(b.y - FOOT_SPOT.y) < 4);
    const tx = apex ? apex.x : FOOT_SPOT.x;
    const ty = apex ? apex.y : FOOT_SPOT.y;
    const base = Math.atan2(ty - cb.y, tx - cb.x);
    const ang = base + gauss() * 0.012 * (1.4 - diff.smart);
    return {
      angle: ang, power: 0.9 + Math.random() * 0.1,
      spinX: gauss() * 0.1, spinY: 0.12 + Math.random() * 0.2,
      cue, note: "Break", quality: 1, target: apex ? apex.id : 1, pocketIdx: -1,
    };
  }

  const targets = match.legalTargets();
  const cands: Cand[] = [];

  /* ---------------- direct pots ---------------- */
  for (const tid of targets) {
    const tb = world.byId(tid);
    if (!tb || !tb.on) continue;
    for (let pi = 0; pi < POCKETS.length; pi++) {
      const p = POCKETS[pi];
      const dxp = p.x - tb.x, dyp = p.y - tb.y;
      const dp = Math.hypot(dxp, dyp);
      if (dp < 1.6) continue;
      const ux = dxp / dp, uy = dyp / dp;
      const gx = tb.x - ux * BALL_D, gy = tb.y - uy * BALL_D;
      const dxg = gx - cb.x, dyg = gy - cb.y;
      const dg = Math.hypot(dxg, dyg);
      if (dg < 0.4) continue;
      const cx = dxg / dg, cy = dyg / dg;
      const cosCut = clamp(cx * ux + cy * uy, -1, 1);
      const cut = Math.acos(cosCut);
      if (cut > 1.34) continue; // ~77° — too thin
      if (!segClear(balls, cb.x, cb.y, gx, gy, [0, tid], BALL_D - 0.04)) continue;
      if (!segClear(balls, tb.x, tb.y, p.x, p.y, [tid], BALL_D - 0.04)) continue;

      const vEnd = clamp(38 + dp * 0.5, 42, 150);
      const vObj = Math.sqrt(vEnd * vEnd + 2 * 62 * dp);
      const vCue = vObj / Math.max(0.24, cosCut * 0.99);
      const power = clamp(vCue / cueMaxSpeed(cue), 0.13, 1);

      // outside english reduces throw on thin cuts (high physics only)
      const spinX = mode === "high" ? clamp(-Math.sin(cut) * 0.3 * Math.sign(cross(cx, cy, ux, uy)), -0.5, 0.5) : 0;
      const spinY = cut > 0.9 ? -0.05 : 0.16;

      const geo =
        120 * cosCut +
        -dp * 0.55 -
        dg * 0.35 +
        (p.kind === "corner" ? 12 : 0) +
        (dg < 26 ? 14 : 0);
      cands.push({ angle: Math.atan2(cy, cx), power, spinX, spinY, ball: tid, pocket: pi, geo, kind: "pot" });
    }
  }

  /* ---------------- one-rail kick shots ---------------- */
  if (diff.smart > 0.55) {
    for (const tid of targets) {
      const tb = world.byId(tid);
      if (!tb || !tb.on) continue;
      for (let pi = 0; pi < POCKETS.length; pi++) {
        const p = POCKETS[pi];
        const dxp = p.x - tb.x, dyp = p.y - tb.y;
        const dp = Math.hypot(dxp, dyp);
        if (dp < 3 || dp > 70) continue;
        const ux = dxp / dp, uy = dyp / dp;
        const gx = tb.x - ux * BALL_D, gy = tb.y - uy * BALL_D;
        for (const s of RAILS) {
          const sx = s.bx - s.ax, sy = s.by - s.ay;
          const sl = Math.hypot(sx, sy);
          let nx = -sy / sl, ny = sx / sl;
          const mx = (s.ax + s.bx) / 2 - W / 2, my = (s.ay + s.by) / 2 - H / 2;
          if (nx * mx + ny * my < 0) { nx = -nx; ny = -ny; } // inward normal
          const gd = (gx - s.ax) * nx + (gy - s.ay) * ny;
          const cd = (cb.x - s.ax) * nx + (cb.y - s.ay) * ny;
          if (gd > cd) continue; // ghost must be beyond the rail from the cue ball
          const mgx = gx - 2 * gd * nx, mgy = gy - 2 * gd * ny;
          const dx = mgx - cb.x, dy = mgy - cb.y;
          const dl = Math.hypot(dx, dy);
          if (dl < 1) continue;
          const tRail = (cd - R) / (-(gd - cd) / dl === 0 ? 1e-6 : ((cd - gd) / dl));
          const hx = cb.x + (dx / dl) * tRail, hy = cb.y + (dy / dl) * tRail;
          const proj = ((hx - s.ax) * sx + (hy - s.ay) * sy) / (sl * sl);
          if (proj < 0.03 || proj > 0.97) continue;
          if (!segClear(balls, cb.x, cb.y, hx, hy, [0], R - 0.02)) continue;
          if (!segClear(balls, tb.x, tb.y, p.x, p.y, [tid], BALL_D - 0.04)) continue;
          const power = clamp((Math.sqrt(42 * 42 + 2 * 62 * (dp + dl)) / cueMaxSpeed(cue)) * 1.25, 0.25, 1);
          cands.push({
            angle: Math.atan2(dy, dx), power, spinX: 0, spinY: 0.1,
            ball: tid, pocket: pi, geo: -30 - dp * 0.4, kind: "kick",
          });
        }
      }
    }
  }

  if (!cands.length) {
    return safetyShot(match, cue, diff);
  }

  cands.sort((a, b) => b.geo - a.geo);
  const evalCount = Math.min(cands.length, Math.round(3 + diff.smart * 12));
  const group = match.players[1].group;

  let best: { c: Cand; score: number; note: string } | null = null;
  for (let i = 0; i < evalCount; i++) {
    const c = cands[i];
    const res = simulateShot(balls, mode, { angle: c.angle, power: c.power, spinX: c.spinX, spinY: c.spinY, cue }, 6);
    let s = c.geo * 0.6;
    const pottedTarget = res.potted.indexOf(c.ball) >= 0;
    if (pottedTarget) s += 1000;
    if (res.cueScratch) s -= 950;
    if (res.firstHit === null) s -= 800;
    else if (res.firstHit !== c.ball) s -= 620;
    if (res.potted.indexOf(8) >= 0 && !match.onEight(1)) s -= 5000;

    for (const id of res.potted) {
      if (id === 0 || id === c.ball) continue;
      if (id === 8) continue;
      const own = group ? groupOf(id) === group : true;
      s += own ? 330 : -260;
    }

    if (pottedTarget && !res.cueScratch) {
      const follow = positionScore(res.balls, res.cueEnd.x, res.cueEnd.y, group ?? null, true);
      s += follow * 95;
      const nearCushion =
        Math.min(res.cueEnd.x, W - res.cueEnd.x, res.cueEnd.y, H - res.cueEnd.y) < R * 1.7;
      s -= nearCushion ? 70 : 0;
      let jail = 0;
      for (const b of res.balls) {
        if (b.id === 0 || !b.on) continue;
        const d = Math.hypot(b.x - res.cueEnd.x, b.y - res.cueEnd.y);
        if (d < BALL_D * 1.35) jail += 1;
      }
      s -= jail * 130;
      s += 40 * Math.min(1, Math.hypot(res.cueEnd.x - W / 2, res.cueEnd.y - H / 2) / 30) * -1;
    }
    s -= c.power * 46;
    if (c.kind === "kick") s -= 120;

    const note = pottedTarget ? (c.kind === "kick" ? "Kick shot" : "Pot") : c.kind === "kick" ? "Kick attempt" : "Safety";
    if (!best || s > best.score) best = { c, score: s, note };
  }

  if (!best || best.score < 250) return safetyShot(match, cue, diff, best?.c ?? null);

  /* difficulty based execution error */
  const errA = (diff.noise * Math.PI) / 180;
  const errP = diff.powerNoise;
  const angle = best.c.angle + gauss() * errA * (best.c.kind === "kick" ? 1.5 : 1);
  const power = clamp(best.c.power * (1 + gauss() * errP) + gauss() * errP * 0.4, 0.1, 1);

  return {
    angle, power,
    spinX: clamp(best.c.spinX + gauss() * 0.05, -1, 1),
    spinY: clamp(best.c.spinY + gauss() * 0.05, -1, 1),
    cue, note: best.note, quality: clamp(best.score / 1000, 0, 1.4),
    target: best.c.ball, pocketIdx: best.c.pocket,
  };
}

function cross(ax: number, ay: number, bx: number, by: number) {
  return ax * by - ay * bx;
}

/** nothing on: contact a legal ball and try to leave the cue ball awkward */
function safetyShot(match: Match, cue: Cue, diff: Difficulty, fallback: Cand | null = null): AiShot {
  const world = match.world;
  const cb = world.cue();
  const targets = match.legalTargets();
  let bestBall: Ball | null = null;
  let bd = Infinity;
  for (const t of targets) {
    const b = world.byId(t);
    if (!b || !b.on) continue;
    const d = Math.hypot(b.x - cb.x, b.y - cb.y);
    if (d < bd) { bd = d; bestBall = b; }
  }

  if (fallback) {
    return {
      angle: fallback.angle + gauss() * (diff.noise * Math.PI) / 180,
      power: clamp(fallback.power, 0.18, 1),
      spinX: fallback.spinX, spinY: fallback.spinY,
      cue, note: "Risky pot", quality: 0.2, target: fallback.ball, pocketIdx: fallback.pocket,
    };
  }

  if (!bestBall) {
    return { angle: Math.random() * Math.PI * 2, power: 0.4, spinX: 0, spinY: 0, cue, note: "Escape", quality: 0, target: -1, pocketIdx: -1 };
  }

  const base = Math.atan2(bestBall.y - cb.y, bestBall.x - cb.x);
  let chosen: ShotSpec = { angle: base, power: clamp(bd / 90 + 0.24, 0.28, 0.62), spinX: 0, spinY: -0.35, cue };
  for (let i = 0; i < 6; i++) {
    const a = base + gauss() * 0.22;
    const p = clamp(bd / 90 + 0.24 + gauss() * 0.14, 0.26, 0.75);
    const sy = -0.1 - Math.random() * 0.5;
    const res = simulateShot(world.balls, world.mode, { angle: a, power: p, spinX: gauss() * 0.3, spinY: sy, cue }, 5);
    const legal = res.firstHit !== null && !res.cueScratch;
    if (legal) {
      chosen = { angle: a, power: p, spinX: 0, spinY: sy, cue };
      if (res.potted.length === 0) break;
    }
  }
  return {
    ...chosen,
    note: "Safety", quality: 0.1, target: bestBall.id, pocketIdx: -1,
  };
}
