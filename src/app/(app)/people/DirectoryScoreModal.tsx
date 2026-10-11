"use client";

import { useEffect, useState } from "react";
import { X, Award, AlertTriangle, Loader2 } from "lucide-react";
import { getEmployeeScoringData } from "@/lib/actions/scores";
import KpiScoreEditor from "../scores/KpiScoreEditor";
import type { DirectoryEmployee } from "./DirectoryView";

export default function DirectoryScoreModal({
  employee,
  year,
  month,
  monthLabel,
  onClose,
  onScoreUpdated,
}: {
  employee: DirectoryEmployee;
  year: number;
  month: number;
  monthLabel: string;
  onClose: () => void;
  onScoreUpdated?: (employeeId: string, newScore: number) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scoreData, setScoreData] = useState<any>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    getEmployeeScoringData(employee.id, year, month)
      .then((res: any) => {
        if (!active) return;
        if (res.error) {
          setError(res.error);
        } else {
          setScoreData(res);
        }
      })
      .catch((err) => {
        if (!active) return;
        setError(err?.message || "Failed to load scoring metrics");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [employee.id, year, month]);

  // Handle escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const initials = employee.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      {/* Backdrop click */}
      <div className="fixed inset-0" onClick={onClose} />

      {/* Modal Dialog Card */}
      <div className="relative z-10 w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-5 py-3.5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-violet-100 font-bold text-violet-800 text-sm">
              {initials}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">{employee.name}</h2>
                <span className="rounded-md bg-violet-100 px-2 py-0.5 text-[11px] font-bold text-violet-800 flex items-center gap-1">
                  <Award size={12} /> Scoring Panel
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {employee.roleTitle} · {employee.departmentName}
                {employee.managerName && employee.managerName !== "—" && <> · Reports to {employee.managerName}</>}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-block rounded-lg bg-white border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700">
              {monthLabel}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition"
              title="Close modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-3 text-slate-500">
              <Loader2 size={32} className="animate-spin text-blue-600" />
              <p className="text-xs font-medium">Loading scoring breakdown &amp; auto scores for {monthLabel}...</p>
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800 flex items-start gap-2.5">
              <AlertTriangle size={18} className="shrink-0 text-red-600 mt-0.5" />
              <div>
                <p className="font-bold">Cannot Open Scoring Panel</p>
                <p className="mt-0.5 text-red-700">{error}</p>
                <button
                  type="button"
                  onClick={onClose}
                  className="mt-3 rounded-lg bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 font-semibold transition"
                >
                  Close
                </button>
              </div>
            </div>
          ) : scoreData && scoreData.rows ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-blue-100 bg-blue-50/60 px-3.5 py-2.5 text-xs text-blue-900 flex items-center justify-between">
                <span>
                  Review auto-calculated scores based on completed work in <strong>{monthLabel}</strong>, adjust points if needed, and save to reflect in the scorecard.
                </span>
              </div>

              <KpiScoreEditor
                employeeId={employee.id}
                employeeName={employee.name}
                year={year}
                month={month}
                rows={scoreData.rows}
                behaviour={scoreData.behaviour}
                targetAchievedPct={scoreData.targetAchievedPct}
                onSaved={(newTotal) => {
                  if (onScoreUpdated) {
                    onScoreUpdated(employee.id, newTotal);
                  }
                }}
              />
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-slate-400">
              No KPI templates configured for this employee&apos;s role.
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-3 flex items-center justify-between text-xs text-slate-500">
          <span>Updates saved here immediately reflect in directory rankings and 6-month averages.</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white hover:bg-slate-100 px-3 py-1.5 font-medium text-slate-700 transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
