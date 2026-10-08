import { useMemo } from "react";

/**
 * Stage ambience for the esports look: a cyan key light from above, magenta
 * and violet rim pools, a perspective grid floor and drifting light motes.
 */
export default function Background({ intensity = 1 }: { intensity?: number }) {
  const motes = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => ({
        left: (i * 37 + 11) % 100,
        top: 40 + ((i * 53) % 60),
        delay: (i * 0.9) % 12,
        dur: 11 + ((i * 3) % 13),
        s: 1.5 + ((i * 7) % 3),
        hue: i % 3,
      })),
    [],
  );
  const moteColor = ["rgba(134,251,255,.75)", "rgba(139,92,246,.7)", "rgba(255,46,136,.65)"];

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden hall vignette">
      {/* key light — a hard cyan cone from above centre */}
      <div className="absolute left-1/2 -top-24 -translate-x-1/2 w-[130vw] h-[70vh] pointer-events-none"
        style={{
          background:
            "conic-gradient(from 180deg at 50% 0%, transparent 41%, rgba(34,211,238,0.10) 47%, rgba(134,251,255,0.18) 50%, rgba(34,211,238,0.10) 53%, transparent 59%)",
          filter: "blur(6px)",
          opacity: intensity,
        }} />

      {/* violet rim, left */}
      <div className="absolute left-[10%] -top-16 w-[48vw] h-[54vh] pointer-events-none rounded-full"
        style={{ background: "radial-gradient(closest-side, rgba(139,92,246,.22), transparent)", filter: "blur(24px)" }} />
      {/* magenta rim, right */}
      <div className="absolute right-[6%] top-[6%] w-[44vw] h-[46vh] pointer-events-none rounded-full"
        style={{ background: "radial-gradient(closest-side, rgba(255,46,136,.18), transparent)", filter: "blur(28px)" }} />
      {/* cyan pool, bottom */}
      <div className="absolute right-[12%] bottom-[-12%] w-[54vw] h-[54vh] pointer-events-none rounded-full"
        style={{ background: "radial-gradient(closest-side, rgba(14,122,99,.34), transparent)", filter: "blur(28px)" }} />

      {/* horizon beam */}
      <div className="absolute left-0 right-0 top-[46%] h-px pointer-events-none"
        style={{
          background: "linear-gradient(90deg, transparent, rgba(34,211,238,.5), rgba(139,92,246,.4), transparent)",
          boxShadow: "0 0 26px rgba(34,211,238,.45)",
          opacity: 0.5 * intensity,
        }} />

      {/* drifting light motes */}
      {motes.map((m, i) => (
        <span key={i} className="dust"
          style={{
            left: `${m.left}%`, top: `${m.top}%`, width: m.s, height: m.s,
            background: moteColor[m.hue],
            animationDelay: `${m.delay}s`, animationDuration: `${m.dur}s`, opacity: 0.5 * intensity,
          }} />
      ))}

      {/* floor glow */}
      <div className="absolute -bottom-[26vh] left-1/2 -translate-x-1/2 w-[150vw] h-[46vh] rounded-[50%] pointer-events-none"
        style={{ background: "radial-gradient(closest-side, rgba(9,52,74,.55), transparent)", filter: "blur(32px)" }} />
    </div>
  );
}
