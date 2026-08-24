"use client";

import { useEffect, useState } from "react";
import { useTaskDrawer } from "./TaskDrawerContext";
import TaskDrawer from "./TaskDrawer";
import TaskFields from "@/app/(app)/task/[id]/TaskFields";
import type { TaskDetailData } from "@/lib/taskDetail";

export default function TaskDrawerHost() {
  const ctx = useTaskDrawer();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openTaskId = ctx?.openTaskId ?? null;
  const setTaskData = ctx?.setTaskData;

  useEffect(() => {
    if (!openTaskId || !setTaskData) {
      setTaskData?.(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setTaskData(null);

    fetch(`/api/tasks/${openTaskId}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Couldn't load this task (${res.status}).`);
        }
        return res.json();
      })
      .then((json) => {
        if (!cancelled) setTaskData(json);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message || "Something went wrong loading this task.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [openTaskId, ctx?.refreshTrigger, setTaskData]);

  if (!ctx || !openTaskId) return null;

  return (
    <TaskDrawer onClose={ctx.close}>
      {loading && (
        <div className="grid h-40 place-items-center text-sm text-slate-400">Loading task…</div>
      )}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}
      {ctx.taskData && <TaskFields data={ctx.taskData} />}
    </TaskDrawer>
  );
}
