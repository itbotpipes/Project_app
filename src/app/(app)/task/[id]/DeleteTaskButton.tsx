"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, AlertTriangle } from "lucide-react";
import { softDeleteTask } from "@/lib/actions/tasks";

export default function DeleteTaskButton({ taskId }: { taskId: string }) {
  const [pending, startTransition] = useTransition();
  const [showConfirm, setShowConfirm] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    const fd = new FormData();
    fd.set("taskId", taskId);
    startTransition(async () => {
      await softDeleteTask(fd);
      setShowConfirm(false);
      router.push("/board");
    });
  }

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => setShowConfirm(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
      >
        <Trash2 size={13} /> Delete
      </button>

      {showConfirm && (
        <div 
          className="fixed inset-0 z-[100] grid place-items-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in"
          onClick={() => setShowConfirm(false)}
        >
          <div 
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl animate-pop-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-red-600 mb-3">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-red-50">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Delete Task</h3>
                <p className="text-xs text-slate-500">Confirm task removal</p>
              </div>
            </div>
            
            <p className="text-sm text-slate-600 mb-4 leading-relaxed">
              Are you sure you want to move this task to Deleted Tasks? You can restore it any time.
            </p>

            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="rounded-lg border border-slate-300 px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={handleDelete}
                className="rounded-lg bg-red-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {pending ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
