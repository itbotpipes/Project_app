"use client";

import { useEffect, useRef, useState } from "react";
import { BellRing, X } from "lucide-react";
import { dismissReminder } from "@/lib/actions/attachments";
import TaskLink from "./TaskLink";

type Due = { id: string; taskId: string; title: string; remindAt: string };

const POLL_MS = 45_000;

export default function ReminderPoller() {
  const [toasts, setToasts] = useState<Due[]>([]);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | "unsupported">("default");
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (typeof Notification !== "undefined") setNotifPermission(Notification.permission);
    else setNotifPermission("unsupported");
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch("/api/reminders/due", { cache: "no-store" });
        if (!res.ok) return;
        const data: { reminders: Due[] } = await res.json();
        if (cancelled) return;

        const fresh = data.reminders.filter((r) => !seenRef.current.has(r.id));
        for (const r of fresh) {
          seenRef.current.add(r.id);
          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            new Notification("⏰ Task reminder", { body: r.title, tag: r.id });
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

  async function dismiss(r: Due) {
    setToasts((prev) => prev.filter((t) => t.id !== r.id));
    const fd = new FormData();
    fd.set("id", r.id);
    fd.set("taskId", r.taskId);
    await dismissReminder(fd);
  }

  function enableNotifications() {
    if (typeof Notification === "undefined") return;
    Notification.requestPermission().then(setNotifPermission);
  }

  return (
    <>
      {notifPermission === "default" && (
        <button
          onClick={enableNotifications}
          className="fixed bottom-4 left-4 z-40 hidden items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-500 shadow-sm hover:bg-slate-50 md:flex"
        >
          <BellRing size={13} /> Enable reminder pop-ups
        </button>
      )}
      <div className="fixed bottom-4 right-4 z-[90] flex w-80 flex-col gap-2">
        {toasts.map((r) => (
          <div
            key={r.id}
            className="animate-pop flex items-start gap-2 rounded-xl border border-blue-200 bg-white p-3 shadow-lg"
          >
            <BellRing size={18} className="mt-0.5 shrink-0 text-blue-500" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-slate-900">Task reminder</div>
              <TaskLink
                taskId={r.taskId}
                onClickCapture={() => dismiss(r)}
                className="text-sm text-blue-600 hover:underline"
              >
                {r.title}
              </TaskLink>
            </div>
            <button onClick={() => dismiss(r)} className="shrink-0 text-slate-400 hover:text-slate-700" aria-label="Dismiss">
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
