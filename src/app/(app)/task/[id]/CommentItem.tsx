"use client";

import { useState } from "react";
import Avatar from "../../_components/Avatar";
import CommentForm from "./CommentForm";
import { CornerDownRight } from "lucide-react";

export type CommentType = {
  id: string;
  body: string;
  createdAt: string;
  parentId: string | null;
  author: { name: string; avatarUrl: string | null };
  replies?: CommentType[];
};

export default function CommentItem({ comment, taskId }: { comment: CommentType; taskId: string }) {
  const [showReplyForm, setShowReplyForm] = useState(false);

  return (
    <div className="space-y-3">
      {/* Comment Main Body */}
      <div className="flex items-start gap-3">
        <Avatar name={comment.author.name} url={comment.author.avatarUrl} size={32} />
        <div className="flex-1 min-w-0">
          <div className="text-sm">
            <span className="font-medium text-slate-800">{comment.author.name}</span>{" "}
            <span className="text-[11px] text-slate-400">
              {new Date(comment.createdAt).toLocaleString()}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-slate-700 break-words">{comment.body}</p>
          <button
            type="button"
            onClick={() => setShowReplyForm(!showReplyForm)}
            className="mt-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
          >
            Reply
          </button>

          {/* Inline Reply Form */}
          {showReplyForm && (
            <div className="mt-2.5 max-w-md">
              <CommentForm
                taskId={taskId}
                parentId={comment.id}
                placeholder={`Reply to ${comment.author.name}…`}
                onSuccess={() => setShowReplyForm(false)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Render Replies (indented) */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="ml-6 pl-4 border-l-2 border-slate-100 space-y-4">
          {comment.replies.map((reply) => (
            <div key={reply.id} className="relative">
              {/* Subtle visual connector arrow */}
              <span className="absolute -left-4 top-2 text-slate-300">
                <CornerDownRight size={14} />
              </span>
              <CommentItem comment={reply} taskId={taskId} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
