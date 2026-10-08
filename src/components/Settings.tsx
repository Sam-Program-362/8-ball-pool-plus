import { cn } from "@/utils/cn";
import { DIFFS } from "@/game/constants";
import { useProfile } from "@/game/hooks";
import { store } from "@/game/store";
import { sfx } from "@/game/audio";
import { Btn, Ico, Modal, Toggle } from "./ui";

export default function Settings({ onBack, embedded }: { onBack?: () => void; embedded?: boolean }) {
  const p = useProfile();
  const s = p.settings;

  const body = (
    <div className="p-5">
      <div className="display text-[30px] leading-none uppercase text-cream tracking-[0.02em]">Settings</div>
      <p className="text-[12.5px] text-muted mt-1.5">Tune the simulation, the rules and the feel.</p>

      <div className="mt-4 grid gap-2">
        <div className={cn("clip-tag border p-3.5 transition-all",
          s.physics === "high"
            ? "border-accent/50 bg-accent/[0.08] shadow-[0_0_28px_rgba(34,211,238,.14)]"
            : "border-white/[0.08] bg-white/[0.03]")}>
          <Toggle
            on={s.physics === "high"}
            onChange={(v) => { store.setSetting("physics", v ? "high" : "simple"); sfx.ui(v); }}
            label="High Physics Engine"
            accent="#22d3ee"
            icon={<Ico.atom />}
            desc="Full rigid-body simulation: sliding → rolling transitions, ball-ball friction (throw), spin transfer, cushion english, swerve and cue deflection (squirt)."
          />
          <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[10.5px]">
            {[
              ["Throw", s.physics === "high"],
              ["Swerve", s.physics === "high"],
              ["English off rails", s.physics === "high"],
              ["Draw / follow", s.physics === "high"],
            ].map(([label, on]) => (
              <div key={label as string}
                className={cn("px-2 py-1.5 clip-tag border text-center uppercase tracking-[0.08em]",
                  on ? "border-accent/40 text-accent2 bg-black/35" : "border-white/[0.07] text-muted bg-black/25")}>
                {label as string}
                <span className="block text-[9px] mt-0.5 opacity-70">{on ? "simulated" : "off"}</span>
              </div>
            ))}
          </div>
          <p className="text-[11.5px] text-muted mt-2.5 leading-snug">
            Arcade mode keeps the classic casual-pool feel: perfectly elastic collisions, no spin, slightly
            friendlier pockets. Switching mid-match keeps the table exactly as it is.
          </p>
        </div>

        <Toggle on={s.sound} onChange={(v) => { store.setSetting("sound", v); sfx.setSfx(v); if (v) sfx.ui(); }}
          label="Sound effects" desc="Synthesised clacks, cushions and pocket drops" icon={<Ico.sound />} />
        <Toggle on={s.music} onChange={(v) => { store.setSetting("music", v); sfx.setMusic(v); }}
          label="Ambient room tone" desc="Low billiard-hall pad while you play" icon={<Ico.music />} accent="#8b5cf6" />
        <Toggle on={s.guides} onChange={(v) => store.setSetting("guides", v)}
          label="Aim guides" desc="Ghost ball, object-ball path and cushion rebounds" icon={<Ico.target />} accent="#a3ff12" />
        <Toggle on={s.timer} onChange={(v) => store.setSetting("timer", v)}
          label="Shot clock" desc="Foul if you run out of time" icon={<Ico.timer />} accent="#ffb020" />
        <Toggle on={s.haptics} onChange={(v) => store.setSetting("haptics", v)}
          label="Vibration" desc="Haptic feedback on impacts (mobile)" icon={<Ico.hand />} accent="#ff2e88" />

        <div className="clip-tag border border-white/[0.08] bg-white/[0.03] p-3.5 mt-1">
          <div className="display text-[18px] uppercase text-cream mb-2 tracking-[0.04em]">Default opponent</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {DIFFS.map((d) => {
              const on = s.difficulty === d.id;
              return (
                <button key={d.id} onClick={() => { sfx.ui(); store.setSetting("difficulty", d.id); }}
                  className={cn("press clip-tag px-2 py-2 border text-left transition-all",
                    on ? "border-white/25 bg-white/[0.08]" : "border-white/[0.07] bg-black/30 hover:border-white/20")}
                  style={on ? { boxShadow: `0 0 0 1px ${d.accent}88 inset, 0 0 22px ${d.accent}2e` } : undefined}>
                  <div className="display text-[17px] leading-none uppercase text-cream">{d.name}</div>
                  <div className="text-[10px] text-muted mt-1">{d.tag}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="clip-tag border border-white/[0.08] bg-white/[0.03] p-3.5 mt-1">
          <div className="display text-[18px] uppercase text-cream mb-1.5 tracking-[0.04em]">How to play</div>
          <ul className="text-[12px] text-muted space-y-1.5 leading-snug">
            <li><b className="text-cream/85">Aim</b> — drag anywhere on the cloth, or tap a ball to line up instantly. Use ◀ ▶ for micro-adjustments.</li>
            <li><b className="text-cream/85">Power</b> — drag the meter, then hit STRIKE. On desktop: arrow keys aim, ↑/↓ set power, space shoots.</li>
            <li><b className="text-cream/85">English</b> — drag the dot on the mini cue ball. Top = follow, bottom = draw, sides = english (High Physics only).</li>
            <li><b className="text-cream/85">Rules</b> — pot a ball after the break to claim solids or stripes. Clear your group, then sink the 8. Scratch or hit the wrong group and your opponent gets ball in hand. Three fouls in a row loses the rack.</li>
          </ul>
        </div>

        <Btn variant="danger" className="w-full mt-3" icon={<Ico.restart className="w-4 h-4" />}
          onClick={() => { sfx.foul(); store.reset(); }}>
          Reset progress
        </Btn>
      </div>
    </div>
  );

  if (embedded) return body;
  return (
    <div className="relative min-h-full w-full flex flex-col">
      <header className="px-4 sm:px-7 pt-4 pb-3 flex items-center gap-3 border-b border-white/[0.07] bg-ink2/85 backdrop-blur-md sticky top-0 z-20">
        <Btn variant="ghost" size="sm" onClick={() => { sfx.ui(false); onBack?.(); }} icon={<Ico.back className="w-4 h-4" />}>Back</Btn>
        <div className="display text-[27px] leading-none uppercase text-cream tracking-[0.03em]">Settings</div>
      </header>
      <div className="flex-1 overflow-y-auto max-w-2xl w-full mx-auto">{body}</div>
    </div>
  );
}

export function SettingsModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal onClose={onClose} wide className="max-h-[92vh] overflow-y-auto no-scrollbar">
      <Settings embedded />
    </Modal>
  );
}
