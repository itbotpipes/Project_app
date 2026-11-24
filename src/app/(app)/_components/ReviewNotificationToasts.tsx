"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, AlertTriangle, Sparkles, MessageSquare, ClipboardCheck, UserPlus, X } from "lucide-react";
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

const POLL_INTERVAL_MS = 6_000;

function playNotificationChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587.33, now); // D5
    gain1.gain.setValueAtTime(0.1, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.22);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(880, now + 0.09); // A5
    gain2.gain.setValueAtTime(0.12, now + 0.09);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.09);
    osc2.stop(now + 0.35);
  } catch {
    // Audio autoplay or web audio restriction quietly ignored
  }
}

export default function ReviewNotificationToasts() {
  const [toasts, setToasts] = useState<TaskToast[]>([]);
  const seenRef = useRef<Set<string>>(new Set());
  const initialLoadRef = useRef(true);

  // Auto-dismiss the oldest toast after 7 seconds
  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setTimeout(() => {
      setToasts((prev) => prev.slice(1));
    }, 7000);
    return () => clearTimeout(timer);
  }, [toasts]);

  useEffect(() => {
    let cancelled = false;

    async function checkNotifications() {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;

      try {
        const res = await fetch("/api/notifications/new", { cache: "no-store" });
        if (!res.ok) return;
        const data: { notifications: TaskToast[] } = await res.json();
        if (cancelled) return;

        const notifs = data?.notifications || [];

        // Broadcast to NotificationBell so it updates count in real time
        window.dispatchEvent(new CustomEvent("taskflow:notifications-updated", { detail: notifs }));

        if (!notifs.length) return;

        // On first run, remember existing notifications to avoid flooding popups on page refresh,
        // but still pop up any newly unnotified recent notification
        if (initialLoadRef.current) {
          initialLoadRef.current = false;
          const freshUnnotified: TaskToast[] = [];
          for (const item of notifs) {
            seenRef.current.add(item.id);
            // Only popup unnotified items from the last 5 minutes
            const ageMs = Date.now() - new Date(item.createdAt).getTime();
            if (!item.notified && ageMs < 5 * 60 * 1000) {
              freshUnnotified.push(item);
              fetch("/api/notifications/new", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: item.id, action: "notified" }),
              }).catch(() => {});
            }
          }

          if (freshUnnotified.length > 0) {
            playNotificationChime();
            setToasts(freshUnnotified.slice(-3));
          }
          return;
        }

        const newItems: TaskToast[] = [];

        for (const item of notifs) {
          if (!seenRef.current.has(item.id)) {
            seenRef.current.add(item.id);
            newItems.push(item);

            // Mark as notified on the server so other tabs don't re-toast
            fetch("/api/notifications/new", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: item.id, action: "notified" }),
            }).catch(() => {});

            // Browser desktop notification if permitted
            if (typeof Notification !== "undefined" && Notification.permission === "granted") {
              try {
                new Notification(item.title, {
                  body: `${item.actorName}: ${item.message || item.taskTitle}`,
                  tag: item.id,
                });
              } catch {
                // Ignore browser notification failure
              }
            }
          }
        }

        if (newItems.length > 0) {
          playNotificationChime();
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

  async function handleOpenTask(item: TaskToast) {
    setToasts((prev) => prev.filter((t) => t.id !== item.id));
    try {
      await fetch("/api/notifications/new", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, action: "read" }),
      });
    } catch {
      // ignore
    }
  }

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-16 right-4 z-[99] flex w-88 max-w-[calc(100vw-2rem)] flex-col gap-2.5 pointer-events-none">
      {toasts.map((t) => {
        const isApproved = t.type === "REVIEW_APPROVED";
        const isRejected = t.type === "REVIEW_REJECTED";
        const isFeedback = t.type === "REVIEW_FEEDBACK" || t.type === "REVIEW_SCORED";
        const isComment = t.type === "TASK_COMMENT";
        const isAssigned = t.type === "TASK_ASSIGNED";

        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 rounded-2xl border p-3.5 shadow-2xl backdrop-blur-md transition-all animate-in fade-in slide-in-from-top-3 duration-300 ${
              isApproved
                ? "border-emerald-200 bg-emerald-50/95 text-emerald-950"
                : isRejected
                ? "border-rose-200 bg-rose-50/95 text-rose-950"
                : isFeedback
                ? "border-purple-200 bg-purple-50/95 text-purple-950"
                : isComment
                ? "border-blue-200 bg-blue-50/95 text-blue-950"
                : isAssigned
                ? "border-indigo-200 bg-indigo-50/95 text-indigo-950"
                : "border-amber-200 bg-amber-50/95 text-amber-950"
            }`}
          >
            <div className="mt-0.5 shrink-0">
              {isApproved && <CheckCircle2 size={19} className="text-emerald-600" />}
              {isRejected && <AlertTriangle size={19} className="text-rose-600" />}
              {isFeedback && <Sparkles size={19} className="text-purple-600" />}
              {isComment && <MessageSquare size={19} className="text-blue-600" />}
              {isAssigned && <UserPlus size={19} className="text-indigo-600" />}
              {!isApproved && !isRejected && !isFeedback && !isComment && !isAssigned && (
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
                  onClickCapture={() => handleOpenTask(t)}
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
