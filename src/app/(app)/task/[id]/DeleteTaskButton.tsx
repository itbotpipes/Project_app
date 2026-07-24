"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { softDeleteTask } from "@/lib/actions/tasks";

export default function DeleteTaskButton({ taskId }: { taskId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!window.confirm("Move this task to Deleted Tasks? You can restore it any time.")) return;
        const fd = new FormData();
        fd.set("taskId", taskId);
        startTransition(async () => {
          await softDeleteTask(fd);
          router.push("/board");
        });
      }}
      className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
    >
      <Trash2 size={13} /> Delete
    </button>
  );
}
