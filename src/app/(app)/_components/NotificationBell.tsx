"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import type { Alert } from "@/lib/alerts";

const dot: Record<string, string> = {
  red: "bg-red-500",
  amber: "bg-amber-500",
  blue: "bg-blue-500",
};

export default function NotificationBell({ alerts }: { alerts: Alert[] }) {
  const [open, setOpen] = useState(false);
  const count = alerts.length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {count}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
            <div className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Alerts
            </div>
            {count === 0 ? (
              <div className="px-2 py-4 text-center text-sm text-slate-400">All clear ✨</div>
            ) : (
              <ul className="space-y-1">
                {alerts.map((a) => (
                  <li key={a.id}>
                    <Link
                      href={a.href}
                      onClick={() => setOpen(false)}
                      className="flex items-start gap-2 rounded-lg px-2 py-2 text-sm hover:bg-slate-50"
                    >
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dot[a.tone]}`} />
                      <span className="text-slate-700">{a.text}</span>
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
