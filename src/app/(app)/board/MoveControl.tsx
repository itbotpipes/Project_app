"use client";

import { useRef, useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { moveTask } from "@/lib/actions/tasks";
import { TASK_STATUS_LABEL } from "@/lib/constants";

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

export default function MoveControl({
  taskId,
  status,
}: {
  taskId: string;
  status: string;
}) {
  const selectRef = useRef<HTMLSelectElement>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  // Modal state for reason prompts
  const [modal, setModal] = useState<{
    title: string;
    placeholder: string;
    field: "holdReason" | "rejectionReason";
    newStatus: string;
  } | null>(null);
  const [reasonInput, setReasonInput] = useState("");
  const [reasonError, setReasonError] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
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

      {/* Reason modal */}
      {modal && (
        <div
          className="fixed inset-0 z-[110] grid place-items-center bg-black/40 backdrop-blur-sm p-4"
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
