"use client";

import { useRef, useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Award, Check, Sparkles } from "lucide-react";
import { moveTask, scoreTask } from "@/lib/actions/tasks";
import { TASK_STATUS_LABEL } from "@/lib/constants";
import { useTaskDrawer } from "../_components/TaskDrawerContext";

const OPTIONS = [
  "NEW",
  "ACCEPTED",
  "IN_PROGRESS",
  "ON_HOLD",
  "PENDING_REVIEW",
  "CLOSED",
  "REOPENED",
];

const OPTION_LABEL: Record<string, string> = {
  REOPENED: "Send back for rework",
};

const SCORE_PRESETS = [
  { value: 100, label: "100%", desc: "Full quality" },
  { value: 85, label: "85%", desc: "Good" },
  { value: 70, label: "70%", desc: "Acceptable" },
  { value: 50, label: "50%", desc: "Needs rework" },
];

export default function MoveControl({
  taskId,
  status,
  canScore = false,
}: {
  taskId: string;
  status: string;
  canScore?: boolean;
}) {
  const selectRef = useRef<HTMLSelectElement>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const ctx = useTaskDrawer();

  // Modal state for reason prompts (HOLD or REOPEN)
  const [modal, setModal] = useState<{
    title: string;
    placeholder: string;
    field: "holdReason" | "rejectionReason";
    newStatus: string;
  } | null>(null);
  const [reasonInput, setReasonInput] = useState("");
  const [reasonError, setReasonError] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modal state for Approval Scoring (PENDING_REVIEW -> CLOSED)
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [reviewScore, setReviewScore] = useState<number>(100);
  const [reviewFeedback, setReviewFeedback] = useState<string>("");

  function submit(newStatus: string, reasonField?: "holdReason" | "rejectionReason", reason?: string) {
    const fd = new FormData();
    fd.set("taskId", taskId);
    fd.set("status", newStatus);
    if (reasonField && reason) fd.set(reasonField, reason);
    startTransition(async () => {
      const res = await moveTask(fd);
      if (res && "error" in res && res.error) {
        if (selectRef.current) selectRef.current.value = status; // revert
        setErrorMsg(res.error);
        setTimeout(() => setErrorMsg(null), 4000);
        return;
      }
      ctx?.refresh();
      router.refresh();
    });
  }

  function submitReason() {
    if (!modal) return;
    if (!reasonInput.trim()) {
      setReasonError("A reason is required.");
      return;
    }
    const { newStatus, field } = modal;
    setModal(null);
    submit(newStatus, field, reasonInput.trim());
  }

  function submitApproveWithScore() {
    setShowScoreModal(false);
    const fd = new FormData();
    fd.set("taskId", taskId);
    fd.set("score", String(reviewScore));
    if (reviewFeedback.trim()) fd.set("feedback", reviewFeedback.trim());
    fd.set("autoClose", "true");

    startTransition(async () => {
      const res = await scoreTask(fd);
      if (res && "error" in res && res.error) {
        if (selectRef.current) selectRef.current.value = status;
        setErrorMsg(res.error);
        setTimeout(() => setErrorMsg(null), 4000);
        return;
      }
      ctx?.refresh();
      router.refresh();
    });
  }

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;

    // If moving from PENDING_REVIEW to CLOSED and user can score, prompt review score dialog
    if (status === "PENDING_REVIEW" && value === "CLOSED" && canScore) {
      e.target.value = status; // revert select until confirmed
      setReviewScore(100);
      setReviewFeedback("");
      setShowScoreModal(true);
      return;
    }

    if (value === "ON_HOLD") {
      e.target.value = status; // revert select visually until confirmed
      setReasonInput("");
      setReasonError("");
      setModal({
        title: "Put Task On Hold",
        placeholder: "e.g. Waiting for client approval…",
        field: "holdReason",
        newStatus: value,
      });
      return;
    }
    if (value === "REOPENED") {
      e.target.value = status; // revert select visually until confirmed
      setReasonInput("");
      setReasonError("");
      setModal({
        title: "Send Back for Rework",
        placeholder: "Why is this being sent back? (the assignee will see this)",
        field: "rejectionReason",
        newStatus: value,
      });
      return;
    }
    submit(value);
  }

  return (
    <>
      <div className="mt-2">
        <select
          ref={selectRef}
          defaultValue={status}
          onChange={onChange}
          className="w-full rounded-md border border-slate-300 bg-slate-50 px-2 py-1 text-xs text-slate-700 outline-none focus:border-blue-500"
        >
          {OPTIONS.map((s) => (
            <option key={s} value={s}>
              Move to: {OPTION_LABEL[s] ?? TASK_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>

      {/* Review & Score Modal for PENDING_REVIEW -> CLOSED */}
      {showScoreModal && (
        <div
          className="fixed inset-0 z-[110] grid place-items-center bg-black/40 backdrop-blur-xs p-4"
          onClick={() => setShowScoreModal(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-3.5">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500 text-white shadow-xs">
                <Award size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 text-sm">Approve &amp; Score Task</h3>
                <p className="text-xs text-slate-500">Grade delivery quality before closing</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Quality Score: <span className="text-amber-700 font-bold">{reviewScore}%</span>
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {SCORE_PRESETS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setReviewScore(p.value)}
                      className={`rounded-lg border p-1.5 text-center text-xs transition cursor-pointer ${
                        reviewScore === p.value
                          ? "border-amber-500 bg-amber-50 font-bold text-amber-800"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={reviewScore}
                    onChange={(e) => setReviewScore(Number(e.target.value))}
                    className="h-1.5 flex-1 cursor-pointer appearance-none rounded-lg bg-slate-200 accent-amber-600"
                  />
                  <span className="text-xs font-bold text-slate-700 min-w-[2.5rem] text-right">
                    {reviewScore}%
                  </span>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">
                  Review Feedback / Note <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={reviewFeedback}
                  onChange={(e) => setReviewFeedback(e.target.value)}
                  placeholder="e.g. Great work, meets all requirements!"
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800 outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => {
                  setShowScoreModal(false);
                  submit("CLOSED");
                }}
                className="text-xs font-medium text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                Approve without score
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowScoreModal(false)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitApproveWithScore}
                  className="flex items-center gap-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition cursor-pointer"
                >
                  <Check size={13} /> Approve &amp; Save Score
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reason modal (Hold or Reopen) */}
      {modal && (
        <div
          className="fixed inset-0 z-[110] grid place-items-center bg-black/40 backdrop-blur-xs p-4"
          onClick={() => setModal(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-amber-50 text-amber-600">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">{modal.title}</h3>
                <p className="text-xs text-slate-500">Please provide a reason</p>
              </div>
            </div>

            <label className="block text-xs font-medium text-slate-700 mb-1">
              Reason <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              autoFocus
              value={reasonInput}
              onChange={(e) => { setReasonInput(e.target.value); setReasonError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") submitReason(); if (e.key === "Escape") setModal(null); }}
              placeholder={modal.placeholder}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
            />
            {reasonError && <p className="mt-1 text-xs text-red-500">{reasonError}</p>}

            <div className="mt-4 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="rounded-lg border border-slate-300 px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitReason}
                className="rounded-lg bg-amber-500 px-3.5 py-2 text-xs font-medium text-white hover:bg-amber-600"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error toast */}
      {errorMsg && (
        <div className="fixed bottom-6 left-1/2 z-[120] -translate-x-1/2 rounded-xl bg-red-600 px-4 py-3 text-sm text-white shadow-xl flex items-center gap-3">
          <AlertTriangle size={16} />
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="ml-2 text-white/70 hover:text-white text-lg leading-none">×</button>
        </div>
      )}
    </>
  );
}
