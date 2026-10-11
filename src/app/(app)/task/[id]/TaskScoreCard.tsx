"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Award, Check, Loader2, Sparkles, AlertCircle, MessageSquare, Edit3 } from "lucide-react";
import { Card, Badge } from "../../_components/ui";
import { scoreTask } from "@/lib/actions/tasks";
import { useTaskDrawer } from "../../_components/TaskDrawerContext";

interface TaskScoreCardProps {
  taskId: string;
  canScore: boolean;
  inLoop?: boolean;
  isReviewNeeded?: boolean;
  managerScore?: number | null;
  scoreFeedback?: string | null;
  scoredAt?: string | null;
  scoredByName?: string | null;
  maxPoints?: number;
}

const SCORE_PRESETS = [
  { value: 100, label: "100% Excellent", description: "Full quality points" },
  { value: 85, label: "85% Good", description: "Minor improvement" },
  { value: 70, label: "70% Acceptable", description: "Satisfactory" },
  { value: 50, label: "50% Needs Rework", description: "Below standard" },
];

export default function TaskScoreCard({
  taskId,
  canScore,
  inLoop,
  isReviewNeeded,
  managerScore,
  scoreFeedback,
  scoredAt,
  scoredByName,
  maxPoints = 5,
}: TaskScoreCardProps) {
  const router = useRouter();
  const ctx = useTaskDrawer();
  const [isPending, startTransition] = useTransition();

  const [isEditing, setIsEditing] = useState(managerScore == null && canScore);
  const [score, setScore] = useState<number>(managerScore ?? 100);
  const [feedback, setFeedback] = useState<string>(scoreFeedback ?? "");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Calculated estimated points contribution based on maxPoints
  const estimatedPoints = Math.round((maxPoints * (score / 100) * 0.15 + maxPoints * 0.85) * 10) / 10;

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const fd = new FormData();
    fd.set("taskId", taskId);
    fd.set("score", String(score));
    if (feedback.trim()) fd.set("feedback", feedback.trim());

    startTransition(async () => {
      const res = await scoreTask(fd);
      if (res && "error" in res && res.error) {
        setErrorMsg(res.error);
        return;
      }
      setSuccessMsg("Task score saved successfully!");
      setIsEditing(false);
      ctx?.refresh();
      router.refresh();
      setTimeout(() => setSuccessMsg(null), 3000);
    });
  }

  // If user cannot score and no score has been recorded yet, don't show an empty card
  if (!canScore && managerScore == null) {
    return null;
  }

  return (
    <Card className="border-amber-200/70 bg-gradient-to-br from-amber-50/40 via-white to-white shadow-xs">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-100/70 pb-3">
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-amber-500 text-white shadow-xs">
            <Award size={15} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
              Task Quality Score
              {managerScore != null && (
                <span className="text-amber-600 font-bold">({managerScore}%)</span>
              )}
            </h3>
            <p className="text-xs text-slate-500">
              Manager evaluation &amp; quality points multiplier
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canScore && inLoop && (
            <Badge className="bg-blue-100 text-blue-700 text-[10px]">
              🔔 In Loop Manager
            </Badge>
          )}
          {canScore && isReviewNeeded && (
            <Badge className="bg-amber-100 text-amber-700 text-[10px]">
              🔍 Reviewer
            </Badge>
          )}
          {canScore && !isEditing && managerScore != null && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
            >
              <Edit3 size={11} /> Edit Score
            </button>
          )}
        </div>
      </div>

      {/* Success / Error alerts */}
      {successMsg && (
        <div className="mt-3 rounded-lg bg-emerald-50 border border-emerald-200 p-2 text-xs text-emerald-800 flex items-center gap-1.5">
          <Check size={13} className="text-emerald-600" /> {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="mt-3 rounded-lg bg-red-50 border border-red-200 p-2 text-xs text-red-700 flex items-center gap-1.5">
          <AlertCircle size={13} className="text-red-600" /> {errorMsg}
        </div>
      )}

      {/* Read-Only Display Mode */}
      {!isEditing && managerScore != null && (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200/80 bg-amber-50/50 p-3">
            <div>
              <div className="text-xs font-semibold text-amber-900">
                Quality Index: {managerScore}%
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {scoredByName ? `Graded by ${scoredByName}` : "Graded by manager"}{" "}
                {scoredAt ? `on ${new Date(scoredAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` : ""}
              </div>
            </div>

            <div className="flex items-baseline gap-1 rounded-lg bg-white border border-amber-200 px-2.5 py-1 text-amber-800 font-bold text-sm shadow-2xs">
              <Sparkles size={12} className="text-amber-500" />
              <span>{managerScore}</span>
              <span className="text-[10px] text-slate-400 font-normal">/ 100%</span>
            </div>
          </div>

          {scoreFeedback && (
            <div className="rounded-lg border border-slate-200/80 bg-white p-2.5 text-xs text-slate-700">
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                <MessageSquare size={10} /> Reviewer Note:
              </div>
              <p className="italic text-slate-600">&ldquo;{scoreFeedback}&rdquo;</p>
            </div>
          )}
        </div>
      )}

      {/* Editing / Scoring Mode (Authorized Managers Only) */}
      {isEditing && canScore && (
        <form onSubmit={handleSave} className="mt-3 space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">
              Select Quality Score: <span className="text-amber-700 font-bold text-sm">{score}%</span>
            </label>

            {/* Quick preset buttons */}
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {SCORE_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setScore(preset.value)}
                  className={`rounded-lg border p-2 text-left transition-all cursor-pointer ${
                    score === preset.value
                      ? "border-amber-500 bg-amber-50/80 ring-1 ring-amber-500"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="text-xs font-bold text-slate-800">{preset.label}</div>
                  <div className="text-[10px] text-slate-400">{preset.description}</div>
                </button>
              ))}
            </div>

            {/* Range Slider for Fine-grained adjustment */}
            <div className="mt-2.5 flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={score}
                onChange={(e) => setScore(Number(e.target.value))}
                className="h-1.5 flex-1 cursor-pointer appearance-none rounded-lg bg-slate-200 accent-amber-600"
              />
              <span className="text-xs font-bold text-slate-700 min-w-[3rem] text-right">
                {score}%
              </span>
            </div>
          </div>

          {/* Feedback note */}
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">
              Quality Feedback Note <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <textarea
              rows={2}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="e.g. Clean delivery on schedule, thorough documentation provided."
              className="w-full rounded-lg border border-slate-200 p-2 text-xs text-slate-800 focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-[11px] text-slate-400">
              Estimated Quality Index: <strong className="text-slate-700">{score}%</strong>
            </span>

            <div className="flex items-center gap-2">
              {managerScore != null && (
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={isPending}
                className="flex items-center gap-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs disabled:opacity-50 transition-colors cursor-pointer"
              >
                {isPending ? (
                  <>
                    <Loader2 size={13} className="animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Check size={13} /> Save Score
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      )}
    </Card>
  );
}
