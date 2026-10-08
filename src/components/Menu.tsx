import { useState } from "react";
import { cn } from "@/utils/cn";
import { CUES, DIFFS, RACK_ORDER, SKINS, cueById, skinById } from "@/game/constants";
import { useProfile } from "@/game/hooks";
import { store } from "@/game/store";
import { sfx } from "@/game/audio";
import { BallDot, Btn, CoinPill, Ico, IconBtn, LevelRing, Modal, Panel, Tag } from "./ui";

export interface MatchSetup {
  twoPlayer: boolean;
  diff: string;
  skin: string;
  cue: string;
}

export default function Menu({ onPlay, onShop, onSettings }: {
  onPlay: (s: MatchSetup) => void;
  onShop: () => void;
  onSettings: () => void;
}) {
  const p = useProfile();
  const lp = store.levelProgress;
  const [setup, setSetup] = useState<null | MatchSetup>(null);
  const cue = cueById(p.cue);
  const high = p.settings.physics === "high";

  const open = (twoPlayer: boolean) => {
    sfx.resume();
    sfx.ui();
    setSetup({ twoPlayer, diff: p.settings.difficulty, skin: p.settings.skin, cue: p.cue });
  };

  return (
    <div className="relative min-h-full w-full flex flex-col overflow-y-auto no-scrollbar">
      {/* ---------------------------------------------------------- top bar */}
      <header className="w-full px-4 sm:px-7 pt-4 pb-2 flex items-center gap-3 anim-slide">
        <div className="flex items-center gap-2.5 pl-1.5 pr-3.5 py-1.5 clip-tag glass">
          <LevelRing level={lp.level} pct={lp.pct} />
          <div className="leading-tight">
            <div className="display text-[19px] text-cream uppercase tracking-[0.06em]">{p.name}</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted tnum">
              {lp.into}/{lp.need} xp
            </div>
          </div>
        </div>
        <div className="flex-1" />
        <CoinPill amount={p.coins} />
        <IconBtn label="Shop" onClick={() => { sfx.ui(); onShop(); }} className="w-10 h-10"><Ico.shop /></IconBtn>
        <IconBtn label="Settings" onClick={() => { sfx.ui(); onSettings(); }} className="w-10 h-10"><Ico.gear /></IconBtn>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-7 pb-8 grid lg:grid-cols-12 gap-6 items-center">
        {/* ---------------------------------------- left: identity + actions */}
        <section className="lg:col-span-7 anim-slide">
          <div className="flex items-center gap-2.5 mb-2">
            <span className="h-px w-10 bg-gradient-to-r from-transparent to-accent" />
            <span className="text-[11px] uppercase tracking-[0.42em] text-accent2/85">Pocket · Run · Repeat</span>
          </div>

          <h1 className="display uppercase leading-[0.86]"
            style={{ fontSize: "clamp(48px, 11vw, 104px)" }}>
            <span className="block text-cream" style={{ textShadow: "0 4px 0 rgba(0,0,0,.6), 0 20px 44px rgba(0,0,0,.7)" }}>
              8 Ball
            </span>
            <span className="block neon-text"
              style={{
                background: "linear-gradient(96deg, #86fbff 0%, #22d3ee 34%, #a855f7 68%, #ff2e88 100%)",
                WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
                filter: "drop-shadow(0 6px 24px rgba(34,211,238,.4))",
              }}>
              Pool Plus
            </span>
          </h1>

          <p className="mt-3 max-w-md text-[14.5px] text-muted leading-relaxed">
            Championship 8-ball on a real rigid-body engine — english, throw, swerve,
            cushion transfer and cue-ball deflection, simulated shot by shot.
          </p>

          {/* engine badge */}
          <button
            onClick={() => { sfx.ui(); store.setSetting("physics", high ? "simple" : "high"); }}
            className={cn("press mt-5 flex items-center gap-3 px-3.5 py-2.5 clip-tag border w-full max-w-md text-left transition-all",
              high
                ? "border-accent/45 bg-accent/[0.09] shadow-[0_0_26px_rgba(34,211,238,.16)]"
                : "border-white/10 bg-white/[0.03] hover:border-white/20")}>
            <span className={cn("grid place-items-center w-10 h-10 clip-tag border",
              high ? "border-accent/50 text-accent2 bg-black/40" : "border-white/10 text-muted bg-black/40")}>
              <Ico.atom className="w-5 h-5" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="display uppercase text-[18px] leading-none text-cream">
                {high ? "High Physics Engine" : "Arcade Physics"}
              </span>
              <span className="block text-[11.5px] text-muted mt-1 leading-snug">
                {high
                  ? "Spin, throw, swerve & squirt simulated · tap for arcade"
                  : "Simple, forgiving collisions · tap for full simulation"}
              </span>
            </span>
            <Tag tone={high ? "accent" : "muted"} className="shrink-0">{high ? "on" : "off"}</Tag>
          </button>

          <div className="mt-6 flex flex-col gap-2.5 max-w-md">
            <MenuRow primary label="Play vs CPU" sub="Climb from Rookie to Legend" icon={<Ico.cpu className="w-6 h-6" />}
              onClick={() => open(false)} />
            <MenuRow label="2 Players" sub="Pass & play on one device" icon={<Ico.users className="w-6 h-6" />}
              onClick={() => open(true)} />
            <div className="grid grid-cols-2 gap-2.5 mt-1">
              <MenuRow compact label="Cue Shop" sub={`${p.ownedCues.length}/${CUES.length} owned`} icon={<Ico.shop className="w-5 h-5" />}
                onClick={() => { sfx.ui(); onShop(); }} />
              <MenuRow compact label="Settings" sub="Rules & feel" icon={<Ico.gear className="w-5 h-5" />}
                onClick={() => { sfx.ui(); onSettings(); }} />
            </div>
          </div>

          {/* stats plates */}
          <div className="mt-6 flex flex-wrap gap-2">
            <Plate label="Wins" value={p.wins} tone="lime" />
            <Plate label="Losses" value={p.losses} tone="crimson" />
            <Plate label="Balls potted" value={p.pots} />
            <Plate label="Best break" value={p.bestBreak} />
            <Plate label="Best run" value={p.longestRun} />
          </div>
        </section>

        {/* ------------------------------------------------ right: the rack */}
        <section className="lg:col-span-5 anim-pop">
          <Panel glow className="p-3 sm:p-4">
            <div className="relative w-full aspect-[16/10] overflow-hidden feltbg"
              style={{ clipPath: "polygon(10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%,0 10px)" }}>
              <div className="absolute inset-0 opacity-45"
                style={{ background: "radial-gradient(70% 60% at 50% 22%, rgba(200,255,250,.34), transparent 70%)" }} />
              {/* head string */}
              <div className="absolute inset-y-0 left-1/4 w-px bg-white/14" />
              {/* neon rail lines */}
              <div className="absolute inset-0 pointer-events-none"
                style={{ boxShadow: "inset 0 0 40px rgba(0,0,0,.55), inset 0 0 0 1px rgba(134,251,255,.16)" }} />
              <div className="absolute inset-0 grid place-items-center">
                <Rack />
              </div>
              <div className="absolute left-[16%] bottom-[26%] anim-float">
                <BallDot id={0} size={30} glow />
              </div>
              <div className="absolute right-[12%] top-[16%] anim-spin8 opacity-95">
                <BallDot id={8} size={40} glow />
              </div>
            </div>

            <div className="relative mt-3.5 flex items-end justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-[0.26em] text-accent2/80">Equipped</div>
                <div className="display text-[22px] leading-none text-cream truncate">{cue.name}</div>
                <CueBar cueId={p.cue} className="mt-2" />
              </div>
              <div className="text-right shrink-0">
                <div className="text-[10px] uppercase tracking-[0.22em] text-accent2/80">Table</div>
                <div className="display text-[19px] leading-none text-cream">{skinById(p.settings.skin).name.split(" ")[0]}</div>
                <div className="mt-1.5 flex gap-1 justify-end">
                  {p.ownedSkins.map((s) => (
                    <span key={s} className="w-3.5 h-3.5 rounded-full border border-black/50"
                      style={{
                        background: skinById(s).felt,
                        boxShadow: s === p.settings.skin ? `0 0 0 1.5px ${skinById(s).diamond}, 0 0 10px ${skinById(s).ui}` : undefined,
                      }} />
                  ))}
                </div>
              </div>
            </div>
          </Panel>
        </section>
      </main>

      {setup && (
        <SetupModal
          setup={setup}
          onClose={() => setSetup(null)}
          onChange={setSetup}
          onStart={() => {
            store.setSetting("difficulty", setup.diff);
            store.setSetting("skin", setup.skin);
            store.setSetting("twoPlayer", setup.twoPlayer);
            store.set({ cue: setup.cue });
            sfx.ui(false);
            onPlay(setup);
          }}
        />
      )}
    </div>
  );
}

function Rack() {
  let idx = 0;
  const rows = [1, 2, 3, 4, 5];
  return (
    <div className="flex flex-col items-center gap-[3px] rotate-[-90deg] scale-[0.82] sm:scale-100">
      {rows.map((n, r) => (
        <div key={r} className="flex gap-[3px]">
          {Array.from({ length: n }, () => {
            const id = RACK_ORDER[idx++];
            return <BallDot key={`${r}-${id}`} id={id} size={26} />;
          })}
        </div>
      ))}
    </div>
  );
}

export function CueBar({ cueId, className, height = 12 }: { cueId: string; className?: string; height?: number }) {
  const c = cueById(cueId);
  const seg: [string, number, string][] = [
    ["#2f77ab", 2.4, ""],
    ["#f0ead6", 2.6, ""],
    [c.wood[0], 42, `linear-gradient(180deg,#f0d3a2,#c8a26a 40%,#8a5f2e)`],
    [c.ring, 3, ""],
    [c.wrap, 20, `repeating-linear-gradient(115deg, ${c.wrap} 0 3px, rgba(255,255,255,.10) 3px 6px)`],
    [c.wood[1], 28, `linear-gradient(180deg, ${c.wood[0]}, ${c.wood[1]} 60%, #000)`],
    ["#151515", 2, ""],
  ];
  return (
    <div className={cn("flex w-full overflow-hidden rounded-full border border-black/60 shadow-[0_2px_6px_rgba(0,0,0,.6)]", className)}
      style={{ height }}>
      {seg.map(([bg, w, extra], i) => (
        <div key={i} style={{ width: `${w}%`, background: extra || bg }} className="h-full" />
      ))}
    </div>
  );
}

function MenuRow({ label, sub, icon, onClick, primary, compact }: {
  label: string; sub: string; icon: React.ReactNode; onClick: () => void; primary?: boolean; compact?: boolean;
}) {
  return (
    <button onClick={onClick}
      className={cn("press group relative w-full flex items-center gap-3.5 pl-3.5 pr-3 clip-tag border text-left overflow-hidden transition-all",
        compact ? "py-2.5" : "py-3",
        primary
          ? "neon-cta border-transparent"
          : "neon-line hover:translate-x-[2px]")}>
      <span className={cn("grid place-items-center w-10 h-10 clip-tag shrink-0",
        primary ? "bg-black/25 text-[#04222b]" : "bg-black/40 text-accent2")}>
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className={cn("display block leading-none uppercase tracking-[0.04em]",
          compact ? "text-[18px]" : "text-[23px]")}>{label}</span>
        <span className={cn("block text-[11.5px] mt-1 truncate",
          primary ? "text-[#04222b]/75" : "text-cream/55")}>{sub}</span>
      </span>
      <Ico.fwd className={cn("w-5 h-5 transition-transform group-hover:translate-x-1",
        primary ? "text-[#04222b]" : "text-accent2/70")} />
    </button>
  );
}

function Plate({ label, value, tone = "accent" }: { label: string; value: number; tone?: "accent" | "lime" | "crimson" }) {
  const color = tone === "lime" ? "#a3ff12" : tone === "crimson" ? "#ff3b5c" : "#86fbff";
  return (
    <div className="px-3 py-1.5 clip-tag bg-white/[0.035] border border-white/[0.08]">
      <div className="display text-[19px] leading-none tnum" style={{ color, textShadow: `0 0 12px ${color}66` }}>
        {value}
      </div>
      <div className="text-[9.5px] uppercase tracking-[0.18em] text-muted mt-0.5">{label}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function SetupModal({ setup, onChange, onClose, onStart }: {
  setup: MatchSetup; onChange: (s: MatchSetup) => void; onClose: () => void; onStart: () => void;
}) {
  const p = useProfile();
  return (
    <Modal onClose={onClose} wide className="max-h-[92vh] overflow-y-auto no-scrollbar">
      <div className="p-5">
        <div className="display text-[30px] leading-none uppercase text-cream tracking-[0.02em]">
          {setup.twoPlayer ? "Pass & Play" : "Choose your opponent"}
        </div>
        <p className="text-[12.5px] text-muted mt-1.5">
          Higher stakes pay more coins. Winner takes the rack.
        </p>

        {!setup.twoPlayer && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {DIFFS.map((d) => {
              const on = setup.diff === d.id;
              return (
                <button key={d.id} onClick={() => { sfx.ui(); onChange({ ...setup, diff: d.id }); }}
                  className={cn("press clip-tag p-3 border text-left transition-all",
                    on
                      ? "bg-white/[0.09] border-white/25"
                      : "bg-black/35 border-white/[0.08] hover:bg-white/[0.05]")}
                  style={on ? { boxShadow: `0 0 0 1px ${d.accent}88 inset, 0 0 24px ${d.accent}33` } : undefined}>
                  <div className="flex items-center justify-between">
                    <span className="display text-[21px] leading-none uppercase text-cream">{d.name}</span>
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.accent, boxShadow: `0 0 10px ${d.accent}` }} />
                  </div>
                  <div className="text-[11px] text-muted mt-1">{d.tag}</div>
                  <div className="flex items-center gap-1 mt-2 text-amber">
                    <Ico.coin className="w-3.5 h-3.5" />
                    <span className="display text-[16px] leading-none tnum">{d.reward}</span>
                    <span className="text-[10px] text-muted ml-auto tnum">{d.clock}s</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-5 grid sm:grid-cols-2 gap-5">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-accent2/80 mb-2">Table cloth</div>
            <div className="grid grid-cols-2 gap-2">
              {SKINS.map((s) => {
                const owned = p.ownedSkins.includes(s.id);
                const on = setup.skin === s.id;
                return (
                  <button key={s.id} disabled={!owned}
                    onClick={() => { sfx.ui(); onChange({ ...setup, skin: s.id }); }}
                    className={cn("press clip-tag overflow-hidden border text-left transition-all",
                      on ? "border-accent" : "border-white/10 hover:border-white/25", !owned && "opacity-40")}
                    style={on ? { boxShadow: "0 0 0 1px rgba(34,211,238,.6) inset, 0 0 22px rgba(34,211,238,.24)" } : undefined}>
                    <span className="block h-10" style={{ background: `linear-gradient(140deg, ${s.wood[2]}, ${s.wood[1]})` }}>
                      <span className="block m-[5px] h-[calc(100%-10px)] rounded-[3px]" style={{ background: `radial-gradient(80% 120% at 50% 0%, ${s.feltLight}, ${s.feltDeep})` }} />
                    </span>
                    <span className="block px-2 py-1.5 bg-black/55">
                      <span className="display block text-[15px] leading-none text-cream truncate">{s.name}</span>
                      {!owned && <span className="text-[10px] text-magenta">Shop only</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-accent2/80 mb-2">Your cue</div>
            <div className="flex flex-col gap-2 max-h-[210px] overflow-y-auto pr-1">
              {p.ownedCues.map((id) => {
                const c = cueById(id);
                const on = setup.cue === id;
                return (
                  <button key={id} onClick={() => { sfx.ui(); onChange({ ...setup, cue: id }); }}
                    className={cn("press clip-tag px-3 py-2 border text-left transition-all",
                      on ? "border-accent bg-accent/10" : "border-white/[0.08] bg-black/35 hover:border-white/20")}
                    style={on ? { boxShadow: "0 0 22px rgba(34,211,238,.2)" } : undefined}>
                    <div className="flex items-center justify-between">
                      <span className="display text-[18px] leading-none text-cream">{c.name}</span>
                      {on && <Ico.check className="w-4 h-4 text-accent2" />}
                    </div>
                    <CueBar cueId={id} className="mt-2" height={9} />
                    <div className="flex gap-3 mt-1.5 text-[10px] uppercase tracking-[0.12em] text-muted tnum">
                      <span>PW {c.power}</span><span>SP {c.spin}</span><span>AIM {c.aim}</span><span>TIME {c.time}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-5 flex gap-2.5">
          <Btn variant="ghost" onClick={onClose} className="flex-1">Back</Btn>
          <Btn variant="primary" size="lg" onClick={onStart} className="flex-[2]" icon={<Ico.play className="w-5 h-5" />}>
            Rack 'em up
          </Btn>
        </div>
      </div>
    </Modal>
  );
}
