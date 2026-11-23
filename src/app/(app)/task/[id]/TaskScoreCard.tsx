"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Award, Check, Loader2, Sparkles, AlertCircle, MessageSquare, Edit3, Star, Zap } from "lucide-react";
import { Card, Badge } from "../../_components/ui";
import { scoreTask } from "@/lib/actions/tasks";
import { useTaskDrawer } from "../../_components/TaskDrawerContext";
import { computeTaskPoints } from "@/lib/qualityPoints";

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
  sizeLabel?: string | null;
  priority?: string | null;
  urgent?: boolean;
  important?: boolean;
  qualityBonusPoints?: number | null;
  qualityBonusReason?: string | null;
  basePoints?: number | null;
  priorityMultiplier?: number | null;
  totalApprovedPoints?: number | null;
  taskStatus?: string | null;
}

const SCORE_PRESETS = [
  { value: 100, label: "100% Excellent", description: "Flawless delivery" },
  { value: 85, label: "85% Good", description: "Minor feedback" },
  { value: 70, label: "70% Acceptable", description: "Satisfactory standard" },
  { value: 50, label: "50% Needs Rework", description: "Requires revision" },
];

const BONUS_PRESETS = [0, 5, 10, 15, 20];

export default function TaskScoreCard({
  taskId,
  canScore,
  inLoop,
  isReviewNeeded,
  managerScore,
  scoreFeedback,
  scoredAt,
  scoredByName,
  sizeLabel,
  priority,
  urgent,
  important,
  qualityBonusPoints = 0,
  qualityBonusReason,
  basePoints,
  priorityMultiplier,
  totalApprovedPoints,
  taskStatus,
}: TaskScoreCardProps) {
  const router = useRouter();
  const ctx = useTaskDrawer();
  const [isPending, startTransition] = useTransition();

  const [isEditing, setIsEditing] = useState(managerScore == null && canScore);
  const [score, setScore] = useState<number>(managerScore ?? 100);
  const [bonusPoints, setBonusPoints] = useState<number>(qualityBonusPoints ?? 0);
  const [bonusReason, setBonusReason] = useState<string>(qualityBonusReason ?? "");
  const [feedback, setFeedback] = useState<string>(scoreFeedback ?? "");
  const [autoClose, setAutoClose] = useState<boolean>(taskStatus === "PENDING_REVIEW");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Live computed points breakdown based on task attributes
  const livePoints = computeTaskPoints({
    sizeLabel,
    priority,
    urgent,
    important,
    qualityBonusPoints: bonusPoints,
  });

  const displayBasePoints = basePoints ?? livePoints.basePoints;
  const displayTotalPoints = totalApprovedPoints ?? livePoints.totalPoints;
  const displayBonusPoints = qualityBonusPoints ?? bonusPoints;

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const fd = new FormData();
    fd.set("taskId", taskId);
    fd.set("score", String(score));
    fd.set("qualityBonusPoints", String(bonusPoints));
    if (bonusReason.trim()) fd.set("qualityBonusReason", bonusReason.trim());
    if (feedback.trim()) fd.set("feedback", feedback.trim());
    if (autoClose) fd.set("autoClose", "true");

    startTransition(async () => {
      const res = await scoreTask(fd);
      if (res && "error" in res && res.error) {
        setErrorMsg(res.error);
        return;
      }
      setSuccessMsg("Task score and quality reward points saved successfully!");
      setIsEditing(false);
      ctx?.refresh();
      router.refresh();
      setTimeout(() => setSuccessMsg(null), 3500);
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
              Task Quality Score &amp; Reward Points
              {managerScore != null && (
                <span className="text-amber-600 font-bold">({managerScore}%)</span>
              )}
            </h3>
            <p className="text-xs text-slate-500">
              Evaluation, size multiplier &amp; quality bonus points
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
          {/* Points Breakdown Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-2xs">
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Base Points</div>
              <div className="text-sm font-bold text-slate-800 mt-0.5 flex items-center gap-1">
                <Zap size={13} className="text-amber-500" />
                <span>{displayBasePoints} pts</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {livePoints.sizeName.split(" ")[0]} × {livePoints.multiplier}x
              </div>
            </div>

            <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-2.5 shadow-2xs">
              <div className="text-[10px] uppercase font-bold tracking-wider text-purple-600">Manager Quality Bonus</div>
              <div className="text-sm font-bold text-purple-900 mt-0.5 flex items-center gap-1">
                <Star size={13} className="text-purple-600" />
                <span>+{displayBonusPoints} pts</span>
              </div>
              <div className="text-[10px] text-purple-700/80 mt-0.5 truncate">
                {qualityBonusReason || "High Quality Bonus"}
              </div>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-2.5 shadow-2xs">
              <div className="text-[10px] uppercase font-bold tracking-wider text-emerald-700">Total Approved Points</div>
              <div className="text-sm font-bold text-emerald-900 mt-0.5 flex items-center gap-1">
                <Sparkles size={13} className="text-emerald-600" />
                <span>{displayTotalPoints} pts</span>
              </div>
              <div className="text-[10px] text-emerald-700/80 mt-0.5">
                Quality Index: {managerScore}%
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200/80 bg-amber-50/50 p-2.5 text-xs text-slate-700">
            <div>
              <span className="font-semibold text-amber-900">Evaluated by: </span>
              <span>{scoredByName || "Manager"}</span>
              {scoredAt && (
                <span className="text-slate-500 text-[11px] ml-1">
                  ({new Date(scoredAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })})
                </span>
              )}
            </div>
            {totalApprovedPoints != null && (
              <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-300 font-semibold">
                ✓ Points Awarded &amp; Audited
              </Badge>
            )}
          </div>

          {scoreFeedback && (
            <div className="rounded-lg border border-slate-200/80 bg-white p-2.5 text-xs text-slate-700">
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                <MessageSquare size={10} /> Reviewer Feedback:
              </div>
              <p className="italic text-slate-600">&ldquo;{scoreFeedback}&rdquo;</p>
            </div>
          )}
        </div>
      )}

      {/* Editing / Scoring Mode (Authorized Managers Only) */}
      {isEditing && canScore && (
        <form onSubmit={handleSave} className="mt-3 space-y-3.5">
          {/* Quality Score presets and slider */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">
              1. Quality Score (%): <span className="text-amber-700 font-bold text-sm">{score}%</span>
            </label>

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

          {/* Points Breakdown & Quality Bonus Section */}
          <div className="rounded-xl border border-purple-200 bg-purple-50/40 p-3 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-bold text-purple-950 flex items-center gap-1.5">
                <Star size={13} className="text-purple-600" />
                2. Manager Quality Bonus Points (Optional):
              </label>
              <div className="text-xs font-bold text-purple-800">
                +{bonusPoints} Bonus Pts
              </div>
            </div>

            {/* Quick Bonus Preset Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              {BONUS_PRESETS.map((pts) => (
                <button
                  key={pts}
                  type="button"
                  onClick={() => setBonusPoints(pts)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
                    bonusPoints === pts
                      ? "bg-purple-600 text-white shadow-2xs"
                      : "border border-purple-200 bg-white text-purple-700 hover:bg-purple-50"
                  }`}
                >
                  {pts === 0 ? "No Bonus" : `+${pts} pts`}
                </button>
              ))}
              <input
                type="number"
                min="0"
                max="50"
                value={bonusPoints}
                onChange={(e) => setBonusPoints(Math.max(0, Number(e.target.value)))}
                placeholder="Custom"
                className="w-18 rounded-lg border border-purple-200 bg-white px-2 py-1 text-xs text-purple-900 outline-none focus:border-purple-500 font-semibold"
              />
            </div>

            <input
              type="text"
              value={bonusReason}
              onChange={(e) => setBonusReason(e.target.value)}
              placeholder="Reason for quality bonus (e.g. Exceptional precision, zero bugs, ahead of schedule)"
              className="w-full rounded-lg border border-purple-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-purple-500"
            />

            {/* Live calculation banner */}
            <div className="rounded-lg bg-white border border-purple-100 p-2 flex items-center justify-between text-xs text-slate-700">
              <span className="text-[11px] text-slate-500">
                Base ({livePoints.sizeName.split(" ")[0]} × {livePoints.multiplier}x): <strong>{livePoints.basePoints} pts</strong> + Bonus: <strong>{bonusPoints} pts</strong>
              </span>
              <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Total: {livePoints.totalPoints} pts
              </span>
            </div>
          </div>

          {/* Feedback note */}
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">
              3. Review Feedback Note <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <textarea
              rows={2}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="e.g. Clean delivery on schedule, thorough documentation provided."
              className="w-full rounded-lg border border-slate-200 p-2 text-xs text-slate-800 focus:border-amber-500 focus:outline-none"
            />
          </div>

          {/* Auto-close option if task is PENDING_REVIEW */}
          {taskStatus === "PENDING_REVIEW" && (
            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer bg-amber-50/60 p-2 rounded-lg border border-amber-200/60">
              <input
                type="checkbox"
                checked={autoClose}
                onChange={(e) => setAutoClose(e.target.checked)}
                className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
              />
              <span>Approve and mark task as Completed (CLOSED)</span>
            </label>
          )}

          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-[11px] text-slate-500">
              Total Approved Points to Award: <strong className="text-emerald-700">{livePoints.totalPoints} pts</strong>
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
                    <Check size={13} /> Approve &amp; Save Points
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
