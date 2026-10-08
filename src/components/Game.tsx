import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/utils/cn";
import {
  BALL_COLORS, Cue, H, POCKETS, R, W, clamp, cueAimLen, cueBounces, cueById, diffById,
  cueClock, skinById,
} from "@/game/constants";
import { Match, Phase, Toast } from "@/game/rules";
import { haptic, sfx } from "@/game/audio";
import { Renderer } from "@/game/render";
import { chooseShot, AiShot } from "@/game/ai";
import { store } from "@/game/store";
import { useProfile } from "@/game/hooks";
import type { MatchSetup } from "./Menu";
import { BallDot, Btn, CoinPill, Ico, IconBtn, LevelRing } from "./ui";
import Settings from "./Settings";

const AI_CUES: Record<string, string> = {
  rookie: "rookie", pro: "walnut", champ: "crimson", legend: "gold",
};

const shortAngle = (a: number) => {
  let x = a % (Math.PI * 2);
  if (x > Math.PI) x -= Math.PI * 2;
  if (x < -Math.PI) x += Math.PI * 2;
  return x;
};

interface HudPlayer {
  name: string;
  isAI: boolean;
  group: string | null;
  rack: number[];
  fouls: number;
  turn: boolean;
}
interface Hud {
  phase: Phase;
  current: 0 | 1;
  ballInHand: boolean;
  openTable: boolean;
  isBreak: boolean;
  players: [HudPlayer, HudPlayer];
  clock: number;
  clockMax: number;
  winner: 0 | 1 | null;
  reason: string;
  shotNo: number;
}

export default function Game({ setup, onExit }: { setup: MatchSetup; onExit: () => void }) {
  const prof = useProfile();
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<Renderer | null>(null);

  const cue = useMemo(() => cueById(setup.cue), [setup.cue]);
  const diff = useMemo(() => diffById(setup.diff), [setup.diff]);
  const skin = useMemo(() => skinById(setup.skin), [setup.skin]);

  const matchRef = useRef<Match | null>(null);
  if (!matchRef.current) {
    matchRef.current = new Match({
      mode: store.get().settings.physics,
      diff,
      cue,
      twoPlayer: setup.twoPlayer,
      timer: store.get().settings.timer,
    });
    matchRef.current.players[0].name = "You";
  }
  const match = matchRef.current;

  /* ---------------- mutable control state ---------------- */
  const aimRef = useRef(0); // cue ball breaks towards the rack (+x)
  const powerRef = useRef(0.85); // first shot is always the break
  const spinRef = useRef({ x: 0, y: 0 });
  const pullRef = useRef(4);
  const strikeRef = useRef(0);
  const cueVisRef = useRef(true);
  const timeRef = useRef(0);
  const clockRef = useRef(cueClock(cue, diff));
  const lastTickSec = useRef(99);
  const aiRef = useRef<{ stage: "idle" | "think" | "aim" | "wind" | "place"; t: number; dur: number; shot: AiShot | null; from: number }>({
    stage: "idle", t: 0, dur: 0, shot: null, from: 0,
  });
  const pausedRef = useRef(false);
  const overRef = useRef(false);
  const focusRef = useRef<number | null>(null);
  const pointerRef = useRef<{ mode: "none" | "aim" | "place"; startA: number; startAim: number; moved: number; t: number }>({
    mode: "none", startA: 0, startAim: 0, moved: 0, t: 0,
  });
  const inSettingsRef = useRef(false);

  /* ---------------- react state ---------------- */
  const [hud, setHud] = useState<Hud | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState<{ winner: 0 | 1; reason: string; coins: number; xp: number } | null>(null);
  const [inSettings, setInSettings] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  const [portrait, setPortrait] = useState(false);
  const [compact, setCompact] = useState(false);
  const [, force] = useState(0);

  const isAiTurn = hud ? hud.players[hud.current].isAI && !setup.twoPlayer : false;

  const pushToasts = useCallback((list: Toast[]) => {
    if (!list.length) return;
    setToasts((prev) => [...prev.slice(-3), ...list]);
    const ids = list.map((t) => t.id);
    setTimeout(() => setToasts((prev) => prev.filter((t) => ids.indexOf(t.id) < 0)), 2700);
  }, []);

  const syncHud = useCallback(() => {
    const m = match;
    const clockMax = cueClock(cue, diff);
    setHud({
      phase: m.phase,
      current: m.current,
      ballInHand: m.ballInHand,
      openTable: m.openTable,
      isBreak: m.isBreak,
      shotNo: m.shotNumber,
      clock: Math.ceil(clockRef.current),
      clockMax,
      winner: m.winner,
      reason: m.reason,
      players: [0, 1].map((i) => {
        const idx = i as 0 | 1;
        const p = m.players[idx];
        return {
          name: p.name,
          isAI: p.isAI,
          group: p.group,
          rack: m.rackFor(idx),
          fouls: p.fouls,
          turn: m.current === idx,
        };
      }) as [HudPlayer, HudPlayer],
    });
  }, [match, cue, diff]);

  /* ---------------- rewards / game over ---------------- */
  const finishGame = useCallback((winner: 0 | 1, reason: string) => {
    if (overRef.current) return;
    overRef.current = true;
    const s = store.get();
    const won = winner === 0;
    const coins = won ? diff.reward + match.stats.bestBreak * 6 : setup.twoPlayer ? 25 : 10;
    const xp = won ? diff.xp : Math.round(diff.xp * 0.25);
    store.addCoins(coins);
    store.addXp(xp);
    store.set({
      wins: s.wins + (won ? 1 : 0),
      losses: s.losses + (won ? 0 : 1),
      pots: s.pots + match.stats.pots,
      bestBreak: Math.max(s.bestBreak, match.stats.bestBreak),
      longestRun: Math.max(s.longestRun, match.stats.longestRun),
    });
    if (won) sfx.win(); else sfx.lose();
    haptic(won ? [24, 60, 24, 60, 60] : [80, 60, 120], s.settings.haptics);
    setTimeout(() => setOver({ winner, reason, coins, xp }), 780);
  }, [diff.reward, diff.xp, match, setup.twoPlayer]);

  /* ---------------- turn plumbing ---------------- */
  const beginTurn = useCallback(() => {
    const m = match;
    clockRef.current = cueClock(cue, diff);
    lastTickSec.current = 99;
    focusRef.current = null;
    if (m.phase === "aim") {
      cueVisRef.current = true;
      strikeRef.current = 0;
    }
    const aiTurn = m.players[m.current].isAI;
    if (aiTurn) {
      if (m.phase === "place") {
        aiRef.current = { stage: "place", t: 620, dur: 620, shot: null, from: 0 };
        setAiThinking(true);
      } else {
        aiRef.current = {
          stage: "think",
          t: diff.think[0] + Math.random() * (diff.think[1] - diff.think[0]),
          dur: 1, shot: null, from: aimRef.current,
        };
        setAiThinking(true);
      }
    } else {
      aiRef.current.stage = "idle";
      setAiThinking(false);
    }
    syncHud();
  }, [match, cue, diff, syncHud]);

  const settleShot = useCallback(() => {
    const m = match;
    const out = m.settle();
    pushToasts(out.toasts);
    const foul = out.toasts.some((t) => t.kind === "foul");
    if (foul) { sfx.foul(); haptic([30, 40, 30], store.get().settings.haptics); }
    if (out.gameOver && out.winner !== null) {
      finishGame(out.winner, out.reason);
      syncHud();
      return;
    }
    if (out.switchTurn) {
      const nxt = match.players[match.current];
      pushToasts([{
        id: Date.now(),
        text: `${nxt.name}'s turn`,
        kind: "info",
        sub: match.ballInHand ? "Ball in hand" : nxt.group ? `${nxt.group} · ${match.rackFor(match.current).length} left` : "Open table",
      }]);
    }
    beginTurn();
  }, [match, pushToasts, finishGame, beginTurn, syncHud]);

  /* ---------------- shooting ---------------- */
  const doShoot = useCallback((spec: { angle: number; power: number; spinX: number; spinY: number; cue: Cue }) => {
    const m = match;
    if (m.phase !== "aim") return;
    m.shoot(spec);
    strikeRef.current = 1;
    sfx.cue(spec.power);
    const r = rendererRef.current;
    const cb = m.world.cue();
    r?.chalk(cb.x, cb.y, spec.angle, spec.power);
    if (r) r.shake = Math.min(1, spec.power * 0.85 + 0.1);
    haptic([10 + spec.power * 22], store.get().settings.haptics);
    setAiThinking(false);
    syncHud();
  }, [match, syncHud]);

  const playerShoot = useCallback(() => {
    if (match.phase !== "aim" || pausedRef.current || overRef.current) return;
    if (match.players[match.current].isAI) return;
    doShoot({
      angle: aimRef.current, power: clamp(powerRef.current, 0.06, 1),
      spinX: spinRef.current.x, spinY: spinRef.current.y, cue,
    });
  }, [match, doShoot, cue]);

  /* ---------------- AI driver ---------------- */
  const aiPlace = useCallback(() => {
    const w = match.world;
    let best = { x: W * 0.28, y: H / 2 }, bs = -Infinity;
    for (let i = 0; i < 90; i++) {
      const x = R + 2 + Math.random() * (W - 2 * R - 4);
      const y = R + 2 + Math.random() * (H - 2 * R - 4);
      if (!w.validCuePlacement(x, y, false)) continue;
      let s = 0;
      for (const t of match.legalTargets()) {
        const b = w.byId(t);
        if (!b) continue;
        for (const p of POCKETS) {
          const dp = Math.hypot(p.x - b.x, p.y - b.y);
          if (dp > 80) continue;
          const ux = (p.x - b.x) / dp, uy = (p.y - b.y) / dp;
          const gx = b.x - ux * R * 2, gy = b.y - uy * R * 2;
          const dg = Math.hypot(gx - x, gy - y);
          if (dg < 4) continue;
          let clear = true;
          for (const o of w.balls) {
            if (!o.on || o.id === 0 || o.id === t) continue;
            const dx = gx - x, dy = gy - y;
            const l2 = dx * dx + dy * dy;
            const tt = clamp(((o.x - x) * dx + (o.y - y) * dy) / l2, 0, 1);
            if (Math.hypot(o.x - (x + dx * tt), o.y - (y + dy * tt)) < R * 2) { clear = false; break; }
          }
          if (clear) s += 100 / (1 + dg * 0.06) - dp * 0.35;
        }
      }
      s -= Math.abs(y - H / 2) * 0.7;
      if (s > bs) { bs = s; best = { x, y }; }
    }
    match.placeCue(best.x, best.y);
    match.confirmPlacement();
  }, [match]);

  const stepAi = useCallback((dt: number) => {
    const a = aiRef.current;
    const m = match;
    if (a.stage === "idle" || overRef.current || pausedRef.current) return;
    a.t -= dt * 1000;
    if (a.stage === "place") {
      if (a.t <= 0) {
        aiPlace();
        a.stage = "think";
        a.t = 420 + Math.random() * 380;
        setAiThinking(true);
        syncHud();
      }
      return;
    }
    if (a.stage === "think") {
      if (a.t <= 0) {
        const aiCue = cueById(AI_CUES[diff.id] ?? "walnut");
        let shot: AiShot;
        try {
          shot = chooseShot(m, aiCue, diff);
        } catch {
          shot = { angle: 0, power: 0.4, spinX: 0, spinY: 0, cue: aiCue, note: "", quality: 0, target: -1, pocketIdx: -1 };
        }
        a.shot = shot;
        a.from = aimRef.current;
        focusRef.current = shot.target >= 0 ? shot.target : null;
        const target = a.from + shortAngle(shot.angle - a.from);
        a.shot = { ...shot, angle: target };
        a.stage = "aim";
        a.dur = 620;
        a.t = a.dur;
      }
      return;
    }
    if (a.stage === "aim" && a.shot) {
      const k = clamp(1 - a.t / a.dur, 0, 1);
      const e = 1 - Math.pow(1 - k, 2.4);
      aimRef.current = a.from + (a.shot.angle - a.from) * e;
      powerRef.current = a.shot.power * e;
      spinRef.current = { x: a.shot.spinX * e, y: a.shot.spinY * e };
      pullRef.current = powerRef.current * 8.5 + 1.2;
      if (a.t <= 0) {
        focusRef.current = null;
        a.stage = "wind";
        a.t = 240;
      }
      return;
    }
    if (a.stage === "wind" && a.shot) {
      const k = clamp(1 - a.t / 240, 0, 1);
      pullRef.current = (a.shot.power * 8.5 + 1.2) + k * 2.6;
      if (a.t <= 0) {
        const s = a.shot;
        a.stage = "idle";
        a.shot = null;
        cueVisRef.current = true;
        doShoot({ angle: s.angle, power: s.power, spinX: s.spinX, spinY: s.spinY, cue: s.cue });
      }
    }
  }, [match, diff, aiPlace, doShoot, syncHud]);

  /* ---------------- main loop ---------------- */
  useEffect(() => {
    const canvas = canvasRef.current!, wrap = wrapRef.current!;
    const renderer = new Renderer(canvas);
    rendererRef.current = renderer;
    renderer.setSkin(skin);

    const dpr = Math.min(window.devicePixelRatio || 1, 2.2);
    const fit = () => {
      const r = wrap.getBoundingClientRect();
      renderer.resize(Math.max(120, r.width), Math.max(120, r.height), dpr);
      renderer.setSkin(skin);
      setPortrait(window.innerHeight > window.innerWidth * 1.05);
      setCompact(window.innerHeight < 540);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);
    window.addEventListener("orientationchange", fit);

    match.world.onImpact = (kind, v, x, y) => {
      if (kind === "ball") {
        sfx.ball(v);
        renderer.impact(x, y, v);
        if (v > 190) haptic(8, store.get().settings.haptics);
      } else if (kind === "cushion") {
        sfx.cushion(v);
        if (v > 60) renderer.kick(x, y);
      } else {
        sfx.pocket();
        const dropping = matchRef.current?.world.balls.find((b) => b.drop > 0);
        renderer.pocketFx(x, y, BALL_COLORS[dropping?.id ?? 0] ?? "#f4d68a");
        renderer.shake = Math.max(renderer.shake, 0.34);
        haptic(26, store.get().settings.haptics);
      }
    };

    sfx.setSfx(store.get().settings.sound);
    if (store.get().settings.music) sfx.setMusic(true);
    sfx.rack();
    beginTurn();
    pushToasts([{ id: -1, text: match.isBreak ? "YOUR BREAK" : "RACK ON", kind: "big", sub: "Drag to aim · set power · strike" }]);

    let raf = 0;
    let last = performance.now();
    let hudAcc = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = clamp((now - last) / 1000, 0, 0.05);
      last = now;
      timeRef.current += dt;
      const m = match;
      const w = m.world;

      if (!pausedRef.current && !overRef.current) {
        if (m.phase === "roll") {
          w.step(dt);
          if (!w.moving()) settleShot();
        } else if (m.phase === "aim" || m.phase === "place") {
          if (m.players[m.current].isAI) stepAi(dt);
          else if (m.phase === "aim" && store.get().settings.timer && !inSettingsRef.current) {
            clockRef.current -= dt;
            const sec = Math.ceil(clockRef.current);
            if (sec <= 5 && sec !== lastTickSec.current && sec > 0) {
              lastTickSec.current = sec;
              sfx.tick();
            }
            if (clockRef.current <= 0) {
              clockRef.current = 0;
              const out = m.timeout();
              pushToasts(out.toasts);
              sfx.foul();
              if (out.gameOver && out.winner !== null) finishGame(out.winner, out.reason);
              else beginTurn();
            }
          }
        }
      }

      // cue stick animation
      if (strikeRef.current > 0) {
        strikeRef.current = Math.max(0, strikeRef.current - dt * 13);
        const k = 1 - strikeRef.current;
        pullRef.current = (powerRef.current * 8.5 + 1.2) * (1 - k * 1.5) - k * 3.4;
        if (strikeRef.current === 0) cueVisRef.current = false;
      } else {
        if (m.phase === "aim" && !cueVisRef.current) cueVisRef.current = true;
        if (m.phase === "aim" && !m.players[m.current].isAI) {
          pullRef.current += ((powerRef.current * 8.5 + 1.2) - pullRef.current) * Math.min(1, dt * 12);
        }
      }

      hudAcc += dt;
      if (hudAcc > 0.07) { hudAcc = 0; syncHud(); }

      renderer.draw({
        world: w,
        aim: aimRef.current,
        power: powerRef.current,
        pull: pullRef.current,
        showCue: (m.phase === "aim" && cueVisRef.current) || strikeRef.current > 0,
        guides: store.get().settings.guides && m.phase === "aim",
        guideLen: cueAimLen(cue),
        guideBounces: cueBounces(cue),
        cueDef: m.players[m.current].isAI ? cueById(AI_CUES[diff.id] ?? "walnut") : cue,
        spin: spinRef.current,
        ballInHand: m.phase === "place",
        placeGhost: m.phase === "place" ? {
          x: w.cue().x, y: w.cue().y,
          valid: w.validCuePlacement(w.cue().x, w.cue().y, m.kitchenOnly),
        } : null,
        highlights:
          m.phase === "aim" && !m.players[m.current].isAI && m.players[m.current].group
            ? m.legalTargets()
            : [],
        kitchen: m.isBreak,
        focus: focusRef.current,
        time: timeRef.current,
      }, dt);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("orientationchange", fit);
      match.world.onImpact = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { inSettingsRef.current = inSettings || paused; }, [inSettings, paused]);
  useEffect(() => { pausedRef.current = paused || inSettings || over !== null; }, [paused, inSettings, over]);
  useEffect(() => { sfx.setSfx(prof.settings.sound); }, [prof.settings.sound]);
  useEffect(() => { match.world.setMode(prof.settings.physics); }, [prof.settings.physics, match]);

  /* ---------------- pointer input ---------------- */
  const worldFromEvent = (e: React.PointerEvent | React.WheelEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    const ren = rendererRef.current!;
    return ren.toWorld(e.clientX - r.left, e.clientY - r.top);
  };

  const onDown = (e: React.PointerEvent) => {
    sfx.resume();
    const m = match;
    if (pausedRef.current || overRef.current) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const wp = worldFromEvent(e);
    if (m.phase === "place" && !m.players[m.current].isAI) {
      pointerRef.current = { mode: "place", startA: 0, startAim: 0, moved: 0, t: performance.now() };
      m.placeCue(wp.x, wp.y);
      syncHud();
      return;
    }
    if (m.phase === "aim" && !m.players[m.current].isAI) {
      const cb = m.world.cue();
      pointerRef.current = {
        mode: "aim",
        startA: Math.atan2(wp.y - cb.y, wp.x - cb.x),
        startAim: aimRef.current,
        moved: 0,
        t: performance.now(),
      };
    }
  };

  const onMove = (e: React.PointerEvent) => {
    const p = pointerRef.current;
    if (p.mode === "none") return;
    const wp = worldFromEvent(e);
    const m = match;
    if (p.mode === "place") {
      m.placeCue(wp.x, wp.y);
      return;
    }
    const cb = m.world.cue();
    const a = Math.atan2(wp.y - cb.y, wp.x - cb.x);
    const d = shortAngle(a - p.startA);
    p.moved += Math.abs(d);
    p.startA = a;
    aimRef.current += d;
  };

  const onUp = (e: React.PointerEvent) => {
    const p = pointerRef.current;
    if (p.mode === "aim") {
      const wp = worldFromEvent(e);
      const cb = match.world.cue();
      const far = Math.hypot(wp.x - cb.x, wp.y - cb.y) > R * 3;
      // a quick tap on the cloth lines the cue up instantly
      if (p.moved < 0.035 && performance.now() - p.t < 340 && far) {
        aimRef.current = Math.atan2(wp.y - cb.y, wp.x - cb.x);
        sfx.ui(true);
      }
    }
    p.mode = "none";
    syncHud();
  };

  const onWheel = (e: React.WheelEvent) => {
    if (match.phase !== "aim" || match.players[match.current].isAI) return;
    if (e.shiftKey) powerRef.current = clamp(powerRef.current - e.deltaY * 0.0009, 0.05, 1);
    else aimRef.current += e.deltaY * 0.0006;
    force((n) => n + 1);
  };

  /* ---------------- keyboard ---------------- */
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const m = match;
      if (e.key === "Escape") { setPaused((v) => !v); return; }
      if (pausedRef.current || overRef.current) return;
      if (m.players[m.current].isAI) return;
      const fine = e.shiftKey ? 0.0012 : 0.008;
      switch (e.key) {
        case "ArrowLeft": aimRef.current -= fine; e.preventDefault(); break;
        case "ArrowRight": aimRef.current += fine; e.preventDefault(); break;
        case "ArrowUp": powerRef.current = clamp(powerRef.current + 0.02, 0.05, 1); e.preventDefault(); break;
        case "ArrowDown": powerRef.current = clamp(powerRef.current - 0.02, 0.05, 1); e.preventDefault(); break;
        case " ": playerShoot(); e.preventDefault(); break;
        case "g": store.setSetting("guides", !store.get().settings.guides); break;
        default: break;
      }
      force((n) => n + 1);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [match, playerShoot]);

  /* ---------------- derived UI ---------------- */
  const lp = store.levelProgress;
  const clockPct = hud ? clamp(hud.clock / hud.clockMax, 0, 1) : 1;
  const lowClock = (hud?.clock ?? 99) <= 5 && store.get().settings.timer;
  const high = prof.settings.physics === "high";
  const cs = compact ? 34 : 44;
  const cr = cs / 2 - 4;
  const spinSize = compact ? 54 : 74;

  const spinDisabled = !high;

  return (
    <div className="fixed inset-0 flex flex-col bg-[radial-gradient(120%_90%_at_50%_-10%,#1a231c,#070a08_70%)] select-none">
      {/* ============ TOP BAR ============ */}
      <header className={cn("relative z-20 px-2 sm:px-3 flex items-stretch gap-1.5 sm:gap-2 shrink-0",
        compact ? "pt-1 pb-0.5" : "pt-2 pb-1.5")}
        style={{ paddingTop: compact ? "max(4px, env(safe-area-inset-top))" : "max(8px, env(safe-area-inset-top))" }}>
        {hud?.players.map((p, i) => (
          <PlayerCard key={i} p={p} side={i === 0 ? "l" : "r"} openTable={hud.openTable} isBreak={hud.isBreak}
            compact={compact}
            onEight={p.group ? p.rack.length === 1 && p.rack[0] === 8 : false} />
        ))}

        <div className={cn("flex flex-col items-center justify-center gap-0.5 px-0.5", compact ? "min-w-[52px]" : "min-w-[74px]")}>
          <div className="relative grid place-items-center">
            <svg width={cs} height={cs} className="-rotate-90">
              <circle cx={cs / 2} cy={cs / 2} r={cr} fill="rgba(0,0,0,.5)" stroke="rgba(255,255,255,.09)" strokeWidth="3.4" />
              <circle cx={cs / 2} cy={cs / 2} r={cr} fill="none" strokeWidth="3.4" strokeLinecap="round"
                stroke={lowClock ? "#e05a4a" : clockPct > 0.5 ? "#7fd69a" : "#e0a13c"}
                strokeDasharray={2 * Math.PI * cr} strokeDashoffset={2 * Math.PI * cr * (1 - (store.get().settings.timer ? clockPct : 1))}
                style={{ transition: "stroke-dashoffset .25s linear" }} />
            </svg>
            <span className={cn("absolute display leading-none tnum", compact ? "text-[15px]" : "text-[19px]",
              lowClock ? "text-[#ff9c8f]" : "text-cream")}>
              {store.get().settings.timer ? hud?.clock ?? 0 : "∞"}
            </span>
          </div>
          <IconBtn label="Pause" className={compact ? "w-6 h-5" : "w-7 h-7"} onClick={() => { sfx.ui(false); setPaused(true); }}>
            <Ico.pause className="w-3 h-3" />
          </IconBtn>
        </div>
      </header>

      {/* ============ TABLE ============ */}
      <div ref={wrapRef} className="relative flex-1 min-h-0 w-full">
        <canvas ref={canvasRef} className="absolute inset-0"
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}
          onPointerCancel={onUp} onWheel={onWheel} />

        {/* toasts */}
        <div className="absolute left-1/2 top-3 -translate-x-1/2 z-20 pointer-events-none flex flex-col items-center gap-1.5 w-full px-3">
          {toasts.map((t) => (
            <div key={t.id}
              className={cn("anim-toast px-4 py-1.5 rounded-lg border backdrop-blur-[2px] text-center max-w-[92vw]",
                t.kind === "foul" && "bg-[#5c1a14]/90 border-[#ff9c8f]/40",
                t.kind === "good" && "bg-[#123c2a]/90 border-[#7fd69a]/40",
                t.kind === "big" && "bg-[#3a2c0c]/92 border-brass/60",
                t.kind === "warn" && "bg-[#4a3410]/90 border-brass/40",
                t.kind === "info" && "bg-black/70 border-white/15")}>
              <div className={cn("display uppercase leading-none tracking-wide",
                t.kind === "big" ? "text-[30px] text-brass2" : t.kind === "foul" ? "text-[24px] text-[#ffd9d3]" : "text-[21px] text-cream")}>
                {t.text}
              </div>
              {t.sub && <div className="text-[11px] text-cream/70 mt-0.5">{t.sub}</div>}
            </div>
          ))}
        </div>

        {/* ball in hand banner */}
        {hud?.phase === "place" && !isAiTurn && (
          <div className="absolute left-1/2 bottom-3 -translate-x-1/2 z-20 anim-pop pointer-events-none">
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-black/75 border border-brass/45 backdrop-blur-[2px]">
              <Ico.hand className="w-4 h-4 text-brass2" />
              <span className="display text-[17px] uppercase text-cream tracking-wide">Ball in hand — drag to place</span>
            </div>
          </div>
        )}

        {aiThinking && hud?.phase === "aim" && (
          <div className="absolute right-3 top-3 z-20 pointer-events-none flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-black/70 border border-white/10">
            <span className="w-1.5 h-1.5 rounded-full bg-[#ff9c8f] animate-pulse" />
            <span className="text-[11px] uppercase tracking-[0.18em] text-muted">CPU thinking</span>
          </div>
        )}

        {portrait && (
          <div className="absolute left-2 top-2 z-20 pointer-events-none px-2 py-1 rounded-md bg-black/60 border border-white/10 text-[10px] uppercase tracking-[0.14em] text-muted">
            Rotate for a bigger table
          </div>
        )}

        {/* physics badge */}
        <div className="absolute left-2 bottom-2 z-20 pointer-events-none flex items-center gap-1.5 px-2 py-1 rounded-md bg-black/55 border border-white/10">
          <Ico.atom className={cn("w-3.5 h-3.5", high ? "text-brass2" : "text-muted")} />
          <span className="text-[9.5px] uppercase tracking-[0.16em] text-muted">{high ? "High physics" : "Arcade"}</span>
        </div>
      </div>

      {/* ============ BOTTOM BAR ============ */}
      <footer className="relative z-20 shrink-0 px-2 sm:px-3 pt-1.5 pb-2 bg-[linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,.55))]"
        style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}>
        <div className="flex items-end gap-2 sm:gap-3">
          {/* spin */}
          <SpinPad value={spinRef.current} disabled={spinDisabled} size={spinSize} compact={compact}
            onChange={(v) => { spinRef.current = v; force((n) => n + 1); }} />

          {/* power + fine aim */}
          <div className="flex-1 min-w-0 flex flex-col gap-1.5 pb-0.5">
            <PowerBar value={powerRef.current} compact={compact} disabled={hud?.phase !== "aim" || isAiTurn}
              onChange={(v) => { powerRef.current = v; force((n) => n + 1); }} />
            <div className="flex items-center gap-1.5">
              <IconBtn label="Aim left" className="w-8 h-7"
                onPointerDown={(e) => { e.preventDefault(); startNudge(-1); }}
                onPointerUp={stopNudge} onPointerLeave={stopNudge} onPointerCancel={stopNudge}>
                <Ico.back className="w-3.5 h-3.5" />
              </IconBtn>
              <div className="flex-1 h-7 rounded-md bg-black/45 border border-white/[0.07] grid place-items-center overflow-hidden">
                <span className="display text-[15px] text-muted tnum">
                  {(((((aimRef.current * 180) / Math.PI) % 360) + 360) % 360).toFixed(1)}°
                </span>
              </div>
              <IconBtn label="Aim right" className="w-8 h-7"
                onPointerDown={(e) => { e.preventDefault(); startNudge(1); }}
                onPointerUp={stopNudge} onPointerLeave={stopNudge} onPointerCancel={stopNudge}>
                <Ico.fwd className="w-3.5 h-3.5" />
              </IconBtn>
              <IconBtn label="Guides" className="w-8 h-7" active={prof.settings.guides}
                onClick={() => { sfx.ui(); store.setSetting("guides", !prof.settings.guides); }}>
                <Ico.target className="w-4 h-4" />
              </IconBtn>
              <IconBtn label="Physics" className="w-8 h-7" active={high}
                onClick={() => { sfx.ui(); store.setSetting("physics", high ? "simple" : "high"); }}>
                <Ico.atom className="w-4 h-4" />
              </IconBtn>
            </div>
          </div>

          {/* strike */}
          <button
            onClick={() => {
              if (hud?.phase === "place" && !isAiTurn) {
                match.confirmPlacement();
                clockRef.current = cueClock(cue, diff);
                sfx.ui();
                syncHud();
              } else playerShoot();
            }}
            disabled={isAiTurn || overRef.current || (hud?.phase !== "aim" && hud?.phase !== "place")}
            className={cn("press relative rounded-full grid place-items-center shrink-0 border-2",
              compact ? "w-[56px] h-[56px]" : "w-[74px] h-[74px] sm:w-[84px] sm:h-[84px]",
              hud?.phase === "place" && !isAiTurn
                ? "border-[#7fd69a]/70 bg-[radial-gradient(circle_at_35%_28%,#3fa86a,#12422a)] text-[#eafff1] shadow-[0_6px_0_#0b2b1a,0_12px_26px_rgba(0,0,0,.6)]"
                : "border-brass2/70 brassplate text-[#221703] shadow-[0_6px_0_#6d4c12,0_12px_26px_rgba(0,0,0,.6)]",
              (isAiTurn || overRef.current) && "opacity-45 pointer-events-none")}>
            <span className="absolute inset-1.5 rounded-full border border-black/20" />
            <span className="relative flex flex-col items-center">
              {hud?.phase === "place" && !isAiTurn
                ? <Ico.hand className={compact ? "w-5 h-5" : "w-6 h-6"} />
                : <Ico.bolt className={compact ? "w-5 h-5" : "w-6 h-6"} />}
              <span className={cn("display leading-none mt-0.5 uppercase", compact ? "text-[13px]" : "text-[17px]")}>
                {hud?.phase === "place" && !isAiTurn ? "Place" : "Strike"}
              </span>
            </span>
          </button>
        </div>
      </footer>

      {/* ============ MODALS ============ */}
      {paused && !over && (
        <div className="fixed inset-0 z-40 grid place-items-center p-3 bg-black/75 backdrop-blur-[3px]">
          <div className="anim-pop w-full max-w-sm rounded-2xl border border-white/10 bg-[linear-gradient(165deg,#1b211c,#0d1210_70%)] p-5 shadow-[0_30px_80px_rgba(0,0,0,.8)]">
            <div className="display text-[30px] leading-none uppercase text-cream">Paused</div>
            <p className="text-[12px] text-muted mt-1">Rack {hud?.shotNo ?? 0} · {diff.name} · {skin.name}</p>
            <div className="mt-4 grid gap-2">
              <Btn variant="gold" size="lg" onClick={() => { sfx.ui(); setPaused(false); }} icon={<Ico.play className="w-5 h-5" />}>Resume</Btn>
              <div className="grid grid-cols-2 gap-2">
                <Btn variant="wood" onClick={() => { sfx.ui(); setInSettings(true); setPaused(false); }} icon={<Ico.gear className="w-4 h-4" />}>Settings</Btn>
                <Btn variant="wood" onClick={() => restart()} icon={<Ico.restart className="w-4 h-4" />}>Restart</Btn>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Btn variant="ghost" onClick={() => { sfx.foul(); match.resign(1); finishGame(1, "You resigned"); }} icon={<Ico.flag className="w-4 h-4" />}>Resign</Btn>
                <Btn variant="ghost" onClick={() => { sfx.ui(false); onExit(); }} icon={<Ico.home className="w-4 h-4" />}>Quit</Btn>
              </div>
            </div>
          </div>
        </div>
      )}

      {inSettings && (
        <div className="fixed inset-0 z-50 grid place-items-center p-3 bg-black/75 backdrop-blur-[3px]" onClick={() => setInSettings(false)}>
          <div className="anim-pop relative w-full max-w-lg max-h-[90vh] overflow-y-auto no-scrollbar rounded-2xl border border-white/10 bg-[linear-gradient(165deg,#1b211c,#0d1210_70%)] shadow-[0_30px_80px_rgba(0,0,0,.8)]"
            onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setInSettings(false)}
              className="absolute top-4 right-4 grid place-items-center w-8 h-8 rounded-lg text-muted hover:text-cream hover:bg-white/10">
              <Ico.close className="w-4 h-4" />
            </button>
            <Settings embedded />
          </div>
        </div>
      )}

      {over && (
        <div className="fixed inset-0 z-50 grid place-items-center p-3 bg-black/80 backdrop-blur-[4px]">
          <div className="anim-pop w-full max-w-sm rounded-2xl overflow-hidden border border-white/10 bg-[linear-gradient(165deg,#1e241e,#0b0f0d_75%)] shadow-[0_30px_90px_rgba(0,0,0,.85)]">
            <div className={cn("relative px-6 pt-7 pb-5 text-center",
              over.winner === 0 ? "bg-[radial-gradient(80%_120%_at_50%_0%,rgba(217,164,65,.35),transparent)]" : "bg-[radial-gradient(80%_120%_at_50%_0%,rgba(192,57,43,.3),transparent)]")}>
              <div className="mx-auto mb-2 w-fit anim-float">
                <BallDot id={8} size={54} glow />
              </div>
              <div className={cn("display uppercase leading-none", over.winner === 0 ? "text-brass2" : "text-[#ff9c8f]")}
                style={{ fontSize: 46, textShadow: "0 5px 0 rgba(0,0,0,.5)" }}>
                {over.winner === 0 ? "Rack Won" : "Rack Lost"}
              </div>
              <div className="text-[12.5px] text-cream/70 mt-1.5">{over.reason}</div>
            </div>
            <div className="px-5 pb-5 pt-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-black/40 border border-brass/25 flex-1">
                  <Ico.coin className="w-4 h-4 text-brass2" />
                  <span className="display text-[22px] leading-none text-brass2 tnum">+{over.coins}</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-black/40 border border-sky/25 flex-1">
                  <Ico.star className="w-4 h-4 text-sky" />
                  <span className="display text-[22px] leading-none text-sky tnum">+{over.xp} xp</span>
                </div>
              </div>
              <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-black/35 border border-white/[0.07] mb-4">
                <LevelRing level={lp.level} pct={lp.pct} size={40} />
                <div className="flex-1">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-muted">Level {lp.level}</div>
                  <div className="h-1.5 mt-1 rounded-full bg-black/60 overflow-hidden">
                    <div className="h-full rounded-full bg-[linear-gradient(90deg,#f4d68a,#c07f1d)]"
                      style={{ width: `${lp.pct * 100}%`, transition: "width 1s ease" }} />
                  </div>
                </div>
                <CoinPill amount={prof.coins} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Btn variant="ghost" onClick={() => { sfx.ui(false); onExit(); }} icon={<Ico.home className="w-4 h-4" />}>Menu</Btn>
                <Btn variant="gold" onClick={() => restart()} icon={<Ico.restart className="w-4 h-4" />}>Rematch</Btn>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  /* ---------------- small helpers defined after JSX for hoisting ---------------- */
  const nudgeTimer = useRef<number | null>(null);
  function nudge(dir: number) {
    if (match.phase !== "aim" || match.players[match.current].isAI) return;
    aimRef.current += dir * 0.0022;
    force((n) => n + 1);
  }
  function startNudge(dir: number) {
    nudge(dir);
    sfx.ui(dir > 0);
    stopNudge();
    nudgeTimer.current = window.setInterval(() => nudge(dir), 50);
  }
  function stopNudge() {
    if (nudgeTimer.current !== null) {
      clearInterval(nudgeTimer.current);
      nudgeTimer.current = null;
    }
  }

  function restart() {
    const fresh = new Match({
      mode: store.get().settings.physics, diff, cue,
      twoPlayer: setup.twoPlayer, timer: store.get().settings.timer,
    });
    // copy the fresh match into the live object so the running loop follows it
    fresh.world.onImpact = match.world.onImpact;
    Object.assign(match, fresh);
    overRef.current = false;
    aimRef.current = 0;
    powerRef.current = 0.85;
    spinRef.current = { x: 0, y: 0 };
    pullRef.current = 5;
    cueVisRef.current = true;
    strikeRef.current = 0;
    aiRef.current.stage = "idle";
    focusRef.current = null;
    clockRef.current = cueClock(cue, diff);
    setOver(null);
    setPaused(false);
    setToasts([]);
    sfx.rack();
    beginTurn();
    pushToasts([{ id: -2, text: "NEW RACK", kind: "big" }]);
  }
}

/* ------------------------------------------------------------------ */

function PlayerCard({ p, side, openTable, isBreak, onEight, compact }: {
  p: HudPlayer; side: "l" | "r"; openTable: boolean; isBreak: boolean; onEight: boolean; compact?: boolean;
}) {
  return (
    <div className={cn("flex-1 min-w-0 rounded-xl px-2.5 py-1.5 border transition-all duration-300",
      p.turn
        ? "border-brass/60 bg-[linear-gradient(180deg,rgba(217,164,65,.18),rgba(0,0,0,.45))] shadow-[0_0_22px_rgba(217,164,65,.16)]"
        : "border-white/[0.07] bg-black/40",
      side === "r" && "flex-row-reverse text-right")}>
      <div className={cn("flex items-center gap-2 min-w-0", side === "r" && "flex-row-reverse")}>
        <div className={cn("relative grid place-items-center rounded-lg shrink-0 border",
          compact ? "w-7 h-7" : "w-9 h-9",
          p.turn ? "border-brass/60 bg-brass/15" : "border-white/10 bg-black/50")}>
          {p.isAI ? <Ico.cpu className={cn(compact ? "w-4 h-4" : "w-5 h-5", p.turn ? "text-brass2" : "text-muted")} />
            : <span className={cn("display leading-none", compact ? "text-[15px]" : "text-[19px]", p.turn ? "text-brass2" : "text-muted")}>{p.name.slice(0, 1)}</span>}
          {p.fouls > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-crimson text-[10px] grid place-items-center text-white font-bold border border-black/40">
              {p.fouls}
            </span>
          )}
        </div>
        <div className={cn("min-w-0 flex-1", side === "r" && "flex flex-col items-end")}>
          <div className="display text-[18px] leading-none uppercase text-cream truncate max-w-[92px] sm:max-w-none">{p.name}</div>
          <div className="text-[9.5px] uppercase tracking-[0.14em] mt-0.5"
            style={{ color: openTable ? "#9aa79b" : p.group === "solids" ? "#e8c46a" : "#7fb6e8" }}>
            {isBreak ? "Break" : openTable ? "Open table" : onEight ? "On the 8-ball" : p.group}
          </div>
        </div>
      </div>
      <div className={cn("flex items-center gap-[3px] mt-1.5 min-h-[16px] flex-wrap", side === "r" && "justify-end")}>
        {p.rack.length === 0 && (
          <span className="text-[9.5px] uppercase tracking-wider text-muted/60">awaiting group</span>
        )}
        {p.rack.map((id) => (
          <BallDot key={id} id={id} size={15} glow={id === 8} />
        ))}
      </div>
    </div>
  );
}

function PowerBar({ value, onChange, disabled, compact }: {
  value: number; onChange: (v: number) => void; disabled?: boolean; compact?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState(false);
  const set = (clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    onChange(clamp((clientX - r.left) / r.width, 0.05, 1));
  };
  const pct = Math.round(value * 100);
  return (
    <div className={cn("relative", disabled && "opacity-55")}>
      <div className={cn("flex items-center justify-between px-0.5", compact ? "mb-0.5" : "mb-1")}>
        <span className="text-[9.5px] uppercase tracking-[0.2em] text-muted">Power</span>
        <span className={cn("display leading-none tnum", compact ? "text-[14px]" : "text-[16px]",
          pct > 80 ? "text-[#ff9c8f]" : pct > 50 ? "text-brass2" : "text-cream")}>
          {pct}%
        </span>
      </div>
      <div ref={ref}
        onPointerDown={(e) => { if (disabled) return; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); setDrag(true); set(e.clientX); }}
        onPointerMove={(e) => { if (drag && !disabled) set(e.clientX); }}
        onPointerUp={() => setDrag(false)}
        onPointerCancel={() => setDrag(false)}
        className={cn("relative rounded-lg bg-black/55 border border-white/[0.08] overflow-hidden cursor-pointer touch-none",
          compact ? "h-[18px]" : "h-[26px]")}>
        <div className="absolute inset-0 opacity-25"
          style={{ backgroundImage: "repeating-linear-gradient(90deg, rgba(255,255,255,.35) 0 1px, transparent 1px 10%)" }} />
        <div className="absolute inset-y-0 left-0 rounded-r-md"
          style={{
            width: `${value * 100}%`,
            background: "linear-gradient(90deg,#2fa06a 0%,#7fd69a 26%,#e0c14a 58%,#e07a3c 78%,#d8433a 100%)",
            boxShadow: "0 0 16px rgba(224,160,60,.45)",
            transition: drag ? "none" : "width .12s ease-out",
          }}>
          <div className="absolute inset-0 shimmer opacity-40" />
        </div>
        <div className="absolute inset-y-0 w-[3px] bg-cream/85 shadow-[0_0_10px_rgba(255,255,255,.8)]"
          style={{ left: `calc(${value * 100}% - 1.5px)`, transition: drag ? "none" : "left .12s ease-out" }} />
      </div>
    </div>
  );
}

function SpinPad({ value, onChange, disabled, size = 74, compact }: {
  value: { x: number; y: number }; onChange: (v: { x: number; y: number }) => void;
  disabled?: boolean; size?: number; compact?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState(false);
  const rad = size / 2 - 6;
  const set = (cx: number, cy: number) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    let x = (cx - r.left - r.width / 2) / rad;
    let y = -(cy - r.top - r.height / 2) / rad;
    const m = Math.hypot(x, y);
    if (m > 1) { x /= m; y /= m; }
    onChange({ x: clamp(x, -1, 1), y: clamp(y, -1, 1) });
  };
  return (
    <div className="relative shrink-0 flex flex-col items-center gap-1 pb-0.5">
      <div ref={ref}
        onPointerDown={(e) => {
          if (disabled) return;
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          setDrag(true); set(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => { if (drag && !disabled) set(e.clientX, e.clientY); }}
        onPointerUp={() => setDrag(false)}
        onPointerCancel={() => setDrag(false)}
        onDoubleClick={() => onChange({ x: 0, y: 0 })}
        className={cn("relative rounded-full border touch-none",
          disabled ? "border-white/[0.07] opacity-45" : "border-white/15 cursor-pointer")}
        style={{
          width: size, height: size,
          background: "radial-gradient(circle at 34% 28%, #ffffff, #ded8c8 58%, #9d968a 100%)",
          boxShadow: "inset 0 -3px 8px rgba(0,0,0,.5), 0 4px 12px rgba(0,0,0,.5)",
        }}>
        {/* cross hairs */}
        <span className="absolute left-1/2 top-[12%] bottom-[12%] w-px bg-black/15 -translate-x-1/2" />
        <span className="absolute top-1/2 left-[12%] right-[12%] h-px bg-black/15 -translate-y-1/2" />
        <span className="absolute inset-[6px] rounded-full border border-dashed border-black/10" />
        {/* english dot */}
        <span className="absolute w-[15px] h-[15px] rounded-full border border-white/70 grid place-items-center"
          style={{
            left: `calc(50% + ${value.x * rad}px - 7.5px)`,
            top: `calc(50% - ${value.y * rad}px - 7.5px)`,
            background: "radial-gradient(circle at 35% 30%, #ff8f7a, #b8243a)",
            boxShadow: "0 0 10px rgba(216,60,60,.75)",
            transition: drag ? "none" : "all .12s ease-out",
          }}>
          <span className="w-[3px] h-[3px] rounded-full bg-white/85" />
        </span>
        {disabled && (
          <span className="absolute inset-0 grid place-items-center rounded-full bg-black/55">
            <Ico.lock className="w-4 h-4 text-cream/70" />
          </span>
        )}
      </div>
      <div className="text-center leading-none">
        <div className="text-[9px] uppercase tracking-[0.16em] text-muted">
          {disabled ? "spin locked" : compact ? "spin" : "english"}
        </div>
        {!disabled && !compact && (
          <div className="display text-[13px] text-brass2/90 tnum mt-0.5">
            {Math.abs(value.x) < 0.06 && Math.abs(value.y) < 0.06 ? "center" :
              `${value.y > 0.06 ? "top" : value.y < -0.06 ? "bottom" : ""}${value.x > 0.06 ? " right" : value.x < -0.06 ? " left" : ""}`.trim()}
          </div>
        )}
      </div>
    </div>
  );
}


