"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sunrise, Moon } from "lucide-react";
import { markMorningPlanned, markEveningClosed } from "@/lib/actions/rituals";

export default function RitualBanners({
  morningPlanned,
  eveningClosed,
  openTaskCount,
}: {
  morningPlanned: boolean;
  eveningClosed: boolean;
  openTaskCount: number;
}) {
  // Decide what to show only after mount, using the browser's local time —
  // avoids a server/client render mismatch across time zones.
  const [hour, setHour] = useState<number | null>(null);
  const [dismissedMorning, setDismissedMorning] = useState(false);
  const [dismissedEvening, setDismissedEvening] = useState(false);

  useEffect(() => {
    setHour(new Date().getHours());
  }, []);

  if (hour === null) return null;

  const showMorning = hour < 11 && !morningPlanned && !dismissedMorning;
  const showEvening = hour >= 17 && !eveningClosed && openTaskCount > 0 && !dismissedEvening;

  if (!showMorning && !showEvening) return null;

  return (
    <div className="space-y-3">
      {showMorning && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3">
          <Sunrise size={20} className="shrink-0 text-blue-500" />
          <div className="min-w-0 flex-1 text-sm text-blue-900">
            <span className="font-medium">Good morning! 60-second planning: </span>
            list today&apos;s tasks, arrange by priority, and estimate time for each on your{" "}
            <Link href="/board" className="underline">board</Link>.
          </div>
          <form
            action={async () => {
              await markMorningPlanned();
              setDismissedMorning(true);
            }}
          >
            <button className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
              Planned for today ✓
            </button>
          </form>
        </div>
      )}
      {showEvening && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3">
          <Moon size={20} className="shrink-0 text-violet-500" />
          <div className="min-w-0 flex-1 text-sm text-violet-900">
            <span className="font-medium">Before you leave: </span>
            update all your tasks, tick off what&apos;s done, and give a status for anything
            pending on your <Link href="/board" className="underline">board</Link>.
          </div>
          <form
            action={async () => {
              await markEveningClosed();
              setDismissedEvening(true);
            }}
          >
            <button className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700">
              Updated, I&apos;m done ✓
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
