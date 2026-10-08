import { useMemo } from "react";

/** Layered billiard-hall ambience: light pools, drifting dust, faint felt weave. */
export default function Background({ intensity = 1 }: { intensity?: number }) {
  const motes = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => ({
        left: (i * 37 + 11) % 100,
        top: 40 + ((i * 53) % 60),
        delay: (i * 0.9) % 12,
        dur: 11 + ((i * 3) % 13),
        s: 1.5 + ((i * 7) % 3),
      })),
    [],
  );
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden hall vignette">
      {/* hanging lamp cones */}
      <div className="absolute left-1/2 -top-24 -translate-x-1/2 w-[130vw] h-[70vh] pointer-events-none"
        style={{
          background:
            "conic-gradient(from 180deg at 50% 0%, transparent 41%, rgba(255,214,140,0.10) 47%, rgba(255,226,170,0.16) 50%, rgba(255,214,140,0.10) 53%, transparent 59%)",
          filter: "blur(6px)",
          opacity: intensity,
        }} />
      <div className="absolute left-[14%] -top-16 w-[46vw] h-[52vh] pointer-events-none rounded-full"
        style={{ background: "radial-gradient(closest-side, rgba(217,164,65,.16), transparent)", filter: "blur(20px)" }} />
      <div className="absolute right-[8%] bottom-[-10%] w-[52vw] h-[52vh] pointer-events-none rounded-full"
        style={{ background: "radial-gradient(closest-side, rgba(20,107,72,.28), transparent)", filter: "blur(26px)" }} />

      {/* drifting chalk dust */}
      {motes.map((m, i) => (
        <span key={i} className="dust"
          style={{
            left: `${m.left}%`, top: `${m.top}%`, width: m.s, height: m.s,
            animationDelay: `${m.delay}s`, animationDuration: `${m.dur}s`, opacity: 0.5 * intensity,
          }} />
      ))}

      {/* faint table silhouette */}
      <div className="absolute -bottom-[26vh] left-1/2 -translate-x-1/2 w-[150vw] h-[46vh] rounded-[50%] pointer-events-none"
        style={{ background: "radial-gradient(closest-side, rgba(12,60,40,.5), transparent)", filter: "blur(30px)" }} />
    </div>
  );
}
