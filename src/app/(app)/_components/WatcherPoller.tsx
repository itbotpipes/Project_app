"use client";

import { useEffect, useRef, useState } from "react";
import { Users, X } from "lucide-react";
import { dismissWatcherNotification } from "@/lib/actions/tasks";
import TaskLink from "./TaskLink";

type NewWatch = { id: string; taskId: string; title: string };

const POLL_MS = 45_000;

export default function WatcherPoller() {
  const [toasts, setToasts] = useState<NewWatch[]>([]);
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch("/api/watchers/new", { cache: "no-store" });
        if (!res.ok) return;
        const data: { watchers: NewWatch[] } = await res.json();
        if (cancelled) return;

        const fresh = data.watchers.filter((w) => !seenRef.current.has(w.id));
        for (const w of fresh) {
          seenRef.current.add(w.id);
          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            new Notification("👥 You're in the loop", { body: w.title, tag: w.id });
          }
        }
        if (fresh.length) setToasts((prev) => [...prev, ...fresh].slice(-4));
      } catch {
        // offline or server hiccup — silently retry next tick
      }
    }

    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  async function dismiss(w: NewWatch) {
    setToasts((prev) => prev.filter((t) => t.id !== w.id));
    const fd = new FormData();
    fd.set("id", w.id);
    await dismissWatcherNotification(fd);
  }

  return (
    <div className="fixed bottom-4 right-4 z-[90] flex w-80 flex-col gap-2">
      {toasts.map((w) => (
        <div
          key={w.id}
          className="animate-pop flex items-start gap-2 rounded-xl border border-emerald-200 bg-white p-3 shadow-lg"
        >
          <Users size={18} className="mt-0.5 shrink-0 text-emerald-500" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-slate-900">You&apos;re in the loop</div>
            <TaskLink
              taskId={w.taskId}
              onClickCapture={() => dismiss(w)}
              className="text-sm text-blue-600 hover:underline"
            >
              {w.title}
            </TaskLink>
          </div>
          <button onClick={() => dismiss(w)} className="shrink-0 text-slate-400 hover:text-slate-700" aria-label="Dismiss">
            <X size={15} />
          </button>
        </div>
      ))}
    </div>
  );
}
