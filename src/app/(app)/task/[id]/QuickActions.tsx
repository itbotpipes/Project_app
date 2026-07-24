"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, MessageSquare } from "lucide-react";
import { moveTask } from "@/lib/actions/tasks";

export default function QuickActions({ taskId, status }: { taskId: string; status: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

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

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending || status === "IN_PROGRESS"}
        onClick={() => move("IN_PROGRESS")}
        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-40"
      >
        {pending ? <Loader2 size={13} className="animate-spin" /> : "🔥"} In Progress
      </button>
      <button
        type="button"
        disabled={pending || status === "CLOSED"}
        onClick={() => move("CLOSED")}
        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-40"
      >
        <CheckCircle2 size={13} /> Complete
      </button>
      <a
        href="#comment-box"
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
      >
        <MessageSquare size={13} /> Comment
      </a>
    </div>
  );
}
