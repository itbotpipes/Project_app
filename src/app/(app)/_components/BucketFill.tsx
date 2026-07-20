"use client";

import { cn } from "@/lib/cn";

export type BucketDatum = { id: string; name: string; count: number };

/** Fill % relative to whichever bucket has the most activity this period — makes
 * "which KPI am I actually working on" visually obvious even without hard numeric targets. */
function fillPercents(buckets: BucketDatum[]): (BucketDatum & { pct: number })[] {
  const max = Math.max(1, ...buckets.map((b) => b.count));
  return buckets.map((b) => ({ ...b, pct: Math.round((b.count / max) * 100) }));
}

/**
 * Fire & safety themed KPI buckets: each KPI is a red GI pipe (transparent window)
 * with blue water inside. The water level = how much work is flowing through that
 * KPI this period. Water waves, bobs and bubbles so it feels alive / real-time.
 */
export default function BucketFill({
  buckets,
  highlightId,
  size = "md",
}: {
  buckets: BucketDatum[];
  highlightId?: string;
  size?: "sm" | "md";
}) {
  if (!buckets.length) {
    return <p className="text-sm text-slate-400">No KPI buckets configured for this role yet.</p>;
  }
  const data = fillPercents(buckets);
  const pipe = size === "sm" ? "h-24 w-11" : "h-36 w-14";
  const colW = size === "sm" ? "w-16" : "w-20";

  return (
    <div className="flex flex-wrap gap-4">
      {data.map((b) => {
        const level = b.count > 0 ? Math.max(10, b.pct) : 0;
        const active = b.id === highlightId;
        return (
          <div key={b.id} className={cn("flex flex-col items-center gap-1.5", colW)}>
            <div className="relative" style={{ height: size === "sm" ? 100 : 152, width: size === "sm" ? 44 : 56 }}>
              {/* top coupling / flange */}
              <div className="absolute -top-1 left-1/2 z-20 h-2.5 -translate-x-1/2 rounded-[3px] bg-gradient-to-b from-red-500 to-red-700 shadow-sm"
                   style={{ width: (size === "sm" ? 44 : 56) + 6 }} />
              {/* bottom coupling / flange */}
              <div className="absolute -bottom-1 left-1/2 z-20 h-2.5 -translate-x-1/2 rounded-[3px] bg-gradient-to-b from-red-600 to-red-800 shadow-sm"
                   style={{ width: (size === "sm" ? 44 : 56) + 6 }} />

              {/* the pipe body: red rim, transparent glassy window */}
              <div
                className={cn(
                  "absolute inset-0 z-10 overflow-hidden rounded-[10px] border-[3px] bg-gradient-to-r from-white/70 via-slate-50/40 to-white/70 shadow-inner",
                  pipe,
                  active
                    ? "border-red-600 ring-2 ring-amber-400 ring-offset-1"
                    : "border-red-600 ring-1 ring-red-800/30",
                )}
                style={{ height: size === "sm" ? 100 : 152, width: size === "sm" ? 44 : 56 }}
                title={`${b.name}: ${b.count} task${b.count === 1 ? "" : "s"}`}
              >
                {/* water column */}
                <div
                  className={cn("absolute inset-x-0 bottom-0", b.count > 0 && "animate-waterBob")}
                  style={{ height: `${level}%`, transition: "height 700ms cubic-bezier(0.22,1,0.36,1)" }}
                >
                  {/* body of the water */}
                  <div
                    className={cn(
                      "absolute inset-0",
                      b.count === 0
                        ? "bg-slate-100"
                        : "bg-gradient-to-t from-sky-600 via-sky-500 to-cyan-400",
                    )}
                  />
                  {b.count > 0 && (
                    <>
                      {/* moving surface sheen / wave */}
                      <div className="absolute -top-1 left-0 h-2 w-[200%] animate-waterWave bg-gradient-to-r from-cyan-200/0 via-cyan-100/80 to-cyan-200/0" />
                      <div className="absolute top-0 inset-x-0 h-[3px] bg-cyan-200/80" />
                      {/* rising bubbles */}
                      <span className="animate-bubble absolute bottom-1 left-[25%] h-1.5 w-1.5 rounded-full bg-white/70" style={{ animationDelay: "0s" }} />
                      <span className="animate-bubble absolute bottom-2 left-[55%] h-1 w-1 rounded-full bg-white/60" style={{ animationDelay: "0.9s" }} />
                      <span className="animate-bubble absolute bottom-1 left-[70%] h-1.5 w-1.5 rounded-full bg-white/60" style={{ animationDelay: "1.6s" }} />
                    </>
                  )}
                </div>

                {/* glossy vertical highlight on the pipe */}
                <div className="animate-pipeSheen pointer-events-none absolute inset-y-2 left-1.5 w-1.5 rounded-full bg-white/60" />
                {/* faint right shadow for the cylinder look */}
                <div className="pointer-events-none absolute inset-y-0 right-0 w-2 bg-gradient-to-l from-red-900/10 to-transparent" />

                {/* the count */}
                <div className="absolute inset-0 grid place-items-center">
                  <span className={cn("text-sm font-bold tabular-nums drop-shadow", level > 45 ? "text-white" : "text-slate-600")}>
                    {b.count}
                  </span>
                </div>
              </div>
            </div>
            <span className="line-clamp-2 text-center text-[11px] leading-tight text-slate-600" title={b.name}>
              {b.name}
            </span>
          </div>
        );
      })}
    </div>
  );
}
