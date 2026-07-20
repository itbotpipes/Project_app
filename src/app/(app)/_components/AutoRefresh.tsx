"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Silently re-fetches the current server component tree on an interval so things
 * like the KPI fire-pipes / bucket levels feel real-time without a manual reload.
 * Pauses while the tab is hidden to avoid needless churn.
 */
export default function AutoRefresh({
  seconds = 20,
  showPulse = true,
}: {
  seconds?: number;
  showPulse?: boolean;
}) {
  const router = useRouter();
  const [live, setLive] = useState(true);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const id = setInterval(tick, Math.max(5, seconds) * 1000);
    const onVis = () => {
      setLive(document.visibilityState === "visible");
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [router, seconds]);

  if (!showPulse) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
      <span className={live ? "h-2 w-2 rounded-full bg-emerald-500 animate-ping" : "h-2 w-2 rounded-full bg-slate-300"} />
      <span className="relative">Live</span>
    </span>
  );
}
