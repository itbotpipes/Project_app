"use client";

import { useRef, useState } from "react";
import { addComment } from "@/lib/actions/attachments";
import { useTaskDrawer } from "../../_components/TaskDrawerContext";

export default function CommentForm({ 
  taskId, 
  parentId, 
  placeholder, 
  onSuccess 
}: { 
  taskId: string; 
  parentId?: string; 
  placeholder?: string; 
  onSuccess?: () => void;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const ctx = useTaskDrawer();
  return (
    <form
      ref={ref}
      action={async (fd) => {
        setBusy(true);
        const res = await addComment(fd);
        ref.current?.reset();
        setBusy(false);
        if (res?.comment && ctx?.setTaskData) {
          ctx.setTaskData((prev) => {
            if (!prev) return null;
            
            const insertReply = (commentsList: any[]): any[] => {
              return commentsList.map(c => {
                if (c.id === res.comment.parentId) {
                  return {
                    ...c,
                    replies: [...(c.replies || []), { ...res.comment, replies: [] }]
                  };
                }
                if (c.replies && c.replies.length > 0) {
                  return {
                    ...c,
                    replies: insertReply(c.replies)
                  };
                }
                return c;
              });
            };

            const updatedComments = res.comment.parentId 
              ? insertReply(prev.comments)
              : [...prev.comments, { ...res.comment, replies: [] }];

            return {
              ...prev,
              comments: updatedComments,
              commentsCount: (prev.commentsCount || 0) + 1
            };
          });
        }
        if (onSuccess) onSuccess();
      }}
      className="flex gap-2"
    >
      <input type="hidden" name="taskId" value={taskId} />
      {parentId && <input type="hidden" name="parentId" value={parentId} />}
      <input
        name="body"
        required
        placeholder={placeholder || "Write a comment…"}
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
