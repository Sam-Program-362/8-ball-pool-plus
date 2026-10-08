import {
  Cue, Difficulty, FOOT_SPOT, Group, HEAD_SPOT, PhysicsMode, R, W, H,
  cueById, groupOf, isStripe,
} from "./constants";
import { Ball, ShotSpec, World, rackBalls } from "./physics";

export interface PlayerState {
  name: string;
  isAI: boolean;
  group: Group;
  fouls: number;
  potted: number[];
  run: number;
}

export interface MatchConfig {
  mode: PhysicsMode;
  diff: Difficulty;
  cue: Cue;
  twoPlayer: boolean;
  timer: boolean;
  aiCue?: Cue;
}

export type Phase = "aim" | "place" | "roll" | "over";

export interface Toast {
  id: number;
  text: string;
  sub?: string;
  kind: "info" | "foul" | "good" | "warn" | "big";
}

export interface ShotOutcome {
  toasts: Toast[];
  switchTurn: boolean;
  gameOver: boolean;
  winner: 0 | 1 | null;
  reason: string;
  potted: number[];
  foul: boolean;
  assigned: Group;
  reward: number;
}

let toastId = 1;
const mkToast = (text: string, kind: Toast["kind"], sub?: string): Toast => ({ id: toastId++, text, kind, sub });

export class Match {
  world: World;
  cfg: MatchConfig;
  players: [PlayerState, PlayerState];
  current: 0 | 1 = 0;
  openTable = true;
  isBreak = true;
  ballInHand = false;
  kitchenOnly = false;
  phase: Phase = "aim";
  winner: 0 | 1 | null = null;
  reason = "";
  shotNumber = 0;
  /** legal first-contact ids captured when the shot was taken */
  shotTargets: number[] = [];
  shotWasOpen = true;
  lastOutcome: ShotOutcome | null = null;
  stats = { pots: 0, bestBreak: 0, longestRun: 0 };

  constructor(cfg: MatchConfig) {
    this.cfg = cfg;
    this.world = new World(cfg.mode, rackBalls());
    this.players = [
      { name: "You", isAI: false, group: null, fouls: 0, potted: [], run: 0 },
      {
        name: cfg.twoPlayer ? "Player 2" : `${cfg.diff.name} CPU`,
        isAI: !cfg.twoPlayer,
        group: null, fouls: 0, potted: [], run: 0,
      },
    ];
  }

  /* -------------------------------------------------------------- */

  remaining(group: Group): number[] {
    return this.world.balls
      .filter((b) => b.on && group !== null && groupOf(b.id) === group)
      .map((b) => b.id);
  }

  /** balls still on the table for a player (or the 8 when cleared) */
  rackFor(idx: 0 | 1): number[] {
    const p = this.players[idx];
    if (!p.group) return [];
    const left = this.remaining(p.group);
    return left.length ? left : [8];
  }

  onEight(idx: 0 | 1): boolean {
    const p = this.players[idx];
    return !!p.group && this.remaining(p.group).length === 0;
  }

  /** ids the shooter may legally contact first */
  legalTargets(): number[] {
    const p = this.players[this.current];
    const onTable = this.world.balls.filter((b) => b.on).map((b) => b.id);
    if (p.group && !this.openTable) {
      if (this.onEight(this.current)) return [8];
      return onTable.filter((id) => groupOf(id) === p.group);
    }
    // break / open table: any object ball, never the 8
    return onTable.filter((id) => id !== 0 && id !== 8);
  }

  anyLegalBallVisible(): number[] {
    const t = this.legalTargets();
    return t.length ? t : this.world.balls.filter((b) => b.on && b.id !== 0).map((b) => b.id);
  }

  cueBall(): Ball {
    return this.world.cue();
  }

  /* -------------------------------------------------------------- */

  shoot(spec: ShotSpec) {
    if (this.phase !== "aim") return;
    // snapshot legality *before* the shot — balls disappear as they are potted
    this.shotTargets = this.legalTargets();
    this.shotWasOpen = this.openTable;
    this.phase = "roll";
    this.shotNumber++;
    this.world.resetEvents();
    this.world.strike(spec.power, spec.spinX, spec.spinY, spec.angle, spec.cue);
  }

  /** shot clock expired */
  timeout(): ShotOutcome {
    const out = this.applyFoul("Shot clock expired", []);
    this.phase = out.gameOver ? "over" : "place";
    this.lastOutcome = out;
    return out;
  }

  /** called once every ball has stopped after a shot */
  settle(): ShotOutcome {
    const ev = this.world.events;
    const me = this.current;
    const opp = (1 - me) as 0 | 1;
    const potted = ev.potted.slice();
    const objPotted = potted.filter((i) => i !== 0);
    const scratch = potted.includes(0);
    const eight = potted.includes(8);
    const targets = this.shotTargets.length ? this.shotTargets : this.legalTargets();
    const toasts: Toast[] = [];
    let foul: string | null = null;

    /* --- legality ------------------------------------------------ */
    if (scratch) foul = "Scratch";
    if (!foul && ev.firstHit === null) foul = "No ball contacted";
    if (!foul && ev.firstHit !== null && !targets.includes(ev.firstHit)) {
      const hitGroup = ev.firstHit === 8 ? "the 8-ball" : isStripe(ev.firstHit) ? "a stripe" : "a solid";
      foul = `Wrong ball first — ${hitGroup}`;
    }
    if (!foul && !this.isBreak && ev.firstHit !== null && objPotted.length === 0 && ev.railAfter.size === 0) {
      foul = "No rail after contact";
    }
    if (!foul && this.isBreak && ev.railIds.size < 4 && objPotted.length === 0) {
      foul = "Illegal break — drive 4 balls to a rail";
    }

    /* --- 8-ball on the break: re-spot, keep shooting -------------- */
    if (eight && this.isBreak) {
      this.respot(8);
      toasts.push(mkToast("8-ball on the break", "info", "Re-spotted — table stays open"));
      const i = potted.indexOf(8);
      if (i >= 0) potted.splice(i, 1);
      objPotted.splice(objPotted.indexOf(8), 1);
    }

    /* --- groups --------------------------------------------------- */
    let assigned: Group = null;
    const meP = this.players[me];
    if (!foul && !this.isBreak && this.shotWasOpen && this.openTable && objPotted.length > 0) {
      assigned = groupOf(objPotted[0]);
      meP.group = assigned;
      this.players[opp].group = assigned === "solids" ? "stripes" : "solids";
      this.openTable = false;
      toasts.push(
        mkToast(`${this.players[me].name}: ${assigned === "solids" ? "SOLIDS (1-7)" : "STRIPES (9-15)"}`, "good"),
      );
    }

    /* --- bookkeeping ---------------------------------------------- */
    for (const id of objPotted) {
      const g = groupOf(id);
      if (g && meP.group === g) {
        meP.potted.push(id);
        meP.run++;
      } else if (g && meP.group) {
        this.players[opp].potted.push(id);
      } else {
        meP.run++; // open table / break: the pot still keeps the run alive
      }
      if (id !== 8) this.stats.pots++;
    }
    if (this.isBreak && objPotted.length > this.stats.bestBreak) this.stats.bestBreak = objPotted.length;
    if (!foul) this.players[me].run = meP.run;
    else this.players[me].run = 0;
    this.stats.longestRun = Math.max(this.stats.longestRun, this.players[me].run);

    /* --- 8-ball resolution ----------------------------------------- */
    if (eight && !this.isBreak) {
      const legalEight = this.onEightBefore(me, objPotted) && !foul;
      if (legalEight && !scratch) {
        return this.finish(me, "8-ball potted — clean win", toasts, potted, assigned);
      }
      const why = scratch
        ? "Scratched on the 8-ball"
        : !this.onEightBefore(me, objPotted)
          ? "8-ball potted too early"
          : "8-ball potted on a foul";
      return this.finish(opp, why, toasts, potted, assigned);
    }

    /* --- fouls ------------------------------------------------------- */
    if (foul) return this.applyFoul(foul, potted, toasts, assigned);

    /* --- clean shot --------------------------------------------------- */
    meP.fouls = 0;
    const ownPot = objPotted.some((id) => {
      const g = groupOf(id);
      return meP.group ? g === meP.group : true;
    });
    const keepTurn = ownPot && objPotted.length > 0;
    if (ownPot && objPotted.length) {
      toasts.push(mkToast(objPotted.length > 1 ? `${objPotted.length} balls potted!` : "Nice pot", "good"));
    }
    this.isBreak = false;
    this.lastOutcome = {
      toasts, switchTurn: !keepTurn, gameOver: false, winner: null, reason: "",
      potted, foul: false, assigned, reward: 0,
    };
    if (!keepTurn) {
      this.current = opp;
      this.players[opp].run = 0;
    }
    this.ballInHand = false;
    this.kitchenOnly = false;
    this.phase = "aim";
    return this.lastOutcome;
  }

  /** was the shooter already on the 8 *before* this shot's pots landed? */
  private onEightBefore(idx: 0 | 1, objPotted: number[]) {
    const p = this.players[idx];
    if (!p.group) return false;
    const left = this.remaining(p.group).filter((id) => !objPotted.includes(id));
    return left.length === 0;
  }

  private applyFoul(why: string, potted: number[], toasts: Toast[] = [], assigned: Group = null): ShotOutcome {
    const me = this.current;
    const opp = (1 - me) as 0 | 1;
    const p = this.players[me];
    p.fouls++;
    p.run = 0;
    toasts.push(mkToast("FOUL", "foul", why));

    if (p.fouls >= 3) {
      return this.finish(opp, "Three consecutive fouls", toasts, potted, assigned);
    }

    // re-spot the cue ball for the opponent, ball in hand
    const cue = this.world.cue();
    const scratched = cue.drop > 0 || !cue.on || potted.includes(0);
    cue.on = true;
    cue.drop = 0;
    cue.pocketIdx = -1;
    cue.vx = cue.vy = cue.wx = cue.wy = cue.wz = 0;
    const seedX = scratched || this.isBreak ? HEAD_SPOT.x : cue.x;
    const seedY = scratched || this.isBreak ? H / 2 : cue.y;
    const spot = this.world.nearestLegal(seedX, seedY, false);
    cue.x = spot.x;
    cue.y = spot.y;

    this.current = opp;
    this.ballInHand = true;
    this.kitchenOnly = false;
    this.isBreak = false;
    this.phase = "place";
    if (p.fouls === 2) toasts.push(mkToast("Warning", "warn", "One more foul loses the rack"));
    this.lastOutcome = {
      toasts, switchTurn: true, gameOver: false, winner: null, reason: why,
      potted, foul: true, assigned, reward: 0,
    };
    return this.lastOutcome;
  }

  private finish(winner: 0 | 1, reason: string, toasts: Toast[], potted: number[], assigned: Group): ShotOutcome {
    this.winner = winner;
    this.reason = reason;
    this.phase = "over";
    const playerWon = winner === 0 || (this.cfg.twoPlayer && winner === 1);
    const reward = winner === 0 && !this.cfg.twoPlayer ? this.cfg.diff.reward : this.cfg.twoPlayer ? 25 : 0;
    toasts.push(mkToast(playerWon ? "RACK WON" : "RACK LOST", playerWon ? "big" : "foul", reason));
    this.lastOutcome = {
      toasts, switchTurn: false, gameOver: true, winner, reason,
      potted, foul: false, assigned, reward,
    };
    return this.lastOutcome;
  }

  /** put a ball back on the table (foot spot or nearest free point) */
  respot(id: number) {
    const b = this.world.byId(id);
    if (!b) return;
    b.on = true;
    b.drop = 0;
    b.pocketIdx = -1;
    b.vx = b.vy = b.wx = b.wy = b.wz = 0;
    let x = FOOT_SPOT.x, y = FOOT_SPOT.y;
    if (!this.freeSpot(x, y, id)) {
      outer: for (let d = 0.6; d < 40; d += 0.6) {
        for (let a = 0; a < 48; a++) {
          const ang = (a / 48) * Math.PI * 2;
          const px = FOOT_SPOT.x + Math.cos(ang) * d;
          const py = FOOT_SPOT.y + Math.sin(ang) * d;
          if (this.freeSpot(px, py, id)) { x = px; y = py; break outer; }
        }
      }
    }
    b.x = x; b.y = y;
  }

  private freeSpot(x: number, y: number, ignore: number) {
    if (x < R || x > W - R || y < R || y > H - R) return false;
    return this.world.balls.every(
      (o) => !o.on || o.id === ignore || Math.hypot(o.x - x, o.y - y) > R * 2 + 0.05,
    );
  }

  placeCue(x: number, y: number) {
    const c = this.world.cue();
    const p = this.world.nearestLegal(x, y, this.kitchenOnly);
    c.x = p.x; c.y = p.y;
    c.on = true; c.drop = 0; c.pocketIdx = -1;
    c.vx = c.vy = c.wx = c.wy = c.wz = 0;
  }

  confirmPlacement() {
    this.ballInHand = false;
    this.kitchenOnly = false;
    this.phase = "aim";
  }

  resign(winnerIdx: 0 | 1) {
    return this.finish(winnerIdx, winnerIdx === 0 ? "Opponent resigned" : "You resigned", [], [], null);
  }
}

export const defaultCue = () => cueById("rookie");
