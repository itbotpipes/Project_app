"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
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

  function submit(newStatus: string, reasonField?: "holdReason" | "rejectionReason", reason?: string) {
    const fd = new FormData();
    fd.set("taskId", taskId);
    fd.set("status", newStatus);
    if (reasonField && reason) fd.set(reasonField, reason);
    startTransition(async () => {
      const res = await moveTask(fd);
      if (res && "error" in res && res.error) {
        if (selectRef.current) selectRef.current.value = status; // revert
        window.alert(res.error);
        return;
      }
      router.refresh();
    });
  }

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    if (value === "ON_HOLD") {
      const reason = window.prompt("Reason for putting this task on hold? (required)");
      if (!reason) {
        e.target.value = status; // revert
        return;
      }
      submit(value, "holdReason", reason);
      return;
    }
    if (value === "REOPENED") {
      const reason = window.prompt("Why is this being sent back for rework? (required — the assignee will see this)");
      if (!reason) {
        e.target.value = status; // revert
        return;
      }
      submit(value, "rejectionReason", reason);
      return;
    }
    submit(value);
  }

  return (
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
  );
}
