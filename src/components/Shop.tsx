import { useState } from "react";
import { cn } from "@/utils/cn";
import { CUES, SKINS } from "@/game/constants";
import { useProfile } from "@/game/hooks";
import { store } from "@/game/store";
import { sfx } from "@/game/audio";
import { Btn, CoinPill, Ico, Panel, StatBar, Tag } from "./ui";
import { CueBar } from "./Menu";

type Tab = "cues" | "tables";

export default function Shop({ onBack }: { onBack: () => void }) {
  const p = useProfile();
  const [tab, setTab] = useState<Tab>("cues");
  const [flash, setFlash] = useState<string | null>(null);

  const buy = (kind: "cue" | "skin", id: string, price: number) => {
    const owned = kind === "cue" ? p.ownedCues.includes(id) : p.ownedSkins.includes(id);
    if (owned) {
      if (kind === "cue") store.set({ cue: id });
      else store.setSetting("skin", id);
      sfx.ui();
      return;
    }
    if (store.buy(kind, id, price)) {
      sfx.coin();
      setFlash(id);
      setTimeout(() => setFlash(null), 900);
    } else {
      sfx.foul();
      setFlash("poor");
      setTimeout(() => setFlash(null), 900);
    }
  };

  return (
    <div className="relative min-h-full w-full flex flex-col">
      <header className="px-4 sm:px-7 pt-4 pb-3 flex items-center gap-3 border-b border-white/[0.07] bg-ink2/85 backdrop-blur-md sticky top-0 z-20">
        <Btn variant="ghost" size="sm" onClick={() => { sfx.ui(false); onBack(); }} icon={<Ico.back className="w-4 h-4" />}>Back</Btn>
        <div className="min-w-0">
          <h1 className="display text-[27px] leading-none uppercase text-cream tracking-[0.03em]">Pro Shop</h1>
          <p className="text-[11px] text-muted truncate">Better cues hold more power, spin and aim-line length</p>
        </div>
        <div className="flex-1" />
        <CoinPill amount={p.coins} animate={flash !== null && flash !== "poor"} />
      </header>

      <div className="px-4 sm:px-7 pt-3 flex gap-2">
        {(["cues", "tables"] as Tab[]).map((t) => (
          <button key={t} onClick={() => { sfx.ui(); setTab(t); }}
            className={cn("display uppercase text-[17px] px-4 py-1.5 clip-tag border press transition-all tracking-[0.08em]",
              tab === t
                ? "border-accent/60 bg-accent/15 text-accent2 shadow-[0_0_20px_rgba(34,211,238,.22)]"
                : "border-white/[0.08] bg-white/[0.03] text-muted hover:text-cream hover:border-white/20")}>
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 sm:px-7 py-4">
        {flash === "poor" && (
          <div className="mb-3 px-3 py-2 clip-tag bg-crimson/18 border border-crimson/45 text-[12.5px] text-[#ffd7de] anim-slide">
            Not enough coins — win a few racks first.
          </div>
        )}
        {tab === "cues" ? (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3 max-w-6xl mx-auto">
            {CUES.map((c) => {
              const owned = p.ownedCues.includes(c.id);
              const equipped = p.cue === c.id;
              const afford = p.coins >= c.price;
              return (
                <Panel key={c.id}
                  glow={equipped}
                  className={cn("p-4 transition-transform",
                    equipped ? "border-accent/55" : "border-white/[0.09]",
                    flash === c.id && "anim-shake")}>
                  <div className="absolute -right-8 -top-8 w-28 h-28 rounded-full opacity-25 blur-2xl pointer-events-none"
                    style={{ background: c.ring }} />
                  <div className="relative flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="display text-[23px] leading-none uppercase text-cream truncate">{c.name}</div>
                      <div className="mt-1.5">
                        {c.price === 0 ? <Tag tone="muted">Starter</Tag>
                          : equipped ? <Tag tone="accent">In use</Tag>
                          : owned ? <Tag tone="lime">Owned</Tag>
                          : <Tag tone="amber">{c.price.toLocaleString()} coins</Tag>}
                      </div>
                    </div>
                  </div>

                  <div className="relative mt-3 mb-3">
                    <CueBar cueId={c.id} height={16} />
                  </div>

                  <div className="relative grid gap-1.5">
                    <StatBar label="Power" value={c.power} color="#ff6b3d" icon={<Ico.bolt className="w-3 h-3" />} />
                    <StatBar label="Spin" value={c.spin} color="#22d3ee" icon={<Ico.spin className="w-3 h-3" />} />
                    <StatBar label="Aim" value={c.aim} color="#8b5cf6" icon={<Ico.target className="w-3 h-3" />} />
                    <StatBar label="Time" value={c.time} color="#a3ff12" icon={<Ico.timer className="w-3 h-3" />} />
                  </div>

                  <Btn className="w-full mt-3.5"
                    variant={equipped ? "ghost" : owned ? "success" : afford ? "primary" : "secondary"}
                    disabled={!owned && !afford}
                    onClick={() => buy("cue", c.id, c.price)}
                    icon={!owned ? <Ico.coin className="w-4 h-4" /> : undefined}>
                    {equipped ? "Equipped" : owned ? "Equip" : afford ? `Buy ${c.price.toLocaleString()}` : `${c.price.toLocaleString()}`}
                  </Btn>
                </Panel>
              );
            })}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3 max-w-6xl mx-auto">
            {SKINS.map((s) => {
              const owned = p.ownedSkins.includes(s.id);
              const on = p.settings.skin === s.id;
              return (
                <Panel key={s.id}
                  glow={on}
                  className={cn("p-3", on ? "border-accent/55" : "border-white/[0.09]",
                    flash === s.id && "anim-shake")}>
                  <div className="relative overflow-hidden h-28 border border-black/55"
                    style={{
                      background: `linear-gradient(150deg, ${s.wood[2]}, ${s.wood[1]} 60%, ${s.wood[0]})`,
                      clipPath: "polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px)",
                    }}>
                    <div className="absolute inset-[9px] rounded-[5px]"
                      style={{ background: `radial-gradient(80% 130% at 50% 0%, ${s.feltLight}, ${s.felt} 45%, ${s.feltDeep})` }}>
                      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-black/80" />
                      {[0, 1, 2, 3].map((i) => (
                        <div key={i} className="absolute w-2.5 h-2.5 rounded-full bg-black/75"
                          style={{
                            left: i < 2 ? (i ? "88%" : "6%") : "50%",
                            top: i < 2 ? "50%" : (i === 2 ? "6%" : "88%"),
                            transform: "translate(-50%,-50%)",
                          }} />
                      ))}
                    </div>
                    <div className="absolute inset-0" style={{ boxShadow: "inset 0 0 30px rgba(0,0,0,.62)" }} />
                  </div>
                  <div className="flex items-center justify-between mt-3 px-1 gap-2">
                    <div className="min-w-0">
                      <div className="display text-[21px] leading-none uppercase text-cream truncate">{s.name}</div>
                      <div className="mt-1.5">
                        {owned ? (on ? <Tag tone="accent">In use</Tag> : <Tag tone="lime">Owned</Tag>)
                          : <Tag tone="amber">{s.price.toLocaleString()} coins</Tag>}
                      </div>
                    </div>
                    <Btn size="sm" variant={on ? "ghost" : owned ? "success" : p.coins >= s.price ? "primary" : "secondary"}
                      disabled={!owned && p.coins < s.price}
                      onClick={() => buy("skin", s.id, s.price)}>
                      {on ? "Active" : owned ? "Use" : "Buy"}
                    </Btn>
                  </div>
                </Panel>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
