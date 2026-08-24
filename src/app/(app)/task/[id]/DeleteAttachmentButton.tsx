"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { deleteTaskAttachment } from "@/lib/actions/attachments";
import { useTaskDrawer } from "../../_components/TaskDrawerContext";

export default function DeleteAttachmentButton({ attachmentId, taskId, filename }: { attachmentId: string; taskId: string; filename: string }) {
  const [showConfirm, setShowConfirm] = useState(false);
  const ctx = useTaskDrawer();

  return (
    <>
      <button
        type="button"
        onClick={() => setShowConfirm(true)}
        className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors shrink-0"
        title="Delete attachment"
      >
        <Trash2 size={14} />
      </button>

      {showConfirm && (
        <div 
          className="fixed inset-0 z-[120] grid place-items-center bg-black/30 p-4"
          onClick={() => setShowConfirm(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-slate-900">Delete Attachment</h3>
            <p className="mt-2 text-sm text-slate-500">
              Are you sure you want to delete the attachment "{filename}"? This action cannot be undone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <form 
                action={async (fd) => {
                  const res = await deleteTaskAttachment(fd);
                  setShowConfirm(false);
                  if (res?.ok && ctx?.setTaskData) {
                    ctx.setTaskData((prev) =>
                      prev
                        ? {
                            ...prev,
                            attachments: prev.attachments.filter((a) => a.id !== attachmentId),
                          }
                        : null
                    );
                  }
                }}
              >
                <input type="hidden" name="id" value={attachmentId} />
                <input type="hidden" name="taskId" value={taskId} />
                <button
                  type="submit"
                  className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
                >
                  Delete
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
