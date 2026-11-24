"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Bell, CheckCheck, Sparkles } from "lucide-react";
import type { Alert } from "@/lib/alerts";

const dot: Record<string, string> = {
  red: "bg-red-500",
  amber: "bg-amber-500",
  blue: "bg-blue-500",
};

export default function NotificationBell({ alerts: initialAlerts }: { alerts: Alert[] }) {
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>(initialAlerts || []);

  // Sync when initialAlerts changes
  useEffect(() => {
    setAlerts(initialAlerts || []);
  }, [initialAlerts]);

  // Listen to live notification updates dispatched from poller
  useEffect(() => {
    function handleUpdate(e: Event) {
      const customEvent = e as CustomEvent<any[]>;
      const liveNotifs = customEvent.detail;
      if (!Array.isArray(liveNotifs)) return;

      setAlerts((prev) => {
        // Keep non-notif alerts (system/score alerts)
        const systemAlerts = prev.filter((a) => !a.id.startsWith("notif-"));
        
        // Transform live notifications into alerts
        const notifAlerts: Alert[] = liveNotifs.map((nd) => {
          const tone =
            nd.type === "REVIEW_APPROVED"
              ? "blue"
              : nd.type === "REVIEW_REJECTED"
              ? "red"
              : nd.type === "TASK_ASSIGNED"
              ? "blue"
              : "amber";
          return {
            id: `notif-${nd.id}`,
            tone,
            href: nd.href || `/task/${nd.taskId}`,
            text: `${nd.title}: ${nd.message || nd.taskTitle}`,
          };
        });

        return [...systemAlerts, ...notifAlerts];
      });
    }

    window.addEventListener("taskflow:notifications-updated", handleUpdate);
    return () => window.removeEventListener("taskflow:notifications-updated", handleUpdate);
  }, []);

  const count = alerts.length;
  const hasTaskNotifs = alerts.some((a) => a.id.startsWith("notif-"));

  async function handleAlertClick(alertItem: Alert) {
    setOpen(false);
    if (alertItem.id.startsWith("notif-")) {
      const notifId = alertItem.id.replace("notif-", "");
      // Optimistically remove from state
      setAlerts((prev) => prev.filter((a) => a.id !== alertItem.id));
      try {
        await fetch("/api/notifications/new", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: notifId, action: "read" }),
        });
      } catch {
        // ignore
      }
    }
  }

  async function handleMarkAllRead() {
    // Optimistically remove all notification alerts
    setAlerts((prev) => prev.filter((a) => !a.id.startsWith("notif-")));
    try {
      await fetch("/api/notifications/new", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "read_all" }),
      });
    } catch {
      // ignore
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 transition-colors"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-xs animate-in zoom-in-50 duration-200">
            {count}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-84 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 px-2 py-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Notifications &amp; Alerts
              </span>
              {hasTaskNotifs && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
                >
                  <CheckCheck size={13} />
                  Mark all read
                </button>
              )}
            </div>

            {count === 0 ? (
              <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-slate-50 text-slate-400 mb-2">
                  <Sparkles size={18} />
                </div>
                <div className="text-xs font-semibold text-slate-700">All caught up!</div>
                <p className="text-[11px] text-slate-400 mt-0.5">No new notifications or alerts right now.</p>
              </div>
            ) : (
              <ul className="mt-1 max-h-80 overflow-y-auto divide-y divide-slate-50 space-y-0.5">
                {alerts.map((a) => (
                  <li key={a.id}>
                    <Link
                      href={a.href}
                      onClick={() => handleAlertClick(a)}
                      className="flex items-start gap-2.5 rounded-xl px-2.5 py-2.5 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dot[a.tone] || "bg-blue-500"}`} />
                      <span className="leading-snug line-clamp-2">{a.text}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
