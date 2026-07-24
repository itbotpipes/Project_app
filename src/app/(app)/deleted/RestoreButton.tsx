"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { restoreTask } from "@/lib/actions/tasks";

export default function RestoreButton({ taskId }: { taskId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        const fd = new FormData();
        fd.set("taskId", taskId);
        startTransition(async () => {
          await restoreTask(fd);
          router.refresh();
        });
      }}
      className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-40"
    >
      <RotateCcw size={12} /> Restore
    </button>
  );
}
