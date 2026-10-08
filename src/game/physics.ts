import {
  BALL_D, Cue, GRAV, HEAD_SPOT, HEAD_STRING, INERTIA, MASS, MAX_SPIN_OFFSET,
  OBSTACLES, PHYS, POCKETS, PhysParams, PhysicsMode, R, RACK_ORDER, W, H,
  clamp, cueMaxSpeed, cueSpinFactor, FOOT_SPOT,
} from "./constants";

export interface Ball {
  id: number;
  x: number; y: number;
  vx: number; vy: number;
  /** angular velocity: wx/wy = roll axes, wz = side spin (english) */
  wx: number; wy: number; wz: number;
  on: boolean;
  /** >0 while the pocket-drop animation plays (0..1) */
  drop: number;
  pocketIdx: number;
  /** rolled surface offset used to animate the ball pattern */
  px: number; py: number; prot: number;
  spin: { x: number; y: number };
  /** flash timer used by the renderer after an impact */
  flash: number;
}

export interface ShotEvents {
  firstHit: number | null;
  potted: number[];
  railIds: Set<number>;
  railAfter: Set<number>;
  cushionBeforeBall: boolean;
  maxSpeed: number;
  hits: number;
}

export const emptyEvents = (): ShotEvents => ({
  firstHit: null,
  potted: [],
  railIds: new Set(),
  railAfter: new Set(),
  cushionBeforeBall: false,
  maxSpeed: 0,
  hits: 0,
});

export function makeBall(id: number, x: number, y: number): Ball {
  return {
    id, x, y, vx: 0, vy: 0, wx: 0, wy: 0, wz: 0,
    on: true, drop: 0, pocketIdx: -1, px: 0, py: 0, prot: 0,
    spin: { x: 0, y: 0 }, flash: 0,
  };
}

/** Standard 8-ball rack: apex on the foot spot, 8-ball in the heart. */
export function rackBalls(): Ball[] {
  const balls: Ball[] = [makeBall(0, HEAD_SPOT.x, HEAD_SPOT.y)];
  const gap = BALL_D * 1.008;
  let idx = 0;
  for (let row = 0; row < 5; row++) {
    for (let i = 0; i <= row; i++) {
      const id = RACK_ORDER[idx++];
      const x = FOOT_SPOT.x + row * gap * 0.8660254;
      const y = FOOT_SPOT.y + (i - row / 2) * gap;
      const b = makeBall(id, x, y);
      b.prot = Math.random() * Math.PI * 2;
      balls.push(b);
    }
  }
  return balls;
}

export type ImpactKind = "ball" | "cushion" | "pocket";

export class World {
  balls: Ball[] = [];
  mode: PhysicsMode;
  P: PhysParams;
  events: ShotEvents = emptyEvents();
  time = 0;
  onImpact: ((kind: ImpactKind, v: number, x: number, y: number) => void) | null = null;

  constructor(mode: PhysicsMode = "high", balls?: Ball[]) {
    this.mode = mode;
    this.P = PHYS[mode];
    this.balls = balls ?? rackBalls();
  }

  setMode(mode: PhysicsMode) {
    this.mode = mode;
    this.P = PHYS[mode];
  }

  resetEvents() {
    this.events = emptyEvents();
  }

  cue(): Ball {
    return this.balls[0];
  }

  byId(id: number) {
    return this.balls.find((b) => b.id === id);
  }

  activeBalls() {
    return this.balls.filter((b) => b.on && b.drop === 0);
  }

  moving(): boolean {
    for (const b of this.balls) {
      if (b.drop > 0 && b.drop < 1) return true;
      if (!b.on) continue;
      if (Math.abs(b.vx) > 0.01 || Math.abs(b.vy) > 0.01) return true;
      // residual roll spin can still move the ball (draw / follow), side spin cannot
      if (Math.abs(b.wx) > 1.2 || Math.abs(b.wy) > 1.2) return true;
    }
    return false;
  }

  maxSpeed() {
    let m = 0;
    for (const b of this.balls) if (b.on) m = Math.max(m, Math.hypot(b.vx, b.vy));
    return m;
  }

  /* ----------------------------------------------------------------*/

  strike(power01: number, spinX: number, spinY: number, angle: number, cue: Cue) {
    const c = this.cue();
    if (!c.on) return;
    const power = clamp(power01, 0.04, 1);
    const speed = cueMaxSpeed(cue) * power;
    this.resetEvents();

    let ang = angle;
    if (this.mode === "high") {
      // cue-ball deflection ("squirt") away from the english side
      const squirtDeg = this.P.squirt * spinX * (2.05 - (cue.spin / 100) * 0.85) * (0.45 + power * 0.55);
      ang = angle - (squirtDeg * Math.PI) / 180;
    }

    const cc = Math.cos(ang), ss = Math.sin(ang);
    c.vx = cc * speed;
    c.vy = ss * speed;
    c.spin = { x: spinX, y: spinY };
    c.flash = 1;

    if (this.mode === "high") {
      const f = cueSpinFactor(cue);
      const a = clamp(spinX * MAX_SPIN_OFFSET * R * f, -0.72 * R, 0.72 * R);
      const b = clamp(spinY * MAX_SPIN_OFFSET * R * f, -0.72 * R, 0.72 * R);
      const J = 1.5 * speed * MASS;
      c.wx = clamp((b * ss * J) / INERTIA, -1200, 1200);
      c.wy = clamp((-b * cc * J) / INERTIA, -1200, 1200);
      c.wz = clamp((-a * J) / INERTIA, -460, 460);
    } else {
      c.wx = c.wy = c.wz = 0;
    }
    this.events.maxSpeed = speed;
  }

  /* ---------------- integration --------------------------------- */

  step(dtRaw: number) {
    const dt = Math.min(dtRaw, 1 / 25);
    let maxV = 0;
    for (const b of this.balls) if (b.on) maxV = Math.max(maxV, Math.hypot(b.vx, b.vy));
    const sub = clamp(Math.ceil((maxV * dt) / (R * 0.32)), 1, 48);
    const h = dt / sub;
    for (let i = 0; i < sub; i++) this.substep(h);
    this.time += dt;
    for (const b of this.balls) if (b.flash > 0) b.flash = Math.max(0, b.flash - dt * 4);
  }

  private substep(h: number) {
    const P = this.P;
    const circ = Math.PI * 2 * R;
    for (const b of this.balls) {
      if (b.drop > 0) {
        if (b.drop < 1) b.drop = Math.min(1, b.drop + h * 3.4);
        else b.on = false;
        continue;
      }
      if (!b.on) continue;

      let speed = Math.hypot(b.vx, b.vy);
      const cvx = b.vx + b.wy * R;
      const cvy = b.vy - b.wx * R;
      const cs = Math.hypot(cvx, cvy);

      if (cs > 0.75) {
        /* sliding: kinetic cloth friction acts at the contact point */
        const f = P.slide * GRAV;
        const ux = cvx / cs, uy = cvy / cs;
        b.vx -= f * ux * h;
        b.vy -= f * uy * h;
        b.wx += ((2.5 * P.slide * GRAV * uy) / R) * h;
        b.wy += ((-2.5 * P.slide * GRAV * ux) / R) * h;
      } else {
        /* rolling resistance + quadratic cloth drag */
        if (speed > 1e-4) {
          const dec = P.roll * GRAV + P.drag * speed * speed;
          const dv = Math.min(speed, dec * h);
          b.vx -= (b.vx / speed) * dv;
          b.vy -= (b.vy / speed) * dv;
          speed -= dv;
        }
        b.wx = b.vy / R;
        b.wy = -b.vx / R;
        if (speed < P.stopSpeed) {
          b.vx = 0; b.vy = 0; b.wx = 0; b.wy = 0;
        }
      }

      /* swerve: side spin curves the trajectory (massé-lite) */
      if (P.swerve > 0 && b.wz !== 0 && speed > 5) {
        const sw = clamp((-b.wz * R) / (speed * 3.4 + 30), -1, 1);
        const k = P.swerve * GRAV * sw * h;
        b.vx += k * (-b.vy / speed);
        b.vy += k * (b.vx / speed);
      }

      /* spinning friction on the vertical axis */
      if (P.spin > 0) {
        const dec = ((2.5 * P.spin * GRAV) / R) * h;
        if (Math.abs(b.wz) <= dec) b.wz = 0;
        else b.wz -= Math.sign(b.wz) * dec;
      } else if (b.wz !== 0) {
        b.wz *= 1 - Math.min(1, 3 * h);
      }

      b.x += b.vx * h;
      b.y += b.vy * h;
      b.px = wrap(b.px + b.vx * h, circ);
      b.py = wrap(b.py + b.vy * h, circ);
      b.prot += b.wz * h;
    }

    this.collideBalls();
    this.collideObstacles();
    this.checkPockets();
  }

  private collideBalls() {
    const bs = this.balls;
    for (let i = 0; i < bs.length; i++) {
      const a = bs[i];
      if (!a.on || a.drop > 0) continue;
      for (let j = i + 1; j < bs.length; j++) {
        const b = bs[j];
        if (!b.on || b.drop > 0) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= BALL_D * BALL_D || d2 < 1e-9) continue;
        const d = Math.sqrt(d2);
        const nx = dx / d, ny = dy / d;
        const ov = (BALL_D - d) * 0.5;
        a.x -= nx * ov; a.y -= ny * ov;
        b.x += nx * ov; b.y += ny * ov;
        this.resolveBall(a, b, nx, ny);
      }
    }
  }

  /** Full impulse resolution: restitution + tangential friction (throw)
   *  including vertical spin exchange (draw / follow transfer). */
  private resolveBall(a: Ball, b: Ball, nx: number, ny: number) {
    const P = this.P;
    const tx = -ny, ty = nx;

    const sa_x = a.vx - R * a.wz * ny;
    const sa_y = a.vy + R * a.wz * nx;
    const sa_z = R * (a.wx * ny - a.wy * nx);
    const sb_x = b.vx + R * b.wz * ny;
    const sb_y = b.vy - R * b.wz * nx;
    const sb_z = -R * (b.wx * ny - b.wy * nx);

    const ux = sa_x - sb_x, uy = sa_y - sb_y, uz = sa_z - sb_z;
    const un = ux * nx + uy * ny;
    if (un <= 0) return;

    const e = clamp(P.ballE - 0.00032 * un, 0.85, P.ballE);
    const jn = ((1 + e) * un) / 2;
    a.vx -= jn * nx; a.vy -= jn * ny;
    b.vx += jn * nx; b.vy += jn * ny;

    if (P.ballMu > 0) {
      const ut = ux * tx + uy * ty;
      const slip = Math.hypot(ut, uz);
      if (slip > 0.02) {
        const jt = Math.min(P.ballMu * jn, slip / 6);
        const fx = (-jt * ut) / slip; // along tangent
        const fz = (-jt * uz) / slip; // along vertical
        a.vx += fx * tx; a.vy += fx * ty;
        b.vx -= fx * tx; b.vy -= fx * ty;
        const dwz = (R * fx) / INERTIA;
        a.wz += dwz; b.wz += dwz;
        a.wx += (R * ny * fz) / INERTIA; a.wy += (-R * nx * fz) / INERTIA;
        b.wx += (R * ny * fz) / INERTIA; b.wy += (-R * nx * fz) / INERTIA;
      }
    }

    a.flash = Math.max(a.flash, Math.min(1, un / 220));
    b.flash = Math.max(b.flash, Math.min(1, un / 220));
    this.events.hits++;
    if (this.events.firstHit === null && (a.id === 0 || b.id === 0)) {
      this.events.firstHit = a.id === 0 ? b.id : a.id;
    }
    this.onImpact?.("ball", un, (a.x + b.x) / 2, (a.y + b.y) / 2);
  }

  private collideObstacles() {
    for (const b of this.balls) {
      if (!b.on || b.drop > 0) continue;
      for (let s = 0; s < OBSTACLES.length; s++) {
        const seg = OBSTACLES[s];
        const dx = seg.bx - seg.ax, dy = seg.by - seg.ay;
        const l2 = dx * dx + dy * dy;
        let t = ((b.x - seg.ax) * dx + (b.y - seg.ay) * dy) / l2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const cx = seg.ax + dx * t, cy = seg.ay + dy * t;
        let nx = b.x - cx, ny = b.y - cy;
        const d2 = nx * nx + ny * ny;
        if (d2 >= R * R) continue;
        let d = Math.sqrt(d2);
        if (d < 1e-6) { nx = 0; ny = -1; d = 1e-6; }
        nx /= d; ny /= d;
        b.x = cx + nx * R; b.y = cy + ny * R;
        const vn = b.vx * nx + b.vy * ny;
        if (vn < 0) this.cushion(b, nx, ny, -vn, seg.kind === "jaw");
      }
    }
  }

  private cushion(b: Ball, nx: number, ny: number, speed: number, jaw: boolean) {
    const P = this.P;
    const cap = jaw ? 0.42 : 0.56;
    const e = clamp(P.cushE - 0.00078 * speed, cap, P.cushE);
    const jn = (1 + e) * speed;
    b.vx += jn * nx; b.vy += jn * ny;

    if (P.cushMu > 0) {
      const tx = -ny, ty = nx;
      const vt = b.vx * tx + b.vy * ty;
      const surf = vt - R * b.wz;
      const jtMax = P.cushMu * jn;
      const jt = clamp((-surf * 2) / 7, -jtMax, jtMax);
      b.vx += jt * tx; b.vy += jt * ty;
      b.wz += (-R * jt) / INERTIA;
    }
    b.flash = Math.max(b.flash, Math.min(1, speed / 200));

    this.events.railIds.add(b.id);
    if (this.events.firstHit !== null) this.events.railAfter.add(b.id);
    else if (b.id === 0) this.events.cushionBeforeBall = true;
    this.onImpact?.("cushion", speed, b.x, b.y);
  }

  private checkPockets() {
    const P = this.P;
    for (const b of this.balls) {
      if (!b.on || b.drop > 0) continue;
      let cap = -1;
      for (let i = 0; i < POCKETS.length; i++) {
        const p = POCKETS[i];
        const rr = p.cr + P.capture;
        const dx = b.x - p.x, dy = b.y - p.y;
        if (dx * dx + dy * dy < rr * rr) { cap = i; break; }
      }
      if (cap < 0 && (b.x < 0 || b.x > W || b.y < 0 || b.y > H)) {
        let best = 0, bd = Infinity;
        for (let i = 0; i < POCKETS.length; i++) {
          const p = POCKETS[i];
          const d = (b.x - p.x) ** 2 + (b.y - p.y) ** 2;
          if (d < bd) { bd = d; best = i; }
        }
        cap = best;
      }
      if (cap >= 0) {
        b.drop = 0.001;
        b.pocketIdx = cap;
        b.vx = b.vy = 0; b.wx = b.wy = b.wz = 0;
        this.events.potted.push(b.id);
        this.onImpact?.("pocket", 1, POCKETS[cap].x, POCKETS[cap].y);
      }
    }
  }

  /* ---------------- helpers -------------------------------------- */

  validCuePlacement(x: number, y: number, kitchenOnly: boolean) {
    if (x < R + 0.05 || x > W - R - 0.05 || y < R + 0.05 || y > H - R - 0.05) return false;
    if (kitchenOnly && x > HEAD_STRING - R) return false;
    for (const p of POCKETS) {
      if (Math.hypot(x - p.x, y - p.y) < p.cr + R + 0.6) return false;
    }
    for (const b of this.balls) {
      if (b.id === 0 || !b.on) continue;
      if (Math.hypot(x - b.x, y - b.y) < BALL_D + 0.08) return false;
    }
    return true;
  }

  /** nearest legal spot to a desired position (used by ball-in-hand) */
  nearestLegal(x: number, y: number, kitchenOnly: boolean) {
    if (this.validCuePlacement(x, y, kitchenOnly)) return { x, y };
    let best = { x: HEAD_SPOT.x, y: HEAD_SPOT.y }, bd = Infinity;
    for (let a = 0; a < 64; a++) {
      for (let r = 0.6; r < 26; r += 0.9) {
        const ang = (a / 64) * Math.PI * 2;
        const px = x + Math.cos(ang) * r, py = y + Math.sin(ang) * r;
        if (!this.validCuePlacement(px, py, kitchenOnly)) continue;
        const d = (px - x) ** 2 + (py - y) ** 2;
        if (d < bd) { bd = d; best = { x: px, y: py }; }
        if (bd < 0.5) return best;
      }
    }
    return best;
  }
}

function wrap(v: number, c: number) {
  let r = v % c;
  if (r > c / 2) r -= c;
  if (r < -c / 2) r += c;
  return r;
}

export interface ShotSpec {
  angle: number;
  power: number;
  spinX: number;
  spinY: number;
  cue: Cue;
}

export interface SimResult {
  potted: number[];
  firstHit: number | null;
  cueScratch: boolean;
  cueEnd: { x: number; y: number };
  balls: Ball[];
  settled: boolean;
  time: number;
}

/** Headless shot simulation used by the AI to evaluate candidate shots. */
export function simulateShot(
  balls: Ball[], mode: PhysicsMode, shot: ShotSpec, maxTime = 6.5,
): SimResult {
  const w = new World(mode, balls.map((b) => ({ ...b })));
  w.P = PHYS[mode];
  w.strike(shot.power, shot.spinX, shot.spinY, shot.angle, shot.cue);
  let t = 0;
  const dt = 1 / 90;
  while (t < maxTime && w.moving()) {
    w.step(dt);
    t += dt;
  }
  const cue = w.cue();
  return {
    potted: w.events.potted.slice(),
    firstHit: w.events.firstHit,
    cueScratch: w.events.potted.includes(0),
    cueEnd: { x: cue.x, y: cue.y },
    balls: w.balls,
    settled: !w.moving(),
    time: t,
  };
}
