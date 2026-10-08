import React from "react";
import { cn } from "@/utils/cn";
import { BALL_COLORS, isStripe } from "@/game/constants";

/* ---------------------------------------------------------------- icons */
type IP = { className?: string };
const S = (p: IP & { children: React.ReactNode; vb?: string }) => (
  <svg viewBox={p.vb ?? "0 0 24 24"} className={cn("w-5 h-5", p.className)} fill="none"
    stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    {p.children}
  </svg>
);

export const Ico = {
  play: (p: IP) => <S {...p}><path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none" /></S>,
  gear: (p: IP) => <S {...p}><circle cx="12" cy="12" r="3.2" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7.5 19.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3 14.6a2 2 0 0 1 0-4 1.6 1.6 0 0 0 1.6-1.1l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 4.6V4a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.6 1.6 0 0 0 21 10.6a2 2 0 0 1 0 4 1.6 1.6 0 0 0-1.6.4z" /></S>,
  shop: (p: IP) => <S {...p}><path d="M4 8h16l-1.2 11.2a1.6 1.6 0 0 1-1.6 1.4H6.8a1.6 1.6 0 0 1-1.6-1.4z" /><path d="M8.6 8V6.2a3.4 3.4 0 0 1 6.8 0V8" /></S>,
  trophy: (p: IP) => <S {...p}><path d="M7 4h10v5a5 5 0 0 1-10 0z" /><path d="M7 5.5H4.5V7a3.5 3.5 0 0 0 3 3.4M17 5.5h2.5V7a3.5 3.5 0 0 1-3 3.4" /><path d="M10 14h4l.6 4H9.4zM7.5 20h9" /></S>,
  users: (p: IP) => <S {...p}><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19.5a5.5 5.5 0 0 1 11 0M16 5.4a3.2 3.2 0 0 1 0 5.9M17.5 14.6a5.5 5.5 0 0 1 3 4.9" /></S>,
  cpu: (p: IP) => <S {...p}><rect x="6.5" y="6.5" width="11" height="11" rx="2" /><rect x="10" y="10" width="4" height="4" rx="1" /><path d="M9.5 3v3.5M14.5 3v3.5M9.5 17.5V21M14.5 17.5V21M3 9.5h3.5M3 14.5h3.5M17.5 9.5H21M17.5 14.5H21" /></S>,
  coin: (p: IP) => <S {...p}><circle cx="12" cy="12" r="8.2" /><path d="M12 7.6v8.8M14.4 9.4c-.6-.7-1.5-1-2.4-1-1.3 0-2.3.7-2.3 1.8 0 2.4 4.8 1.2 4.8 3.6 0 1.1-1 1.9-2.4 1.9-1 0-1.9-.4-2.4-1.1" /></S>,
  sound: (p: IP) => <S {...p}><path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4z" /><path d="M15.6 9a4.2 4.2 0 0 1 0 6M18.2 6.4a7.8 7.8 0 0 1 0 11.2" /></S>,
  mute: (p: IP) => <S {...p}><path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4z" /><path d="M16 9.5l5 5M21 9.5l-5 5" /></S>,
  music: (p: IP) => <S {...p}><path d="M9 18V6.5l10-2V16" /><circle cx="6.6" cy="18" r="2.4" /><circle cx="16.6" cy="16" r="2.4" /></S>,
  timer: (p: IP) => <S {...p}><circle cx="12" cy="13.2" r="7.4" /><path d="M12 9.6v3.8l2.6 1.8M9.4 2.6h5.2" /></S>,
  atom: (p: IP) => <S {...p}><circle cx="12" cy="12" r="2" /><ellipse cx="12" cy="12" rx="9.4" ry="4" /><ellipse cx="12" cy="12" rx="9.4" ry="4" transform="rotate(60 12 12)" /><ellipse cx="12" cy="12" rx="9.4" ry="4" transform="rotate(120 12 12)" /></S>,
  target: (p: IP) => <S {...p}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3.4" /><path d="M12 1.6v3.2M12 19.2v3.2M1.6 12h3.2M19.2 12h3.2" /></S>,
  bolt: (p: IP) => <S {...p}><path d="M13.4 2.5 4.8 13.2h6L10.2 21.5l8.8-10.9h-6.2z" /></S>,
  back: (p: IP) => <S {...p}><path d="M15 5.5 8.4 12l6.6 6.5" /></S>,
  fwd: (p: IP) => <S {...p}><path d="M9 5.5 15.6 12 9 18.5" /></S>,
  close: (p: IP) => <S {...p}><path d="M6 6l12 12M18 6 6 18" /></S>,
  pause: (p: IP) => <S {...p}><path d="M8.5 5v14M15.5 5v14" strokeWidth={2.4} /></S>,
  home: (p: IP) => <S {...p}><path d="M4 10.6 12 4l8 6.6V20a1 1 0 0 1-1 1h-4.4v-6H9.4v6H5a1 1 0 0 1-1-1z" /></S>,
  restart: (p: IP) => <S {...p}><path d="M20 12a8 8 0 1 1-2.6-5.9" /><path d="M20.4 4v4.6h-4.6" /></S>,
  lock: (p: IP) => <S {...p}><rect x="4.8" y="10.4" width="14.4" height="9.6" rx="2" /><path d="M8.4 10.4V7.6a3.6 3.6 0 0 1 7.2 0v2.8" /></S>,
  check: (p: IP) => <S {...p}><path d="M4.8 12.6 9.6 17.4 19.2 6.8" strokeWidth={2.4} /></S>,
  flag: (p: IP) => <S {...p}><path d="M5.6 21V3.8h12.8l-2.4 4.4 2.4 4.4H5.6" /></S>,
  spin: (p: IP) => <S {...p}><circle cx="12" cy="12" r="8.4" /><circle cx="12" cy="12" r="1.6" fill="currentColor" /><path d="M12 3.6a8.4 8.4 0 0 1 8.4 8.4" strokeDasharray="2 3" /></S>,
  star: (p: IP) => <S {...p}><path d="m12 3.6 2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 17l-5.3 2.8 1.1-5.9L3.5 9.8l5.9-.8z" /></S>,
  hand: (p: IP) => <S {...p}><path d="M8 11V5.6a1.6 1.6 0 0 1 3.2 0V11m0-.6V4.4a1.6 1.6 0 0 1 3.2 0V11m0-.4V6.4a1.6 1.6 0 0 1 3.2 0V14a6.6 6.6 0 0 1-6.6 6.6h-.8A6 6 0 0 1 5 15.4l-1-2.6a1.6 1.6 0 0 1 2.7-1.7L8 13" /></S>,
};

/* ---------------------------------------------------------------- balls */
export function BallDot({ id, size = 22, dim = false, glow = false, className }: {
  id: number; size?: number; dim?: boolean; glow?: boolean; className?: string;
}) {
  const c = BALL_COLORS[id];
  const stripe = isStripe(id);
  const bg = stripe
    ? `radial-gradient(circle at 32% 28%, #ffffff, #ded8c8 62%, #a9a294), linear-gradient(${c},${c})`
    : `radial-gradient(circle at 32% 28%, rgba(255,255,255,.85), rgba(255,255,255,0) 46%), radial-gradient(circle at 68% 78%, rgba(0,0,0,.45), rgba(0,0,0,0) 55%), ${c}`;
  return (
    <span
      className={cn("relative inline-grid place-items-center rounded-full shrink-0", className)}
      style={{
        width: size, height: size, overflow: "hidden",
        background: stripe ? `radial-gradient(circle at 34% 30%, #fff, #d9d3c4 70%, #a49d8e)` : bg,
        boxShadow: glow
          ? `0 0 0 1.5px rgba(255,225,150,.9), 0 0 12px 2px ${c}88`
          : "inset 0 -1px 2px rgba(0,0,0,.5), 0 1px 2px rgba(0,0,0,.5)",
        opacity: dim ? 0.28 : 1,
        filter: dim ? "grayscale(.6)" : undefined,
      }}
    >
      {stripe && (
        <span className="absolute"
          style={{ left: 0, right: 0, top: size * 0.27, height: size * 0.46, background: c }} />
      )}
      {id > 0 && size >= 15 && (
        <span className={cn("relative rounded-full grid place-items-center font-bold", stripe ? "" : "")}
          style={{
            width: size * 0.52, height: size * 0.52, background: "#f8f5ec",
            color: "#1b1b1b", fontSize: size * 0.32, lineHeight: 1,
            boxShadow: "inset 0 -1px 1px rgba(0,0,0,.25)",
          }}>
          {id}
        </span>
      )}
      {id === 0 && (
        <span className="relative rounded-full" style={{ width: size * 0.22, height: size * 0.22, background: "#b8243a", opacity: .5 }} />
      )}
    </span>
  );
}

/* ---------------------------------------------------------------- buttons */
type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "gold" | "wood" | "ghost" | "danger" | "felt";
  size?: "sm" | "md" | "lg";
  icon?: React.ReactNode;
};

export function Btn({ variant = "wood", size = "md", icon, className, children, ...rest }: BtnProps) {
  const sizes = {
    sm: "px-3 py-1.5 text-[12px] tracking-wide",
    md: "px-4 py-2.5 text-[14px] tracking-wide",
    lg: "px-6 py-3.5 text-[17px] tracking-wider",
  }[size];
  const variants = {
    gold: "text-[#221703] brassplate shadow-[0_6px_0_#6d4c12,0_10px_24px_rgba(0,0,0,.55)] hover:brightness-110 border border-[#ffe9b0]/50",
    wood: "text-cream wood shadow-[0_5px_0_#1a0f07,0_10px_22px_rgba(0,0,0,.5)] hover:brightness-115 border border-[#a9763c]/40",
    felt: "text-cream feltbg shadow-[0_5px_0_#06281a,0_10px_22px_rgba(0,0,0,.45)] hover:brightness-115 border border-[#4bd39a]/25",
    ghost: "text-muted bg-white/[0.04] border border-white/10 hover:text-cream hover:bg-white/[0.08]",
    danger: "text-[#ffd9d3] bg-gradient-to-b from-[#a5332a] to-[#6b1c17] border border-[#ff9c8f]/30 shadow-[0_5px_0_#3d0f0b] hover:brightness-110",
  }[variant];
  return (
    <button
      {...rest}
      className={cn(
        "display uppercase font-semibold rounded-[10px] press inline-flex items-center justify-center gap-2 select-none",
        "disabled:opacity-40 disabled:pointer-events-none", sizes, variants, className,
      )}
    >
      {icon}
      {children}
    </button>
  );
}

export function IconBtn({ label, active, className, children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  label?: string; active?: boolean; children: React.ReactNode;
}) {
  return (
    <button {...rest} title={label} aria-label={label}
      className={cn(
        "press grid place-items-center rounded-lg border transition-colors",
        active ? "border-brass/60 bg-brass/15 text-brass2" : "border-white/10 bg-white/[0.04] text-muted hover:text-cream",
        className,
      )}>
      {children}
    </button>
  );
}

/* ---------------------------------------------------------------- bits */
export function StatBar({ label, value, color = "#d9a441", icon }: { label: string; value: number; color?: string; icon?: React.ReactNode }) {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-muted mb-1">
        <span className="flex items-center gap-1">{icon}{label}</span>
        <span className="tnum text-cream/80">{value}</span>
      </div>
      <div className="h-[6px] rounded-full bg-black/50 overflow-hidden border border-white/5">
        <div className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${value}%`, background: `linear-gradient(90deg, ${color}66, ${color})`, boxShadow: `0 0 10px ${color}77` }} />
      </div>
    </div>
  );
}

export function Toggle({ on, onChange, label, desc, icon, accent = "#d9a441" }: {
  on: boolean; onChange: (v: boolean) => void; label: string; desc?: string; icon?: React.ReactNode; accent?: string;
}) {
  return (
    <button onClick={() => onChange(!on)}
      className="press w-full flex items-center gap-3 px-3.5 py-3 rounded-xl bg-white/[0.035] border border-white/[0.07] hover:bg-white/[0.06] text-left">
      {icon && <span className={cn("shrink-0 transition-colors", on ? "text-brass2" : "text-muted")}>{icon}</span>}
      <span className="flex-1 min-w-0">
        <span className="block display text-[17px] leading-tight text-cream uppercase">{label}</span>
        {desc && <span className="block text-[11.5px] text-muted leading-snug mt-0.5">{desc}</span>}
      </span>
      <span className={cn("relative w-11 h-6 rounded-full shrink-0 border transition-colors",
        on ? "border-transparent" : "border-white/15 bg-black/45")}
        style={on ? { background: `linear-gradient(90deg, ${accent}88, ${accent})` } : undefined}>
        <span className={cn("absolute top-0.5 w-5 h-5 rounded-full bg-cream shadow transition-all",
          on ? "left-[22px]" : "left-0.5 bg-muted/70")} />
      </span>
    </button>
  );
}

export function CoinPill({ amount, className, animate }: { amount: number; className?: string; animate?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/45 border border-brass/25",
      animate && "anim-glow", className)}>
      <Ico.coin className="w-3.5 h-3.5 text-brass2" />
      <span className="display text-[16px] leading-none tnum text-brass2">{amount.toLocaleString()}</span>
    </span>
  );
}

export function LevelRing({ level, pct, size = 46 }: { level: number; pct: number; size?: number }) {
  const r = size / 2 - 3.5;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.1)" strokeWidth={3.4} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#lg)" strokeWidth={3.4}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
          style={{ transition: "stroke-dashoffset .8s cubic-bezier(.2,.8,.2,1)" }} />
        <defs>
          <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f4d68a" /><stop offset="100%" stopColor="#c07f1d" />
          </linearGradient>
        </defs>
      </svg>
      <span className="absolute display text-[17px] leading-none text-brass2 tnum">{level}</span>
    </div>
  );
}

export function Modal({ children, onClose, className, wide }: {
  children: React.ReactNode; onClose?: () => void; className?: string; wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-3 bg-black/72 backdrop-blur-[3px]"
      onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className={cn("anim-pop relative w-full rounded-2xl border border-white/10 overflow-hidden",
          "bg-[linear-gradient(165deg,#1b211c,#0d1210_70%)] shadow-[0_30px_80px_rgba(0,0,0,.8)]",
          wide ? "max-w-2xl" : "max-w-sm", className)}>
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brass/60 to-transparent" />
        {onClose && (
          <button onClick={onClose} aria-label="Close"
            className="absolute top-2.5 right-2.5 z-10 grid place-items-center w-8 h-8 rounded-lg text-muted hover:text-cream hover:bg-white/10 press">
            <Ico.close className="w-4 h-4" />
          </button>
        )}
        {children}
      </div>
    </div>
  );
}

export function SectionTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="mb-3">
      <h2 className="display text-[26px] leading-none uppercase text-cream tracking-wide">{children}</h2>
      {sub && <p className="text-[12px] text-muted mt-1">{sub}</p>}
    </div>
  );
}
