"use client";

import { useState } from "react";
import { ClipboardList } from "lucide-react";
import { saveMonthlyScorecard } from "@/lib/actions/scores";
import { MONTHS } from "@/lib/constants";

type Kpi = { id: string; kpiName: string; kraName: string; weightage: number };

export default function ScorecardEditor({
  employeeId,
  employeeName,
  kpis,
}: {
  employeeId: string;
  employeeName: string;
  kpis: Kpi[];
}) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const now = new Date();

  if (!kpis.length) {
    return (
      <span className="text-xs text-slate-400">No KPI template for this role yet</span>
    );
  }

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
      >
        <ClipboardList size={14} /> Score month
      </button>

      {open && (
        <form
          action={async (fd) => {
            await saveMonthlyScorecard(fd);
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
            setOpen(false);
          }}
          className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3"
        >
          <input type="hidden" name="employeeId" value={employeeId} />
          <div className="mb-3 flex items-center gap-2">
            <span className="text-sm font-medium">{employeeName} —</span>
            <select
              name="month"
              defaultValue={now.getMonth() + 1}
              className="rounded-md border border-slate-300 px-2 py-1 text-sm"
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
            <select
              name="year"
              defaultValue={now.getFullYear()}
              className="rounded-md border border-slate-300 px-2 py-1 text-sm"
            >
              {[now.getFullYear(), now.getFullYear() - 1].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            {kpis.map((k) => (
              <div key={k.id} className="flex items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate" title={`${k.kraName} — ${k.kpiName}`}>
                  {k.kpiName}
                </span>
                <input
                  name={`kpi_${k.id}`}
                  type="number"
                  min="0"
                  max={k.weightage}
                  step="0.5"
                  placeholder="0"
                  className="w-16 rounded-md border border-slate-300 px-2 py-1 text-right text-sm"
                />
                <span className="w-10 text-right text-xs text-slate-400">/ {k.weightage}</span>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-3">
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              Save scorecard
            </button>
            <span className="text-xs text-slate-400">
              Total auto-calculates from these (max 100).
            </span>
          </div>
        </form>
      )}
      {saved && <span className="ml-2 text-xs text-emerald-600">✓ Saved</span>}
    </div>
  );
}
