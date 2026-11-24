"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Bell, Trash2, X, Sparkles } from "lucide-react";
import type { Alert } from "@/lib/alerts";

const dot: Record<string, string> = {
  red: "bg-red-500",
  amber: "bg-amber-500",
  blue: "bg-blue-500",
};

export default function NotificationBell({ alerts: initialAlerts }: { alerts: Alert[] }) {
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>(initialAlerts || []);
  const [dismissedSystemIds, setDismissedSystemIds] = useState<Set<string>>(new Set());

  // Sync when initialAlerts changes
  useEffect(() => {
    setAlerts((initialAlerts || []).filter((a) => !dismissedSystemIds.has(a.id)));
  }, [initialAlerts, dismissedSystemIds]);

  // Listen to live notification updates dispatched from poller
  useEffect(() => {
    function handleUpdate(e: Event) {
      const customEvent = e as CustomEvent<any[]>;
      const liveNotifs = customEvent.detail;
      if (!Array.isArray(liveNotifs)) return;

      setAlerts((prev) => {
        // Keep non-notif alerts (system/score alerts) that haven't been dismissed
        const systemAlerts = prev.filter((a) => !a.id.startsWith("notif-") && !dismissedSystemIds.has(a.id));
        
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
  }, [dismissedSystemIds]);

  const count = alerts.length;

  async function handleAlertClick(alertItem: Alert) {
    setOpen(false);
    if (alertItem.id.startsWith("notif-")) {
      const notifId = alertItem.id.replace("notif-", "");
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
    } else {
      setDismissedSystemIds((prev) => new Set([...prev, alertItem.id]));
      setAlerts((prev) => prev.filter((a) => a.id !== alertItem.id));
    }
  }

  async function handleRemoveOne(e: React.MouseEvent, alertItem: Alert) {
    e.preventDefault();
    e.stopPropagation();

    // Optimistically remove from state
    setAlerts((prev) => prev.filter((a) => a.id !== alertItem.id));

    if (alertItem.id.startsWith("notif-")) {
      const notifId = alertItem.id.replace("notif-", "");
      try {
        await fetch("/api/notifications/new", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: notifId, action: "dismiss" }),
        });
      } catch {
        // ignore
      }
    } else {
      setDismissedSystemIds((prev) => new Set([...prev, alertItem.id]));
    }
  }

  async function handleClearAll(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    // Mark dismissed for system alerts
    const allSysIds = alerts.filter((a) => !a.id.startsWith("notif-")).map((a) => a.id);
    if (allSysIds.length) {
      setDismissedSystemIds((prev) => new Set([...prev, ...allSysIds]));
    }

    // Clear all alerts in UI immediately
    setAlerts([]);

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
                Notifications {count > 0 && `(${count})`}
              </span>
              {count > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                  title="Clear all notifications"
                >
                  <Trash2 size={12} />
                  Clear all
                </button>
              )}
            </div>

            {count === 0 ? (
              <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-slate-50 text-slate-400 mb-2">
                  <Sparkles size={18} />
                </div>
                <div className="text-xs font-semibold text-slate-700">All caught up!</div>
                <p className="text-[11px] text-slate-400 mt-0.5">No notifications right now.</p>
              </div>
            ) : (
              <ul className="mt-1 max-h-80 overflow-y-auto divide-y divide-slate-50 space-y-0.5">
                {alerts.map((a) => (
                  <li
                    key={a.id}
                    className="group relative flex items-center justify-between rounded-xl hover:bg-slate-50 transition-colors"
                  >
                    <Link
                      href={a.href}
                      onClick={() => handleAlertClick(a)}
                      className="flex flex-1 items-start gap-2.5 p-2.5 text-xs text-slate-700 pr-8"
                    >
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dot[a.tone] || "bg-blue-500"}`} />
                      <span className="leading-snug line-clamp-2">{a.text}</span>
                    </Link>

                    <button
                      type="button"
                      onClick={(e) => handleRemoveOne(e, a)}
                      title="Clear notification"
                      className="absolute right-2 top-2.5 rounded-md p-1 text-slate-400 opacity-60 hover:opacity-100 hover:bg-slate-200/60 hover:text-rose-600 transition-all cursor-pointer"
                      aria-label="Remove notification"
                    >
                      <X size={14} />
                    </button>
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
