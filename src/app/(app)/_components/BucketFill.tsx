import { cn } from "@/lib/cn";

export type BucketDatum = { id: string; name: string; count: number };

/** Fill % relative to whichever bucket has the most activity this period — makes
 * "which KPI am I actually working on" visually obvious even without hard numeric targets. */
function fillPercents(buckets: BucketDatum[]): (BucketDatum & { pct: number })[] {
  const max = Math.max(1, ...buckets.map((b) => b.count));
  return buckets.map((b) => ({ ...b, pct: Math.round((b.count / max) * 100) }));
}

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
  const dims = size === "sm" ? "h-16 w-10" : "h-24 w-14";

  return (
    <div className="flex flex-wrap gap-4">
      {data.map((b) => (
        <div key={b.id} className={cn("flex flex-col items-center gap-1.5", size === "sm" ? "w-16" : "w-20")}>
          <div
            className={cn(
              "relative overflow-hidden rounded-b-xl rounded-t-md border-2 bg-slate-50 transition-shadow",
              dims,
              b.id === highlightId ? "border-blue-500 ring-2 ring-blue-200" : "border-slate-300",
            )}
          >
            {/* the "water" */}
            <div
              className={cn(
                "absolute bottom-0 left-0 right-0 transition-all duration-700 ease-out",
                b.count === 0 ? "bg-slate-100" : "bg-gradient-to-t from-blue-500 to-sky-400",
              )}
              style={{ height: `${Math.max(b.count > 0 ? 8 : 0, b.pct)}%` }}
            >
              {b.count > 0 && (
                <div className="absolute inset-x-0 top-0 h-1.5 bg-sky-300/70" />
              )}
            </div>
            <div className="absolute inset-0 grid place-items-center">
              <span
                className={cn(
                  "text-sm font-bold drop-shadow",
                  b.pct > 45 ? "text-white" : "text-slate-500",
                )}
              >
                {b.count}
              </span>
            </div>
          </div>
          <span className="line-clamp-2 text-center text-[11px] leading-tight text-slate-600" title={b.name}>
            {b.name}
          </span>
        </div>
      ))}
    </div>
  );
}
