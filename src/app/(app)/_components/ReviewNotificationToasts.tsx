"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, AlertTriangle, Sparkles, MessageSquare, ClipboardCheck, X } from "lucide-react";
import TaskLink from "./TaskLink";

export type TaskToast = {
  id: string;
  taskId: string;
  taskTitle: string;
  type: string;
  title: string;
  message: string;
  actorName: string;
  href: string;
  notified: boolean;
  createdAt: string;
};

const POLL_INTERVAL_MS = 15_000;

export default function ReviewNotificationToasts() {
  const [toasts, setToasts] = useState<TaskToast[]>([]);
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    async function checkNotifications() {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;

      try {
        const res = await fetch("/api/notifications/new", { cache: "no-store" });
        if (!res.ok) return;
        const data: { notifications: TaskToast[] } = await res.json();
        if (cancelled || !data?.notifications?.length) return;

        const newItems: TaskToast[] = [];

        for (const item of data.notifications) {
          if (!seenRef.current.has(item.id)) {
            seenRef.current.add(item.id);
            newItems.push(item);

            // Mark as notified on the server so other tabs or refreshes don't re-toast
            fetch("/api/notifications/new", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: item.id, action: "notified" }),
            }).catch(() => {});

            // Browser desktop notification
            if (typeof Notification !== "undefined" && Notification.permission === "granted") {
              try {
                new Notification(item.title, {
                  body: `${item.actorName}: ${item.message || item.taskTitle}`,
                  tag: item.id,
                });
              } catch (e) {
                // Ignore browser notification failure
              }
            }
          }
        }

        if (newItems.length > 0) {
          setToasts((prev) => [...prev, ...newItems].slice(-4));
        }
      } catch {
        // network or server glitch — quietly retry next tick
      }
    }

    checkNotifications();
    const intervalId = setInterval(checkNotifications, POLL_INTERVAL_MS);

    const onVisChange = () => {
      if (document.visibilityState === "visible") checkNotifications();
    };
    document.addEventListener("visibilitychange", onVisChange);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisChange);
    };
  }, []);

  async function dismiss(item: TaskToast) {
    setToasts((prev) => prev.filter((t) => t.id !== item.id));
    try {
      await fetch("/api/notifications/new", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, action: "dismiss" }),
      });
    } catch {
      // ignore
    }
  }

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-20 right-4 z-[95] flex w-88 max-w-[calc(100vw-2rem)] flex-col gap-2.5">
      {toasts.map((t) => {
        const isApproved = t.type === "REVIEW_APPROVED";
        const isRejected = t.type === "REVIEW_REJECTED";
        const isFeedback = t.type === "REVIEW_FEEDBACK" || t.type === "REVIEW_SCORED";
        const isComment = t.type === "TASK_COMMENT";

        return (
          <div
            key={t.id}
            className={`flex items-start gap-3 rounded-2xl border p-3.5 shadow-xl transition-all ${
              isApproved
                ? "border-emerald-200 bg-emerald-50/95 text-emerald-950"
                : isRejected
                ? "border-rose-200 bg-rose-50/95 text-rose-950"
                : isFeedback
                ? "border-purple-200 bg-purple-50/95 text-purple-950"
                : isComment
                ? "border-blue-200 bg-blue-50/95 text-blue-950"
                : "border-amber-200 bg-amber-50/95 text-amber-950"
            }`}
          >
            <div className="mt-0.5 shrink-0">
              {isApproved && <CheckCircle2 size={19} className="text-emerald-600" />}
              {isRejected && <AlertTriangle size={19} className="text-rose-600" />}
              {isFeedback && <Sparkles size={19} className="text-purple-600" />}
              {isComment && <MessageSquare size={19} className="text-blue-600" />}
              {!isApproved && !isRejected && !isFeedback && !isComment && (
                <ClipboardCheck size={19} className="text-amber-600" />
              )}
            </div>

            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-bold uppercase tracking-wider opacity-85">
                  {t.title}
                </span>
                <span className="text-[10px] text-slate-500 font-medium">Just now</span>
              </div>

              <div className="text-xs font-semibold text-slate-900">
                <TaskLink
                  taskId={t.taskId}
                  onClickCapture={() => dismiss(t)}
                  className="hover:underline line-clamp-1"
                >
                  {t.taskTitle}
                </TaskLink>
              </div>

              {t.message && (
                <p className="text-xs text-slate-700 line-clamp-2 leading-relaxed">
                  {t.message}
                </p>
              )}
            </div>

            <button
              onClick={() => dismiss(t)}
              className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-black/5 hover:text-slate-700 transition-colors"
              aria-label="Dismiss notification"
            >
              <X size={15} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
