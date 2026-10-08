import { useState } from "react";
import { cn } from "@/utils/cn";
import { CUES, SKINS } from "@/game/constants";
import { useProfile } from "@/game/hooks";
import { store } from "@/game/store";
import { sfx } from "@/game/audio";
import { Btn, CoinPill, Ico, StatBar } from "./ui";
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
      <header className="px-4 sm:px-7 pt-4 pb-3 flex items-center gap-3 border-b border-white/[0.06] bg-black/25 backdrop-blur-[2px] sticky top-0 z-20">
        <Btn variant="ghost" size="sm" onClick={() => { sfx.ui(false); onBack(); }} icon={<Ico.back className="w-4 h-4" />}>Back</Btn>
        <div>
          <h1 className="display text-[27px] leading-none uppercase text-cream">Pro Shop</h1>
          <p className="text-[11px] text-muted">Better cues hold more power, spin and aim-line length</p>
        </div>
        <div className="flex-1" />
        <CoinPill amount={p.coins} animate={flash !== null && flash !== "poor"} />
      </header>

      <div className="px-4 sm:px-7 pt-3 flex gap-2">
        {(["cues", "tables"] as Tab[]).map((t) => (
          <button key={t} onClick={() => { sfx.ui(); setTab(t); }}
            className={cn("display uppercase text-[17px] px-4 py-1.5 rounded-lg border press",
              tab === t ? "border-brass/60 bg-brass/15 text-brass2" : "border-white/[0.07] bg-white/[0.03] text-muted")}>
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 sm:px-7 py-4">
        {flash === "poor" && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-crimson/20 border border-crimson/40 text-[12.5px] text-[#ffd9d3] anim-slide">
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
                <div key={c.id}
                  className={cn("relative rounded-xl border p-4 overflow-hidden transition-transform",
                    equipped ? "border-brass/70 bg-brass/[0.07]" : "border-white/[0.08] bg-[linear-gradient(160deg,rgba(255,255,255,.045),rgba(0,0,0,.35))]",
                    flash === c.id && "anim-shake")}>
                  <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-25 blur-xl"
                    style={{ background: c.ring }} />
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="display text-[23px] leading-none uppercase text-cream">{c.name}</div>
                      <div className="text-[10.5px] uppercase tracking-[0.18em] text-muted mt-1">
                        {c.price === 0 ? "Starter" : equipped ? "Equipped" : owned ? "Owned" : `${c.price.toLocaleString()} coins`}
                      </div>
                    </div>
                    {equipped && <span className="display text-[12px] uppercase px-2 py-0.5 rounded bg-brass text-[#221703]">In use</span>}
                  </div>

                  <div className="mt-3 mb-3">
                    <CueBar cueId={c.id} height={16} />
                  </div>

                  <div className="grid gap-1.5">
                    <StatBar label="Power" value={c.power} color="#e0603c" icon={<Ico.bolt className="w-3 h-3" />} />
                    <StatBar label="Spin" value={c.spin} color="#4fa3e0" icon={<Ico.spin className="w-3 h-3" />} />
                    <StatBar label="Aim" value={c.aim} color="#d9a441" icon={<Ico.target className="w-3 h-3" />} />
                    <StatBar label="Time" value={c.time} color="#5fbf7f" icon={<Ico.timer className="w-3 h-3" />} />
                  </div>

                  <Btn className="w-full mt-3.5"
                    variant={equipped ? "ghost" : owned ? "felt" : afford ? "gold" : "wood"}
                    disabled={!owned && !afford}
                    onClick={() => buy("cue", c.id, c.price)}
                    icon={!owned ? <Ico.coin className="w-4 h-4" /> : undefined}>
                    {equipped ? "Equipped" : owned ? "Equip" : afford ? `Buy ${c.price.toLocaleString()}` : `${c.price.toLocaleString()}`}
                  </Btn>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3 max-w-6xl mx-auto">
            {SKINS.map((s) => {
              const owned = p.ownedSkins.includes(s.id);
              const on = p.settings.skin === s.id;
              return (
                <div key={s.id}
                  className={cn("rounded-xl border p-3 overflow-hidden",
                    on ? "border-brass/70 bg-brass/[0.07]" : "border-white/[0.08] bg-white/[0.03]",
                    flash === s.id && "anim-shake")}>
                  <div className="relative rounded-lg overflow-hidden h-28 border border-black/50"
                    style={{ background: `linear-gradient(150deg, ${s.wood[2]}, ${s.wood[1]} 60%, ${s.wood[0]})` }}>
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
                    <div className="absolute inset-0" style={{ boxShadow: "inset 0 0 30px rgba(0,0,0,.6)" }} />
                  </div>
                  <div className="flex items-center justify-between mt-3 px-1">
                    <div>
                      <div className="display text-[21px] leading-none uppercase text-cream">{s.name}</div>
                      <div className="text-[10.5px] uppercase tracking-[0.16em] text-muted mt-1">
                        {owned ? (on ? "In use" : "Owned") : `${s.price.toLocaleString()} coins`}
                      </div>
                    </div>
                    <Btn size="sm" variant={on ? "ghost" : owned ? "felt" : p.coins >= s.price ? "gold" : "wood"}
                      disabled={!owned && p.coins < s.price}
                      onClick={() => buy("skin", s.id, s.price)}>
                      {on ? "Active" : owned ? "Use" : "Buy"}
                    </Btn>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
