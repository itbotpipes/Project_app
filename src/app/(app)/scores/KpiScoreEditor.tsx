"use client";

import { useMemo, useState } from "react";
import { saveMonthlyScorecard, saveYearlyReview, saveBehaviourReview } from "@/lib/actions/scores";
import { BEHAVIOUR_ASPECTS, behaviourAverage, type BehaviourKey } from "@/lib/behaviour";

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

type BehaviourInput = Record<BehaviourKey, number> & { note: string | null };

export default function KpiScoreEditor({
  employeeId,
  employeeName,
  year,
  month,
  rows,
  behaviour,
  targetAchievedPct,
}: {
  employeeId: string;
  employeeName: string;
  year: number;
  month: number;
  rows: Row[];
  behaviour: BehaviourInput | null;
  targetAchievedPct: number | null;
}) {
  const [beh, setBeh] = useState<Record<BehaviourKey, string>>(
    Object.fromEntries(
      BEHAVIOUR_ASPECTS.map((a) => [a.key, behaviour ? String(behaviour[a.key]) : "0"]),
    ) as Record<BehaviourKey, string>,
  );
  const [behMsg, setBehMsg] = useState<string | null>(null);
  const behAvg = behaviourAverage(
    Object.fromEntries(BEHAVIOUR_ASPECTS.map((a) => [a.key, Number(beh[a.key]) || 0])) as Record<BehaviourKey, number>,
  );
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

      {/* Behaviour review — 6 human-judged aspects, always manual (HOD / HR / COO) */}
      <form
        action={async (fd) => {
          const res = await saveBehaviourReview(fd);
          setBehMsg(res?.error ? res.error : "✓ Saved");
          setTimeout(() => setBehMsg(null), 2500);
        }}
        className="rounded-lg border border-amber-200 bg-amber-50/60 p-3"
      >
        <input type="hidden" name="employeeId" value={employeeId} />
        <input type="hidden" name="year" value={year} />
        <input type="hidden" name="month" value={month} />
        <div className="mb-2 flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">
            Behaviour review · {monthName(month)} {year}
          </div>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800" title="Average of the 6 aspects, out of 10">
            Avg {behAvg.toFixed(1)}/10
          </span>
        </div>
        <p className="mb-2 text-[11px] text-amber-700/80">
          Judged by you (HOD / HR / COO) — cannot be auto-scored. Feeds the 5% behaviour slice of the increment.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {BEHAVIOUR_ASPECTS.map((a) => (
            <label key={a.key} className="flex items-center justify-between gap-2 rounded-md bg-white px-2 py-1.5 text-sm">
              <span className="text-slate-700">
                <span className="mr-1">{a.icon}</span>
                {a.label}
              </span>
              <span className="flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="1"
                  value={beh[a.key]}
                  onChange={(e) => setBeh((v) => ({ ...v, [a.key]: e.target.value }))}
                  className="w-24 accent-amber-500"
                />
                <input
                  name={a.key}
                  type="number"
                  min="0"
                  max="10"
                  step="0.5"
                  value={beh[a.key]}
                  onChange={(e) => setBeh((v) => ({ ...v, [a.key]: e.target.value }))}
                  className="w-14 rounded-md border border-slate-300 px-1.5 py-0.5 text-right text-sm"
                />
              </span>
            </label>
          ))}
        </div>
        <textarea
          name="behaviourNote"
          rows={2}
          defaultValue={behaviour?.note ?? ""}
          placeholder="Optional note (e.g. missed 2 days, mentored a junior…)"
          className="mt-2 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        />
        <div className="mt-2 flex items-center gap-3">
          <button className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700">
            Save behaviour
          </button>
          {behMsg && <span className="text-xs text-emerald-600">{behMsg}</span>}
        </div>
      </form>

      {/* Annual target-vs-actual — the 10% slice of the increment */}
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
          Annual target — feeds {employeeName.split(" ")[0]}&apos;s increment ({year})
        </div>
        <div className="flex flex-wrap items-end gap-4">
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
            Save target
          </button>
          {reviewMsg && <span className="text-xs text-emerald-600">{reviewMsg}</span>}
        </div>
      </form>
    </div>
  );
}

function monthName(m: number) {
  return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1] ?? String(m);
}
