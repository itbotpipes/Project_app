"use client";

import { useState } from "react";
import {
  Target as TargetIcon,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Clock,
  Award,
  AlertCircle,
  Plus,
  Send,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { updateTargetProgress, reviewTarget } from "@/lib/actions/targets";

export interface TargetItem {
  id: string;
  title: string;
  description?: string | null;
  periodType: string;
  startDate: string | null;
  endDate: string | null;
  targetType: "NUMERIC" | "MILESTONE";
  metricUnit?: string;
  targetValue: number;
  currentValue: number;
  weightagePct: number;
  achievedPct: number;
  managerScore?: number | null;
  managerFeedback?: string | null;
  status: "ACTIVE" | "COMPLETED" | "UNDER_REVIEW" | "REVIEWED" | "CANCELLED";
  reviewedAt?: string | null;
  finalScore: number;
}

export default function TargetsSection({
  targets,
  isManager,
  employeeId,
  employeeName,
  onOpenAssignModal,
}: {
  targets: TargetItem[];
  isManager: boolean;
  employeeId: string;
  employeeName: string;
  onOpenAssignModal?: () => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ id: string; text: string; ok: boolean } | null>(null);

  // Group by status
  const activeTargets = targets.filter((t) => t.status !== "CANCELLED");

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
            <TargetIcon size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-900">Assigned Targets &amp; Goals</h2>
              <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-700 border border-violet-100">
                {activeTargets.length} Active
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Assigned by authority — directly drives performance factor and appraisal.
            </p>
          </div>
        </div>

        {isManager && onOpenAssignModal && (
          <button
            type="button"
            onClick={onOpenAssignModal}
            className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-violet-700 transition"
          >
            <Plus size={14} />
            Assign New Target
          </button>
        )}
      </div>

      {msg && (
        <div
          className={`mt-3 flex items-center gap-2 rounded-xl p-2.5 text-xs border ${
            msg.ok ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-red-50 text-red-800 border-red-200"
          }`}
        >
          {msg.ok ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Targets List */}
      <div className="mt-4 space-y-3">
        {activeTargets.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
            <TargetIcon size={24} className="mx-auto text-slate-300 mb-1.5" />
            <p className="text-xs font-medium text-slate-600">No active targets assigned for this period.</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Standard task-level KPI scoring applies at 100% full weight.
            </p>
            {isManager && onOpenAssignModal && (
              <button
                type="button"
                onClick={onOpenAssignModal}
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-violet-300 bg-white px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-50 transition"
              >
                <Plus size={13} />
                Assign first target
              </button>
            )}
          </div>
        ) : (
          activeTargets.map((target) => {
            const isExpanded = expandedId === target.id;
            const isMilestone = target.targetType === "MILESTONE";
            const progressPct = Math.min(100, Math.round(target.achievedPct));

            return (
              <div
                key={target.id}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition"
              >
                {/* Header Row */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-3.5">
                  <div className="flex items-start gap-3 flex-1 min-w-[200px]">
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                      <TargetIcon size={15} />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">{target.title}</span>
                        <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">
                          {target.weightagePct}% weight
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                            target.status === "REVIEWED"
                              ? "bg-emerald-100 text-emerald-800"
                              : target.status === "UNDER_REVIEW"
                              ? "bg-amber-100 text-amber-800"
                              : target.status === "COMPLETED"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {target.status.replace("_", " ")}
                        </span>
                      </div>
                      {target.description && (
                        <p className="mt-0.5 text-[11px] text-slate-500 line-clamp-1">{target.description}</p>
                      )}
                      <div className="mt-1 flex items-center gap-3 text-[10px] text-slate-400">
                        <span>Period: {target.periodType}</span>
                        {target.endDate && <span>Due: {new Date(target.endDate).toLocaleDateString("en-IN")}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Progress / Score Badge */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      {!isMilestone ? (
                        <div className="text-xs font-bold text-slate-800">
                          {target.currentValue} / {target.targetValue} {target.metricUnit}
                        </div>
                      ) : (
                        <div className="text-xs font-bold text-slate-800">
                          {target.status === "REVIEWED" || target.status === "COMPLETED" ? "100%" : `${progressPct}%`}
                        </div>
                      )}
                      <div className="text-[10px] font-medium text-violet-700">
                        Score: {Math.round(target.finalScore)}%
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : target.id)}
                      className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                    >
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="px-3.5 pb-2">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        target.finalScore >= 80
                          ? "bg-emerald-500"
                          : target.finalScore >= 50
                          ? "bg-blue-500"
                          : "bg-amber-500"
                      }`}
                      style={{ width: `${Math.min(100, Math.max(5, target.finalScore))}%` }}
                    />
                  </div>
                </div>

                {/* Expanded Section: Logging progress or Manager Review */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/70 p-3.5 space-y-3">
                    {/* Feedback if already reviewed */}
                    {target.managerFeedback && (
                      <div className="flex items-start gap-2 rounded-xl bg-violet-50 p-2.5 text-xs text-violet-900 border border-violet-100">
                        <MessageSquare size={14} className="mt-0.5 shrink-0 text-violet-600" />
                        <div>
                          <span className="font-semibold">Manager Feedback: </span>
                          <span>{target.managerFeedback}</span>
                          {target.managerScore != null && (
                            <span className="block font-bold text-violet-800 mt-0.5">
                              Rating: {target.managerScore}%
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Progress Update Form (Employee / Manager) */}
                    <form
                      action={async (fd) => {
                        setUpdatingId(target.id);
                        try {
                          const res = await updateTargetProgress(fd);
                          if (res.error) {
                            setMsg({ id: target.id, text: res.error, ok: false });
                          } else {
                            setMsg({ id: target.id, text: "Progress updated successfully!", ok: true });
                          }
                        } finally {
                          setUpdatingId(null);
                        }
                      }}
                      className="rounded-xl bg-white p-3 border border-slate-200 flex flex-wrap items-end gap-3 text-xs"
                    >
                      <input type="hidden" name="targetId" value={target.id} />
                      <div className="flex-1 min-w-[120px]">
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">
                          Log Current Value ({target.metricUnit || "Units"})
                        </label>
                        <input
                          type="number"
                          name="currentValue"
                          step="any"
                          defaultValue={target.currentValue}
                          className="w-full rounded-lg border border-slate-200 px-2.5 py-1 text-xs focus:border-violet-500 focus:outline-none"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={updatingId === target.id}
                        className="rounded-lg bg-slate-800 px-3 py-1.5 font-medium text-white hover:bg-slate-900 transition disabled:opacity-50"
                      >
                        Update Progress
                      </button>
                      {target.status !== "UNDER_REVIEW" && (
                        <button
                          type="submit"
                          name="submitForReview"
                          value="true"
                          disabled={updatingId === target.id}
                          className="rounded-lg bg-blue-600 px-3 py-1.5 font-medium text-white hover:bg-blue-700 transition disabled:opacity-50"
                        >
                          Submit for Review
                        </button>
                      )}
                    </form>

                    {/* Manager Review Form (Managers only) */}
                    {isManager && (
                      <form
                        action={async (fd) => {
                          setUpdatingId(target.id);
                          try {
                            const res = await reviewTarget(fd);
                            if (res.error) {
                              setMsg({ id: target.id, text: res.error, ok: false });
                            } else {
                              setMsg({ id: target.id, text: "Target review saved!", ok: true });
                            }
                          } finally {
                            setUpdatingId(null);
                          }
                        }}
                        className="rounded-xl bg-white p-3 border border-slate-200 space-y-2 text-xs"
                      >
                        <input type="hidden" name="targetId" value={target.id} />
                        <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                          <Award size={13} className="text-violet-600" />
                          Manager Target Evaluation
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[11px] font-medium text-slate-600 mb-1">
                              Manager Score % (0–100)
                            </label>
                            <input
                              type="number"
                              name="managerScore"
                              min="0"
                              max="100"
                              defaultValue={target.managerScore ?? target.achievedPct}
                              required
                              className="w-full rounded-lg border border-slate-200 px-2.5 py-1 text-xs focus:border-violet-500 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-slate-600 mb-1">Status</label>
                            <select
                              name="status"
                              defaultValue={target.status}
                              className="w-full rounded-lg border border-slate-200 px-2.5 py-1 text-xs focus:border-violet-500 focus:outline-none"
                            >
                              <option value="REVIEWED">Reviewed &amp; Finalized</option>
                              <option value="ACTIVE">Keep Active</option>
                              <option value="COMPLETED">Completed</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 mb-1">Feedback Note</label>
                          <input
                            type="text"
                            name="managerFeedback"
                            defaultValue={target.managerFeedback || ""}
                            placeholder="e.g. Met expectations, good effort on site inspections"
                            className="w-full rounded-lg border border-slate-200 px-2.5 py-1 text-xs focus:border-violet-500 focus:outline-none"
                          />
                        </div>
                        <div className="flex justify-end pt-1">
                          <button
                            type="submit"
                            disabled={updatingId === target.id}
                            className="rounded-lg bg-violet-600 px-3 py-1.5 font-medium text-white hover:bg-violet-700 transition disabled:opacity-50"
                          >
                            Save Evaluation
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
