"use client";

import { useState, useTransition } from "react";
import { toggleWatch } from "@/lib/actions/tasks";

export default function WatchButton({ taskId, initiallyWatching }: { taskId: string; initiallyWatching: boolean }) {
  const [watching, setWatching] = useState(initiallyWatching);
  const [, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() => {
        setWatching((w) => !w);
        const fd = new FormData();
        fd.set("taskId", taskId);
        startTransition(async () => {
          await toggleWatch(fd);
        });
      }}
      className={
        watching
          ? "rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700"
          : "rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
      }
    >
      {watching ? "🔔 In loop" : "🔕 Join loop"}
    </button>
  );
}
