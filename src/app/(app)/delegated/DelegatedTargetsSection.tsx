"use client";

import { useState } from "react";
import { Target as TargetIcon, Plus, ChevronDown, ChevronUp, Award, CheckCircle2, AlertCircle, MessageSquare } from "lucide-react";
import AssignTargetModal from "../_components/AssignTargetModal";
import { reviewTarget } from "@/lib/actions/targets";

export default function DelegatedTargetsSection({
  targets,
  assignablePeople,
}: {
  targets: any[];
  assignablePeople: Array<{ id: string; name: string }>;
}) {
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState(assignablePeople[0] || null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reviewMsg, setReviewMsg] = useState<{ [id: string]: string }>({});

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
            <TargetIcon size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-900">Delegated Targets &amp; Goals</h2>
              <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-700 border border-violet-100">
                {targets.length} Target{targets.length === 1 ? "" : "s"}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Targets you have assigned to team members — track progress and review scores.
            </p>
          </div>
        </div>

        {assignablePeople.length > 0 && (
          <div className="flex items-center gap-2">
            <select
              value={selectedPerson?.id || ""}
              onChange={(e) => {
                const found = assignablePeople.find((p) => p.id === e.target.value);
                if (found) setSelectedPerson(found);
              }}
              className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none"
            >
              {assignablePeople.map((p) => (
                <option key={p.id} value={p.id}>
                  For: {p.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setShowAssignModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-violet-700 transition"
            >
              <Plus size={14} />
              Assign Target
            </button>
          </div>
        )}
      </div>

      {targets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
          <TargetIcon size={24} className="mx-auto text-slate-300 mb-1.5" />
          <p className="text-xs font-medium text-slate-600">No delegated targets currently assigned to others.</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Use the "Assign Target" button above to give your team specific periodic targets.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {targets.map((target) => {
            const isExpanded = expandedId === target.id;
            const finalScore = target.managerScore != null ? target.managerScore : target.achievedPct;

            return (
              <div
                key={target.id}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 p-3">
                  <div className="flex items-start gap-3 flex-1 min-w-[200px]">
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-violet-100 text-[11px] font-semibold text-violet-800">
                      {(target.assigneeName || "U").split(" ").map((p: string) => p[0]).slice(0, 2).join("").toUpperCase()}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">{target.title}</span>
                        <span className="text-xs font-semibold text-slate-500">→ {target.assigneeName}</span>
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
                      <div className="mt-1 flex items-center gap-3 text-[10px] text-slate-400">
                        <span>Period: {target.periodType}</span>
                        {target.endDate && <span>Due: {new Date(target.endDate).toLocaleDateString("en-IN")}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      {target.targetType === "NUMERIC" ? (
                        <div className="text-xs font-bold text-slate-800">
                          {target.currentValue} / {target.targetValue} {target.metricUnit}
                        </div>
                      ) : (
                        <div className="text-xs font-bold text-slate-800">
                          {target.status === "REVIEWED" || target.status === "COMPLETED" ? "100%" : `${Math.round(target.achievedPct)}%`}
                        </div>
                      )}
                      <div className="text-[10px] font-medium text-violet-700">
                        Score: {Math.round(finalScore)}%
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

                {/* Progress bar */}
                <div className="px-3 pb-2">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        finalScore >= 80 ? "bg-emerald-500" : finalScore >= 50 ? "bg-blue-500" : "bg-amber-500"
                      }`}
                      style={{ width: `${Math.min(100, Math.max(5, finalScore))}%` }}
                    />
                  </div>
                </div>

                {/* Expandable Review panel */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/70 p-3 space-y-2">
                    {target.managerFeedback && (
                      <div className="flex items-start gap-2 rounded-xl bg-violet-50 p-2.5 text-xs text-violet-900 border border-violet-100">
                        <MessageSquare size={14} className="mt-0.5 shrink-0 text-violet-600" />
                        <div>
                          <span className="font-semibold">Review Feedback: </span>
                          <span>{target.managerFeedback}</span>
                          {target.managerScore != null && (
                            <span className="block font-bold text-violet-800 mt-0.5">
                              Certified Score: {target.managerScore}%
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    <form
                      action={async (fd) => {
                        const res = await reviewTarget(fd);
                        setReviewMsg((prev) => ({
                          ...prev,
                          [target.id]: res.error ? res.error : "✓ Review saved",
                        }));
                        setTimeout(() => {
                          setReviewMsg((prev) => {
                            const c = { ...prev };
                            delete c[target.id];
                            return c;
                          });
                        }, 2500);
                      }}
                      className="rounded-xl bg-white p-3 border border-slate-200 space-y-2 text-xs"
                    >
                      <input type="hidden" name="targetId" value={target.id} />
                      <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                        <Award size={13} className="text-violet-600" />
                        Score &amp; Certify Target
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 mb-1">
                            Score % (0–100)
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
                            <option value="REVIEWED">Reviewed &amp; Certified</option>
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
                          placeholder="e.g. Completed with great attention to detail..."
                          className="w-full rounded-lg border border-slate-200 px-2.5 py-1 text-xs focus:border-violet-500 focus:outline-none"
                        />
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        {reviewMsg[target.id] && (
                          <span className="text-xs text-emerald-600">{reviewMsg[target.id]}</span>
                        )}
                        <button
                          type="submit"
                          className="ml-auto rounded-lg bg-violet-600 px-3 py-1.5 font-medium text-white hover:bg-violet-700 transition"
                        >
                          Save Review
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {selectedPerson && (
        <AssignTargetModal
          employeeId={selectedPerson.id}
          employeeName={selectedPerson.name}
          isOpen={showAssignModal}
          onClose={() => setShowAssignModal(false)}
          onTargetCreated={() => {
            if (typeof window !== "undefined") window.location.reload();
          }}
        />
      )}
    </div>
  );
}
