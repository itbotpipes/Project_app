"use client";

import { useEffect, useState } from "react";
import { Play, Pause, CheckCircle2, Clock } from "lucide-react";
import { TASK_STATUS_LABEL } from "@/lib/constants";

interface TaskTimerProps {
  status: string;
  lastStatusChange: string | null;
  statusDurations: Record<string, number>;
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return "0s";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  const parts = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (s > 0 || parts.length === 0) parts.push(`${s}s`);
  return parts.join(" ");
}

export default function TaskTimer({
  status,
  lastStatusChange,
  statusDurations,
}: TaskTimerProps) {
  const [liveDuration, setLiveDuration] = useState(0);

  useEffect(() => {
    if (status !== "IN_PROGRESS" || !lastStatusChange) {
      setLiveDuration(0);
      return;
    }

    const changeTime = new Date(lastStatusChange).getTime();

    function update() {
      const elapsed = Math.floor((Date.now() - changeTime) / 1000);
      setLiveDuration(Math.max(0, elapsed));
    }

    update();
    const interval = setInterval(update, 1000);

    return () => clearInterval(interval);
  }, [status, lastStatusChange]);

  // Combine live time with historical duration
  const activeDurations = { ...statusDurations };
  if (status === "IN_PROGRESS") {
    activeDurations["IN_PROGRESS"] = (activeDurations["IN_PROGRESS"] || 0) + liveDuration;
  }

  const totalTime = Object.values(activeDurations).reduce((acc, curr) => acc + curr, 0);

  // Status styling configurations
  const STATUS_THEME: Record<string, { bg: string; text: string; bar: string }> = {
    NEW: { bg: "bg-slate-50", text: "text-slate-600", bar: "bg-slate-400" },
    ACCEPTED: { bg: "bg-sky-50", text: "text-sky-700", bar: "bg-sky-400" },
    IN_PROGRESS: { bg: "bg-blue-50/50 border border-blue-100", text: "text-blue-700", bar: "bg-blue-500" },
    ON_HOLD: { bg: "bg-amber-50", text: "text-amber-700", bar: "bg-amber-500" },
    PENDING_REVIEW: { bg: "bg-violet-50", text: "text-violet-700", bar: "bg-violet-500" },
    CLOSED: { bg: "bg-emerald-50", text: "text-emerald-700", bar: "bg-emerald-500" },
    REOPENED: { bg: "bg-red-50", text: "text-red-700", bar: "bg-red-500" },
  };

  return (
    <div className="space-y-4 rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-slate-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Time Logged</span>
        </div>
        {status === "IN_PROGRESS" && (
          <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 animate-pulse">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Live Tracker Active
          </span>
        )}
      </div>

      {/* Main active timer widget */}
      <div className="flex items-center gap-4 rounded-lg bg-slate-50 p-3.5">
        <div className={`grid h-12 w-12 place-items-center rounded-full ${status === "IN_PROGRESS" ? "bg-blue-100 text-blue-600" : "bg-slate-200 text-slate-500"}`}>
          {status === "IN_PROGRESS" ? (
            <Play size={20} className="fill-current animate-scale" />
          ) : status === "CLOSED" ? (
            <CheckCircle2 size={20} />
          ) : (
            <Pause size={20} className="fill-current" />
          )}
        </div>
        <div>
          <div className="text-2xl font-bold tracking-tight text-slate-800">
            {formatDuration(totalTime)}
          </div>
          <div className="text-xs font-medium text-slate-500">
            {status === "IN_PROGRESS" ? "Active (total elapsed time)" : "Total elapsed time"}
          </div>
        </div>
      </div>

      {/* Breakdown by status */}
      <div className="space-y-2.5">
        <h4 className="text-xs font-bold text-slate-600">Breakdown by Status</h4>
        {totalTime === 0 ? (
          <p className="text-xs text-slate-400">No time recorded in any status yet.</p>
        ) : (
          <div className="space-y-2">
            {Object.entries(activeDurations)
              .filter(([_, time]) => time > 0)
              .map(([key, time]) => {
                const percentage = totalTime > 0 ? (time / totalTime) * 100 : 0;
                const theme = STATUS_THEME[key] || STATUS_THEME.NEW;
                return (
                  <div key={key} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span className={`${theme.text}`}>{TASK_STATUS_LABEL[key] ?? key}</span>
                      <span className="text-slate-500">{formatDuration(time)}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${theme.bar}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}
