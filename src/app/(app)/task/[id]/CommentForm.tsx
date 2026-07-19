"use client";

import { useRef, useState } from "react";
import { addComment } from "@/lib/actions/attachments";

export default function CommentForm({ taskId }: { taskId: string }) {
  const ref = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      ref={ref}
      action={async (fd) => {
        setBusy(true);
        await addComment(fd);
        ref.current?.reset();
        setBusy(false);
      }}
      className="flex gap-2"
    >
      <input type="hidden" name="taskId" value={taskId} />
      <input
        name="body"
        required
        placeholder="Write a comment…"
        className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
      />
      <button
        disabled={busy}
        className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {busy ? "…" : "Send"}
      </button>
    </form>
  );
}
