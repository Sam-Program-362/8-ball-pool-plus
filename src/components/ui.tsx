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
  const shell = stripe
    ? "radial-gradient(circle at 34% 28%, #ffffff, #e4eef6 58%, #9aa8b6)"
    : `radial-gradient(circle at 32% 26%, rgba(255,255,255,.92), rgba(255,255,255,0) 44%),
       radial-gradient(circle at 70% 80%, rgba(0,0,0,.5), rgba(0,0,0,0) 56%), ${c}`;
  return (
    <span
      className={cn("relative inline-grid place-items-center rounded-full shrink-0", className)}
      style={{
        width: size, height: size, overflow: "hidden",
        background: shell,
        boxShadow: glow
          ? `0 0 0 1.5px rgba(134,251,255,.95), 0 0 14px 3px ${c}aa, 0 0 26px 6px rgba(34,211,238,.35)`
          : "inset 0 -1.5px 3px rgba(0,0,0,.55), inset 0 1px 1px rgba(255,255,255,.28), 0 2px 4px rgba(0,0,0,.6)",
        opacity: dim ? 0.26 : 1,
        filter: dim ? "grayscale(.7)" : undefined,
        transition: "box-shadow .25s ease, opacity .25s ease",
      }}
    >
      {stripe && (
        <span className="absolute"
          style={{
            left: 0, right: 0, top: size * 0.27, height: size * 0.46, background: c,
            boxShadow: `inset 0 1px 2px rgba(255,255,255,.25), inset 0 -1px 2px rgba(0,0,0,.3)`,
          }} />
      )}
      {/* specular highlight sits above the stripe so the sphere reads as glossy */}
      <span className="absolute rounded-full pointer-events-none"
        style={{
          width: size * 0.34, height: size * 0.24, left: size * 0.2, top: size * 0.14,
          background: "radial-gradient(ellipse at 50% 40%, rgba(255,255,255,.9), rgba(255,255,255,0) 70%)",
        }} />
      {id > 0 && size >= 15 && (
        <span className="relative rounded-full grid place-items-center font-bold"
          style={{
            width: size * 0.52, height: size * 0.52, background: "#f4f7fb",
            color: "#0d1524", fontSize: size * 0.32, lineHeight: 1,
            boxShadow: "inset 0 -1px 2px rgba(0,0,0,.3), 0 0 0 0.5px rgba(0,0,0,.15)",
          }}>
          {id}
        </span>
      )}
      {id === 0 && (
        <span className="relative rounded-full" style={{ width: size * 0.22, height: size * 0.22, background: "#ff2e88", opacity: .55 }} />
      )}
    </span>
  );
}

/* ---------------------------------------------------------------- buttons */
type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  /** `primary`/`gold` = neon CTA, `secondary`/`wood` = outlined neon,
   *  `success`/`felt` = lime, `ghost` = glass, `danger` = crimson. */
  variant?: "gold" | "wood" | "ghost" | "danger" | "felt" | "primary" | "secondary" | "success";
  size?: "sm" | "md" | "lg";
  icon?: React.ReactNode;
};

export function Btn({ variant = "secondary", size = "md", icon, className, children, ...rest }: BtnProps) {
  const sizes = {
    sm: "px-3 py-1.5 text-[12px] tracking-[0.08em]",
    md: "px-4 py-2.5 text-[14px] tracking-[0.08em]",
    lg: "px-6 py-3.5 text-[17px] tracking-[0.12em]",
  }[size];
  const variants: Record<string, string> = {
    // neon CTA — the single loudest element on any screen
    gold: "neon-cta sweep",
    primary: "neon-cta sweep",
    // outlined neon — the default workhorse
    wood: "neon-line",
    secondary: "neon-line",
    success: "text-lime bg-lime/10 shadow-[0_0_0_1px_rgba(163,255,18,.42)_inset,0_0_20px_rgba(163,255,18,.14)] hover:bg-lime/16",
    felt: "text-lime bg-lime/10 shadow-[0_0_0_1px_rgba(163,255,18,.42)_inset,0_0_20px_rgba(163,255,18,.14)] hover:bg-lime/16",
    ghost: "text-muted bg-white/[0.04] border border-white/10 hover:text-cream hover:bg-white/[0.08] hover:border-white/20",
    danger: "text-[#ffd7de] bg-crimson/14 shadow-[0_0_0_1px_rgba(255,59,92,.5)_inset,0_0_20px_rgba(255,59,92,.16)] hover:bg-crimson/22",
  };
  return (
    <button
      {...rest}
      className={cn(
        "display uppercase font-semibold clip-tag press inline-flex items-center justify-center gap-2 select-none",
        "disabled:opacity-35 disabled:pointer-events-none disabled:saturate-0", sizes, variants[variant], className,
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
        "press grid place-items-center clip-tag border transition-all duration-200",
        active
          ? "border-accent/70 bg-accent/15 text-accent2 shadow-[0_0_18px_rgba(34,211,238,.28)]"
          : "border-white/10 bg-white/[0.04] text-muted hover:text-cream hover:border-white/25 hover:bg-white/[0.08]",
        className,
      )}>
      {children}
    </button>
  );
}

/* ---------------------------------------------------------------- bits */
export function StatBar({ label, value, color = "#22d3ee", icon }: { label: string; value: number; color?: string; icon?: React.ReactNode }) {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-muted mb-1.5">
        <span className="flex items-center gap-1">{icon}{label}</span>
        <span className="tnum text-cream/85">{value}</span>
      </div>
      <div className="relative h-[7px] bg-black/60 overflow-hidden border border-white/[0.07]"
        style={{ clipPath: "polygon(3px 0,100% 0,calc(100% - 3px) 100%,0 100%)" }}>
        <div className="h-full transition-[width] duration-700 ease-out"
          style={{
            width: `${value}%`,
            background: `linear-gradient(90deg, ${color}55, ${color})`,
            boxShadow: `0 0 12px ${color}aa`,
          }} />
      </div>
    </div>
  );
}

export function Toggle({ on, onChange, label, desc, icon, accent = "#22d3ee" }: {
  on: boolean; onChange: (v: boolean) => void; label: string; desc?: string; icon?: React.ReactNode; accent?: string;
}) {
  return (
    <button onClick={() => onChange(!on)}
      className="press w-full flex items-center gap-3 px-3.5 py-3 clip-tag bg-white/[0.035] border border-white/[0.07] hover:bg-white/[0.06] hover:border-white/[0.14] text-left transition-colors">
      {icon && <span className={cn("shrink-0 transition-colors", on ? "text-accent2" : "text-muted")}>{icon}</span>}
      <span className="flex-1 min-w-0">
        <span className="block display text-[17px] leading-tight text-cream uppercase">{label}</span>
        {desc && <span className="block text-[11.5px] text-muted leading-snug mt-0.5">{desc}</span>}
      </span>
      <span className={cn("relative w-11 h-6 shrink-0 border transition-all duration-200",
        on ? "border-transparent" : "border-white/15 bg-black/50")}
        style={{
          clipPath: "polygon(5px 0,100% 0,calc(100% - 5px) 100%,0 100%)",
          background: on ? `linear-gradient(90deg, ${accent}66, ${accent})` : undefined,
          boxShadow: on ? `0 0 16px ${accent}66` : undefined,
        }}>
        <span className={cn("absolute top-0.5 w-5 h-5 bg-cream transition-all duration-200",
          on ? "left-[22px]" : "left-0.5 bg-muted/70")}
          style={{ clipPath: "polygon(4px 0,100% 0,calc(100% - 4px) 100%,0 100%)" }} />
      </span>
    </button>
  );
}

export function CoinPill({ amount, className, animate }: { amount: number; className?: string; animate?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 clip-tag bg-amber/[0.08] border border-amber/30",
      animate && "anim-glow", className)}>
      <Ico.coin className="w-3.5 h-3.5 text-amber" />
      <span className="display text-[16px] leading-none tnum text-amber"
        style={{ textShadow: "0 0 12px rgba(255,176,32,.5)" }}>{amount.toLocaleString()}</span>
    </span>
  );
}

export function LevelRing({ level, pct, size = 46 }: { level: number; pct: number; size?: number }) {
  const r = size / 2 - 3.5;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(120,160,255,.14)" strokeWidth={3.4} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#lvlgrad)" strokeWidth={3.4}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
          style={{ transition: "stroke-dashoffset .8s cubic-bezier(.2,.8,.2,1)", filter: "drop-shadow(0 0 5px rgba(34,211,238,.85))" }} />
        <defs>
          <linearGradient id="lvlgrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#86fbff" /><stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
      </svg>
      <span className="absolute display text-[17px] leading-none text-accent2 tnum">{level}</span>
    </div>
  );
}

export function Modal({ children, onClose, className, wide }: {
  children: React.ReactNode; onClose?: () => void; className?: string; wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-3 bg-black/78 backdrop-blur-[5px]"
      onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className={cn("anim-pop relative w-full clip-panel overflow-hidden glass",
          "shadow-[0_34px_90px_rgba(0,0,0,.85),0_0_60px_rgba(34,211,238,.1)]",
          wide ? "max-w-2xl" : "max-w-sm", className)}>
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent to-transparent" />
        {onClose && (
          <button onClick={onClose} aria-label="Close"
            className="absolute top-2.5 right-2.5 z-10 grid place-items-center w-8 h-8 clip-tag text-muted hover:text-cream hover:bg-white/10 press">
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
      <div className="flex items-center gap-2.5">
        <span className="block w-1 h-6 bg-gradient-to-b from-accent2 to-violet"
          style={{ boxShadow: "0 0 12px rgba(34,211,238,.7)" }} />
        <h2 className="display text-[26px] leading-none uppercase text-cream tracking-[0.04em]">{children}</h2>
      </div>
      {sub && <p className="text-[12px] text-muted mt-1.5 pl-3.5">{sub}</p>}
    </div>
  );
}

/* ------------------------------------------------------- esports extras */

/** Small clipped-corner label, used for tags like "OWNED", "EQUIPPED", "PRO". */
export function Tag({ children, tone = "accent", className }: {
  children: React.ReactNode; tone?: "accent" | "magenta" | "lime" | "amber" | "muted"; className?: string;
}) {
  const tones = {
    accent: "text-accent2 border-accent/45 bg-accent/10",
    magenta: "text-magenta border-magenta/45 bg-magenta/10",
    lime: "text-lime border-lime/45 bg-lime/10",
    amber: "text-amber border-amber/45 bg-amber/10",
    muted: "text-muted border-white/12 bg-white/[0.04]",
  }[tone];
  return (
    <span className={cn("display inline-flex items-center gap-1 px-2 py-[3px] text-[10px] uppercase tracking-[0.18em] border clip-tag",
      tones, className)}>
      {children}
    </span>
  );
}

/** Panel wrapper giving every card the same frosted, edge-lit treatment. */
export function Panel({ children, className, glow = false }: {
  children: React.ReactNode; className?: string; glow?: boolean;
}) {
  return (
    <div className={cn("relative clip-panel glass edge-glow overflow-hidden",
      glow && "shadow-[0_22px_56px_rgba(0,0,0,.6),0_0_44px_rgba(34,211,238,.14)]", className)}>
      {children}
    </div>
  );
}
