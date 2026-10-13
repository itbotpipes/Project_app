"use client";

import { useState } from "react";
import { Plus, Target as TargetIcon, X, Calendar, Award, CheckCircle2, AlertCircle } from "lucide-react";
import { createTarget } from "@/lib/actions/targets";

export default function AssignTargetModal({
  employeeId,
  employeeName,
  isOpen,
  onClose,
  onTargetCreated,
}: {
  employeeId: string;
  employeeName: string;
  isOpen: boolean;
  onClose: () => void;
  onTargetCreated?: () => void;
}) {
  const [periodType, setPeriodType] = useState<"week" | "month" | "quarter" | "custom">("month");
  const [targetType, setTargetType] = useState<"NUMERIC" | "MILESTONE">("NUMERIC");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Auto calculate dates based on period selection
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  const getPresetDates = (type: "week" | "month" | "quarter" | "custom") => {
    const s = new Date();
    const e = new Date();
    if (type === "week") {
      // End of this week (Sunday)
      const day = s.getDay();
      const diff = s.getDate() + (7 - (day === 0 ? 7 : day));
      e.setDate(diff);
    } else if (type === "month") {
      // End of current month
      e.setMonth(e.getMonth() + 1, 0);
    } else if (type === "quarter") {
      // 3 months from now
      e.setMonth(e.getMonth() + 3, 0);
    }
    return {
      start: s.toISOString().slice(0, 10),
      end: e.toISOString().slice(0, 10),
    };
  };

  const [dates, setDates] = useState(getPresetDates("month"));

  const handlePeriodChange = (val: "week" | "month" | "quarter" | "custom") => {
    setPeriodType(val);
    if (val !== "custom") {
      setDates(getPresetDates(val));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
            <TargetIcon size={20} />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Assign Target</h2>
            <p className="text-xs text-slate-500">For {employeeName} — contributes to performance points & review</p>
          </div>
        </div>

        {error && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-700 border border-red-200">
            <AlertCircle size={15} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-700 border border-emerald-200">
            <CheckCircle2 size={15} className="shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <form
          action={async (fd) => {
            setLoading(true);
            setError(null);
            setSuccess(null);
            try {
              const res = await createTarget(fd);
              if (res.error) {
                setError(res.error);
              } else {
                setSuccess("Target assigned successfully!");
                setTimeout(() => {
                  onTargetCreated?.();
                  onClose();
                }, 1000);
              }
            } catch (err: any) {
              setError(err.message || "Failed to assign target");
            } finally {
              setLoading(false);
            }
          }}
          className="mt-4 space-y-4"
        >
          <input type="hidden" name="employeeId" value={employeeId} />
          <input type="hidden" name="periodType" value={periodType} />
          <input type="hidden" name="targetType" value={targetType} />

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Target Title <span className="text-red-500">*</span>
            </label>
            <input
              name="title"
              type="text"
              required
              placeholder="e.g. Conduct 25 Site Inspections, Generate ₹5L Sales, Deploy Redesign"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-violet-500 focus:outline-none"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Description / Deliverables (Optional)
            </label>
            <textarea
              name="description"
              rows={2}
              placeholder="Provide exact deliverables, success criteria, or instructions..."
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-violet-500 focus:outline-none"
            />
          </div>

          {/* Period selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Evaluation Timeframe
            </label>
            <div className="grid grid-cols-4 gap-1.5 rounded-xl bg-slate-100 p-1 text-xs">
              {(["week", "month", "quarter", "custom"] as const).map((p) => (
                <button
                  type="button"
                  key={p}
                  onClick={() => handlePeriodChange(p)}
                  className={`rounded-lg py-1.5 font-medium capitalize transition ${
                    periodType === p ? "bg-white text-violet-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {p === "week" ? "This Week" : p === "month" ? "This Month" : p === "quarter" ? "3 Months" : "Custom"}
                </button>
              ))}
            </div>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Start Date</label>
              <input
                type="date"
                name="startDate"
                required
                value={dates.start}
                onChange={(e) => setDates((prev) => ({ ...prev, start: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 px-3 py-1.5 text-xs focus:border-violet-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">End / Due Date</label>
              <input
                type="date"
                name="endDate"
                required
                value={dates.end}
                onChange={(e) => setDates((prev) => ({ ...prev, end: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 px-3 py-1.5 text-xs focus:border-violet-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Target Type Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Target Type</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTargetType("NUMERIC")}
                className={`flex flex-col items-start rounded-xl border p-2.5 text-left transition ${
                  targetType === "NUMERIC" ? "border-violet-500 bg-violet-50/50" : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <span className="text-xs font-bold text-slate-900">Numeric Metric</span>
                <span className="text-[10px] text-slate-500">e.g. 50 calls, ₹10L sales, 20 visits</span>
              </button>
              <button
                type="button"
                onClick={() => setTargetType("MILESTONE")}
                className={`flex flex-col items-start rounded-xl border p-2.5 text-left transition ${
                  targetType === "MILESTONE" ? "border-violet-500 bg-violet-50/50" : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <span className="text-xs font-bold text-slate-900">Milestone / Goal</span>
                <span className="text-[10px] text-slate-500">e.g. Launch app, Complete audit</span>
              </button>
            </div>
          </div>

          {/* Value and Unit (if Numeric) */}
          {targetType === "NUMERIC" ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Target Quantity</label>
                <input
                  type="number"
                  name="targetValue"
                  min="0.1"
                  step="any"
                  defaultValue="10"
                  required
                  placeholder="10"
                  className="w-full rounded-xl border border-slate-200 px-3 py-1.5 text-xs focus:border-violet-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Metric Unit</label>
                <input
                  type="text"
                  name="metricUnit"
                  defaultValue="Units"
                  placeholder="e.g. Visits, Calls, ₹, Sites"
                  className="w-full rounded-xl border border-slate-200 px-3 py-1.5 text-xs focus:border-violet-500 focus:outline-none"
                />
              </div>
            </div>
          ) : null}

          {/* Weightage % */}
          <div>
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-700">Target Weightage in Factor</label>
              <span className="text-[11px] font-bold text-violet-700">Weightage %</span>
            </div>
            <input
              type="number"
              name="weightagePct"
              min="5"
              max="100"
              defaultValue="20"
              required
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-1.5 text-xs focus:border-violet-500 focus:outline-none"
            />
            <p className="mt-1 text-[10px] text-slate-400">
              Specifies the importance and relative weight of this target in the employee&apos;s target evaluation.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-700 transition disabled:opacity-50"
            >
              {loading ? "Assigning..." : "Assign Target"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
