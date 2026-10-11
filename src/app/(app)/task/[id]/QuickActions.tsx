"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, MessageSquare, Award, Check } from "lucide-react";
import { moveTask, scoreTask } from "@/lib/actions/tasks";

export default function QuickActions({
  taskId,
  status,
  canScore = false,
}: {
  taskId: string;
  status: string;
  canScore?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [scoreVal, setScoreVal] = useState<number>(100);
  const [feedback, setFeedback] = useState<string>("");

  function move(newStatus: string) {
    const fd = new FormData();
    fd.set("taskId", taskId);
    fd.set("status", newStatus);
    startTransition(async () => {
      const res = await moveTask(fd);
      if (res && "error" in res && res.error) {
        window.alert(res.error);
        return;
      }
      router.refresh();
    });
  }

  function handleCompleteClick() {
    if (status === "PENDING_REVIEW" && canScore) {
      setShowApprovalModal(true);
      return;
    }
    move("CLOSED");
  }

  function handleApproveWithScore() {
    setShowApprovalModal(false);
    const fd = new FormData();
    fd.set("taskId", taskId);
    fd.set("score", String(scoreVal));
    if (feedback.trim()) fd.set("feedback", feedback.trim());
    fd.set("autoClose", "true");

    startTransition(async () => {
      const res = await scoreTask(fd);
      if (res && "error" in res && res.error) {
        window.alert(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pending || status === "IN_PROGRESS"}
          onClick={() => move("IN_PROGRESS")}
          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-40 transition cursor-pointer"
        >
          {pending ? <Loader2 size={13} className="animate-spin" /> : "🔥"} In Progress
        </button>

        <button
          type="button"
          disabled={pending || status === "CLOSED"}
          onClick={handleCompleteClick}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-40 transition cursor-pointer ${
            status === "PENDING_REVIEW" && canScore
              ? "border-amber-400 bg-amber-50 text-amber-800 hover:bg-amber-100"
              : "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
          }`}
        >
          {pending ? (
            <Loader2 size={13} className="animate-spin" />
          ) : status === "PENDING_REVIEW" && canScore ? (
            <Award size={13} className="text-amber-600" />
          ) : (
            <CheckCircle2 size={13} />
          )}
          {status === "PENDING_REVIEW" && canScore ? "Approve & Score" : "Complete"}
        </button>

        <a
          href="#comment-box"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 transition"
        >
          <MessageSquare size={13} /> Comment
        </a>
      </div>

      {showApprovalModal && (
        <div
          className="fixed inset-0 z-[110] grid place-items-center bg-black/40 backdrop-blur-xs p-4"
          onClick={() => setShowApprovalModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500 text-white shadow-xs">
                <Award size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 text-sm">Approve &amp; Score Task</h3>
                <p className="text-xs text-slate-500">Assign quality points before closing</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                  <span>Quality Score</span>
                  <span className="text-amber-700 font-bold">{scoreVal}%</span>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {[100, 85, 70, 50].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setScoreVal(v)}
                      className={`rounded-lg border p-1 text-xs transition cursor-pointer ${
                        scoreVal === v
                          ? "border-amber-500 bg-amber-50 font-bold text-amber-800"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      {v}%
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">
                  Review Feedback / Note
                </label>
                <textarea
                  rows={2}
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="e.g. Approved, great quality delivery!"
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800 outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => {
                  setShowApprovalModal(false);
                  move("CLOSED");
                }}
                className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                Skip score
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowApprovalModal(false)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApproveWithScore}
                  className="flex items-center gap-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition cursor-pointer"
                >
                  <Check size={13} /> Approve &amp; Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
