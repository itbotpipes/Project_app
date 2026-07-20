"use client";

import { useMemo, useState } from "react";
import { saveMonthlyScorecard, saveYearlyReview } from "@/lib/actions/scores";

type Row = {
  id: string;
  name: string;
  kra: string;
  weightage: number;
  auto: number;
  tasks: number;
  current: number | null;
  saved: boolean;
};

export default function KpiScoreEditor({
  employeeId,
  employeeName,
  year,
  month,
  rows,
  behaviourScore,
  targetAchievedPct,
}: {
  employeeId: string;
  employeeName: string;
  year: number;
  month: number;
  rows: Row[];
  behaviourScore: number | null;
  targetAchievedPct: number | null;
}) {
  // controlled final values (default: saved value, else the system auto value)
  const [vals, setVals] = useState<Record<string, string>>(
    Object.fromEntries(rows.map((r) => [r.id, String(r.current ?? r.auto)])),
  );
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [reviewMsg, setReviewMsg] = useState<string | null>(null);

  const finalTotal = useMemo(
    () => rows.reduce((s, r) => s + (Number(vals[r.id]) || 0), 0),
    [rows, vals],
  );
  const autoTotal = rows.reduce((s, r) => s + r.auto, 0);

  function resetToAuto() {
    setVals(Object.fromEntries(rows.map((r) => [r.id, String(r.auto)])));
  }

  return (
    <div className="space-y-4">
      <form
        action={async (fd) => {
          const res = await saveMonthlyScorecard(fd);
          setSavedMsg(res?.error ? res.error : "✓ Saved & reflected to employee");
          setTimeout(() => setSavedMsg(null), 2500);
        }}
      >
        <input type="hidden" name="employeeId" value={employeeId} />
        <input type="hidden" name="year" value={year} />
        <input type="hidden" name="month" value={month} />

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                <th className="pb-1 font-medium">KPI</th>
                <th className="pb-1 text-center font-medium">Tasks</th>
                <th className="pb-1 text-center font-medium">Auto</th>
                <th className="pb-1 text-center font-medium">Final</th>
                <th className="pb-1 text-right font-medium">Max</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="py-1.5">
                    <div className="font-medium text-slate-800">{r.name}</div>
                    <div className="text-[11px] text-slate-400">{r.kra}</div>
                  </td>
                  <td className="py-1.5 text-center text-slate-500">{r.tasks}</td>
                  <td className="py-1.5 text-center">
                    <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-700">
                      {r.auto}
                    </span>
                  </td>
                  <td className="py-1.5 text-center">
                    <input
                      name={`kpi_${r.id}`}
                      type="number"
                      min="0"
                      max={r.weightage}
                      step="0.5"
                      value={vals[r.id] ?? ""}
                      onChange={(e) => setVals((v) => ({ ...v, [r.id]: e.target.value }))}
                      className="w-16 rounded-md border border-slate-300 px-2 py-1 text-right text-sm"
                    />
                  </td>
                  <td className="py-1.5 text-right text-xs text-slate-400">/ {r.weightage}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 font-semibold">
                <td className="pt-2">Total</td>
                <td></td>
                <td className="pt-2 text-center text-blue-700">{Math.round(autoTotal)}</td>
                <td className="pt-2 text-center text-violet-700">{Math.round(finalTotal)}</td>
                <td className="pt-2 text-right text-xs text-slate-400">/ 100</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
            Save scores
          </button>
          <button
            type="button"
            onClick={resetToAuto}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
          >
            Reset all to Auto
          </button>
          {savedMsg && <span className="text-xs text-emerald-600">{savedMsg}</span>}
        </div>
      </form>

      {/* Annual inputs feeding the increment projection */}
      <form
        action={async (fd) => {
          const res = await saveYearlyReview(fd);
          setReviewMsg(res?.error ? res.error : "✓ Saved");
          setTimeout(() => setReviewMsg(null), 2500);
        }}
        className="rounded-lg bg-slate-50 p-3"
      >
        <input type="hidden" name="employeeId" value={employeeId} />
        <input type="hidden" name="year" value={year} />
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Annual review — feeds {employeeName.split(" ")[0]}&apos;s increment ({year})
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <label className="text-xs font-medium text-slate-600">
            Behaviour (0–100)
            <input
              name="behaviourScore"
              type="number"
              min="0"
              max="100"
              defaultValue={behaviourScore ?? ""}
              placeholder="—"
              className="mt-1 block w-24 rounded-md border border-slate-300 px-2 py-1 text-sm"
            />
          </label>
          <label className="text-xs font-medium text-slate-600">
            Target achieved % (0–100)
            <input
              name="targetAchievedPct"
              type="number"
              min="0"
              max="100"
              defaultValue={targetAchievedPct ?? ""}
              placeholder="—"
              className="mt-1 block w-28 rounded-md border border-slate-300 px-2 py-1 text-sm"
            />
          </label>
          <button className="rounded-lg bg-slate-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800">
            Save annual
          </button>
          {reviewMsg && <span className="text-xs text-emerald-600">{reviewMsg}</span>}
        </div>
      </form>
    </div>
  );
}
