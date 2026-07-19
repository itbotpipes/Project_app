"use client";

import { useRef } from "react";
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

export default function MoveControl({
  taskId,
  status,
}: {
  taskId: string;
  status: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const reasonRef = useRef<HTMLInputElement>(null);

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    if (e.target.value === "ON_HOLD") {
      const reason = window.prompt("Reason for putting this task on hold? (required)");
      if (!reason) {
        e.target.value = status; // revert
        return;
      }
      if (reasonRef.current) reasonRef.current.value = reason;
    }
    formRef.current?.requestSubmit();
  }

  return (
    <form ref={formRef} action={moveTask} className="mt-2">
      <input type="hidden" name="taskId" value={taskId} />
      <input type="hidden" name="holdReason" ref={reasonRef} />
      <select
        name="status"
        defaultValue={status}
        onChange={onChange}
        className="w-full rounded-md border border-slate-300 bg-slate-50 px-2 py-1 text-xs text-slate-700 outline-none focus:border-blue-500"
      >
        {OPTIONS.map((s) => (
          <option key={s} value={s}>
            Move to: {TASK_STATUS_LABEL[s]}
          </option>
        ))}
      </select>
    </form>
  );
}
