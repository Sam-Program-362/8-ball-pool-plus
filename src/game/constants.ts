/* ------------------------------------------------------------------
   8-BALL POOL — core constants, table geometry & content catalogue
   All playfield dimensions are in INCHES (a 9ft tournament table).
   Screen space: +x right, +y down, +z into the screen (right handed).
-------------------------------------------------------------------*/

export type PhysicsMode = "high" | "simple";
export type Group = "solids" | "stripes" | null;

export const W = 100; // playfield width  (long rail)
export const H = 50; // playfield height (short rail)
export const R = 1.125; // ball radius (2.25" diameter)
export const BALL_D = R * 2;
export const GRAV = 385.8; // in / s^2
export const MASS = 1;
export const INERTIA = 0.4 * MASS * R * R; // solid sphere

export const FRAME = 8.2; // wooden frame thickness around the cloth
export const HEAD_STRING = W * 0.25; // the "kitchen"
export const FOOT_SPOT = { x: W * 0.75, y: H / 2 };
export const HEAD_SPOT = { x: W * 0.25, y: H / 2 };

const CB = 4.35; // corner cushion setback
const SB = 3.2; // side cushion setback
const CD = 3.5; // corner throat depth
const SD = 3.1; // side throat depth

export interface Seg {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  kind: "rail" | "jaw";
}

function seg(ax: number, ay: number, bx: number, by: number, kind: "rail" | "jaw"): Seg {
  return { ax, ay, bx, by, kind };
}

/* Cushion noses ---------------------------------------------------*/
export const RAILS: Seg[] = [
  seg(CB, 0, W / 2 - SB, 0, "rail"),
  seg(W / 2 + SB, 0, W - CB, 0, "rail"),
  seg(CB, H, W / 2 - SB, H, "rail"),
  seg(W / 2 + SB, H, W - CB, H, "rail"),
  seg(0, CB, 0, H - CB, "rail"),
  seg(W, CB, W, H - CB, "rail"),
];

/* Pocket throats: two angled jaws + a back wall per pocket.
   They funnel the ball into the capture circle and produce rattles. */
export const JAWS: Seg[] = [];

/* corner pockets, each: mouth ends -> throat -> back wall */
const CORNERS: [number, number, number, number][] = [
  // px, py, sx (x direction into field), sy (y direction into field)
  [0, 0, 1, 1],
  [W, 0, -1, 1],
  [0, H, 1, -1],
  [W, H, -1, -1],
];
const cd = CD * 0.7071;
for (const [px, py, sx, sy] of CORNERS) {
  const longEnd = { x: px + sx * CB, y: py }; // end of the long/horizontal cushion
  const shortEnd = { x: px, y: py + sy * CB }; // end of the vertical cushion
  const a = { x: longEnd.x - sx * cd, y: longEnd.y - sy * cd };
  const b = { x: shortEnd.x - sx * cd, y: shortEnd.y - sy * cd };
  JAWS.push(seg(longEnd.x, longEnd.y, a.x, a.y, "jaw"));
  JAWS.push(seg(shortEnd.x, shortEnd.y, b.x, b.y, "jaw"));
  JAWS.push(seg(a.x, a.y, b.x, b.y, "jaw")); // throat back wall
}

/* side pockets */
for (const py of [0, H]) {
  const dir = py === 0 ? -1 : 1; // throat points outside the field
  const l = { x: W / 2 - SB, y: py };
  const r = { x: W / 2 + SB, y: py };
  const a = { x: W / 2 - SB + 0.75, y: py + dir * SD };
  const b = { x: W / 2 + SB - 0.75, y: py + dir * SD };
  JAWS.push(seg(l.x, l.y, a.x, a.y, "jaw"));
  JAWS.push(seg(r.x, r.y, b.x, b.y, "jaw"));
  JAWS.push(seg(a.x, a.y, b.x, b.y, "jaw"));
}

export const OBSTACLES: Seg[] = [...RAILS, ...JAWS];

export interface PocketDef {
  x: number;
  y: number;
  vr: number; // visual hole radius
  cr: number; // capture radius
  kind: "corner" | "side";
  ang: number; // facing angle (for pocket-mouth shading)
}

export const POCKETS: PocketDef[] = [
  { x: -0.75, y: -0.75, vr: 2.95, cr: 2.34, kind: "corner", ang: Math.PI * 0.25 },
  { x: W + 0.75, y: -0.75, vr: 2.95, cr: 2.34, kind: "corner", ang: Math.PI * 0.75 },
  { x: -0.75, y: H + 0.75, vr: 2.95, cr: 2.34, kind: "corner", ang: -Math.PI * 0.25 },
  { x: W + 0.75, y: H + 0.75, vr: 2.95, cr: 2.34, kind: "corner", ang: -Math.PI * 0.75 },
  { x: W / 2, y: -0.62, vr: 2.85, cr: 2.26, kind: "side", ang: Math.PI / 2 },
  { x: W / 2, y: H + 0.62, vr: 2.85, cr: 2.26, kind: "side", ang: -Math.PI / 2 },
];

/* ------------------------------------------------------------------
   Physics tuning.  "high" = full rigid body model (spin, english,
   throw, swerve, squirt, speed dependent restitution).
   "simple" = arcade model used by casual pool games.
-------------------------------------------------------------------*/
export interface PhysParams {
  slide: number; // sliding (cloth) friction coefficient
  roll: number; // rolling resistance coefficient
  drag: number; // quadratic cloth drag
  spin: number; // spinning friction coefficient
  stopSpeed: number; // below this the ball is at rest (in/s)
  ballE: number; // ball-ball restitution
  ballMu: number; // ball-ball friction  (throw)
  cushE: number; // cushion restitution
  cushMu: number; // cushion friction (english off the rail)
  swerve: number; // lateral curve from side spin
  squirt: number; // cue-ball deflection from english
  capture: number; // extra capture radius bonus
}

export const PHYS: Record<PhysicsMode, PhysParams> = {
  high: {
    slide: 0.2,
    roll: 0.05,
    drag: 0.0025,
    spin: 0.11,
    stopSpeed: 5.5,
    ballE: 0.975,
    ballMu: 0.062,
    cushE: 0.84,
    cushMu: 0.2,
    swerve: 0.055,
    squirt: 1,
    capture: 0,
  },
  simple: {
    slide: 0.2,
    roll: 0.058,
    drag: 0.0029,
    spin: 0,
    stopSpeed: 6.5,
    ballE: 1.0,
    ballMu: 0,
    cushE: 0.92,
    cushMu: 0,
    swerve: 0,
    squirt: 0,
    capture: 0.22,
  },
};

/* ------------------------------------------------------------------
   Balls
-------------------------------------------------------------------*/
export const BALL_COLORS: Record<number, string> = {
  0: "#f7f4ec",
  1: "#f5c518",
  2: "#1c46c9",
  3: "#d81f2a",
  4: "#7a2ea8",
  5: "#f4761b",
  6: "#0e8f42",
  7: "#8d2430",
  8: "#151515",
  9: "#f5c518",
  10: "#1c46c9",
  11: "#d81f2a",
  12: "#7a2ea8",
  13: "#f4761b",
  14: "#0e8f42",
  15: "#8d2430",
};

export const isStripe = (id: number) => id >= 9 && id <= 15;
export const isSolid = (id: number) => id >= 1 && id <= 7;
export const groupOf = (id: number): Group =>
  isSolid(id) ? "solids" : isStripe(id) ? "stripes" : null;

/* Rack order for a standard 8-ball rack (8 in the middle, corners mixed) */
export const RACK_ORDER = [1, 9, 2, 10, 8, 11, 3, 12, 6, 15, 13, 4, 14, 7, 5];

/* ------------------------------------------------------------------
   Cues
-------------------------------------------------------------------*/
export interface Cue {
  id: string;
  name: string;
  price: number;
  power: number; // 0..100
  spin: number;
  aim: number;
  time: number;
  wood: [string, string];
  wrap: string;
  accent: string;
  ring: string;
}

export const CUES: Cue[] = [
  { id: "rookie", name: "Rookie Maple", price: 0, power: 18, spin: 14, aim: 24, time: 18, wood: ["#d9b27c", "#8d5f30"], wrap: "#2b2b2b", accent: "#e6d3b0", ring: "#c9a227" },
  { id: "walnut", name: "Walnut Classic", price: 900, power: 32, spin: 28, aim: 38, time: 30, wood: ["#8a5a33", "#43260f"], wrap: "#1d1d22", accent: "#d8c39a", ring: "#c9a227" },
  { id: "crimson", name: "Crimson Fang", price: 3200, power: 46, spin: 44, aim: 52, time: 44, wood: ["#b03a3a", "#4d1414"], wrap: "#16161a", accent: "#ffd9a8", ring: "#e0b64c" },
  { id: "ice", name: "Ice Breaker", price: 8500, power: 58, spin: 62, aim: 66, time: 58, wood: ["#a8d8e8", "#31617a"], wrap: "#101a22", accent: "#e8fbff", ring: "#9fd8ea" },
  { id: "gold", name: "Golden Empire", price: 20000, power: 72, spin: 70, aim: 78, time: 70, wood: ["#e8bd52", "#8a5c11"], wrap: "#1a1206", accent: "#fff3c4", ring: "#ffd76a" },
  { id: "viper", name: "Carbon Viper", price: 42000, power: 84, spin: 86, aim: 88, time: 82, wood: ["#4a4f57", "#15181c"], wrap: "#0b0d10", accent: "#8ef0a5", ring: "#57d97a" },
  { id: "dragon", name: "Dragon Slayer", price: 85000, power: 92, spin: 94, aim: 94, time: 90, wood: ["#c04a1e", "#3a1207"], wrap: "#170a06", accent: "#ffcf7a", ring: "#ff8a3c" },
  { id: "celestial", name: "Celestial Ace", price: 160000, power: 100, spin: 100, aim: 100, time: 100, wood: ["#f3e7cf", "#6d5a3a"], wrap: "#0f1420", accent: "#ffffff", ring: "#ffe9a8" },
];

export const cueById = (id: string) => CUES.find((c) => c.id === id) ?? CUES[0];

/* ------------------------------------------------------------------
   Table skins
-------------------------------------------------------------------*/
export interface Skin {
  id: string;
  name: string;
  price: number;
  felt: string;
  feltDeep: string;
  feltLight: string;
  wood: [string, string, string];
  leather: string;
  diamond: string;
  ui: string;
}

export const SKINS: Skin[] = [
  {
    id: "emerald", name: "Tournament Emerald", price: 0,
    felt: "#166b48", feltDeep: "#0a3f2a", feltLight: "#2a9066",
    wood: ["#6b3d1e", "#3a1f0d", "#8a5a30"], leather: "#2c1a10", diamond: "#e8d9a8", ui: "#2a9066",
  },
  {
    id: "sapphire", name: "Sapphire Pro", price: 0,
    felt: "#1a5488", feltDeep: "#0b2b4a", feltLight: "#2f7cba",
    wood: ["#3a2a1c", "#1c120a", "#5c4229"], leather: "#1b1410", diamond: "#dbe7f5", ui: "#2f7cba",
  },
  {
    id: "crimson", name: "Crimson Lounge", price: 3500,
    felt: "#8d2233", feltDeep: "#4a0f1a", feltLight: "#b8394c",
    wood: ["#2e1b12", "#150c07", "#4a2c1c"], leather: "#1d0f0a", diamond: "#f0d2a0", ui: "#b8394c",
  },
  {
    id: "graphite", name: "Graphite Night", price: 9000,
    felt: "#2f3a3f", feltDeep: "#161d20", feltLight: "#4a585e",
    wood: ["#4a3626", "#241811", "#6b4e35"], leather: "#14100c", diamond: "#e6c07a", ui: "#7f9099",
  },
  {
    id: "goldleaf", name: "Gold Leaf Royale", price: 24000,
    felt: "#146b52", feltDeep: "#07382a", feltLight: "#28916f",
    wood: ["#c79a3c", "#6d4c12", "#f0d27a"], leather: "#3a2410", diamond: "#fff2c0", ui: "#e3bd5c",
  },
];

export const skinById = (id: string) => SKINS.find((s) => s.id === id) ?? SKINS[0];

/* ------------------------------------------------------------------
   Opponents / difficulty
-------------------------------------------------------------------*/
export interface Difficulty {
  id: string;
  name: string;
  tag: string;
  noise: number; // aim error in degrees
  powerNoise: number;
  smart: number; // 0..1 candidate quality
  think: [number, number]; // ms
  clock: number; // seconds
  reward: number;
  xp: number;
  accent: string;
}

export const DIFFS: Difficulty[] = [
  { id: "rookie", name: "Rookie", tag: "Warm up", noise: 3.4, powerNoise: 0.16, smart: 0.4, think: [700, 1200], clock: 45, reward: 55, xp: 25, accent: "#5fbf7f" },
  { id: "pro", name: "Pro", tag: "Sharp angles", noise: 1.8, powerNoise: 0.1, smart: 0.65, think: [800, 1500], clock: 35, reward: 130, xp: 55, accent: "#4fa3e0" },
  { id: "champ", name: "Champion", tag: "Runs racks", noise: 0.85, powerNoise: 0.055, smart: 0.85, think: [900, 1700], clock: 30, reward: 300, xp: 110, accent: "#e0a13c" },
  { id: "legend", name: "Legend", tag: "Near perfect", noise: 0.32, powerNoise: 0.028, smart: 1, think: [1000, 1900], clock: 25, reward: 700, xp: 220, accent: "#d8484f" },
];

export const diffById = (id: string) => DIFFS.find((d) => d.id === id) ?? DIFFS[0];

/* Derived cue helpers ------------------------------------------------*/
export const cueMaxSpeed = (c: Cue) => 246 + c.power * 1.4; // in/s
export const cueSpinFactor = (c: Cue) => 0.55 + (c.spin / 100) * 0.85;
export const cueAimLen = (c: Cue) => 0.4 + (c.aim / 100) * 0.6; // fraction of table
export const cueBounces = (c: Cue) => (c.aim >= 72 ? 2 : c.aim >= 40 ? 1 : 0);
export const cueClock = (c: Cue, d: Difficulty) => Math.round(d.clock + (c.time / 100) * 20);

export const MAX_SPIN_OFFSET = 0.58; // fraction of the ball radius

/* Level curve */
export const xpForLevel = (lvl: number) => 120 + (lvl - 1) * 85;

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
