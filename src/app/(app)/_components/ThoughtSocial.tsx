"use client";

import { useState, useTransition } from "react";
import { toggleReaction, addComment, deleteComment } from "@/lib/actions/social";
import { REACTION_EMOJIS } from "@/lib/reactions";

export type ReactionSummary = { emoji: string; count: number; mine: boolean };
export type CommentT = { id: string; author: string; body: string; when: string; canDelete: boolean };

export default function ThoughtSocial({
  announcementId,
  reactions,
  comments,
}: {
  announcementId: string;
  reactions: ReactionSummary[];
  comments: CommentT[];
}) {
  const [rx, setRx] = useState<ReactionSummary[]>(reactions);
  const [list, setList] = useState<CommentT[]>(comments);
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();

  function onToggle(emoji: string) {
    setRx((prev) => {
      const found = prev.find((r) => r.emoji === emoji);
      if (found) {
        return prev
          .map((r) => (r.emoji === emoji ? { ...r, mine: !r.mine, count: r.count + (r.mine ? -1 : 1) } : r))
          .filter((r) => r.count > 0);
      }
      return [...prev, { emoji, count: 1, mine: true }];
    });
    start(() => {
      void toggleReaction(announcementId, emoji);
    });
  }

  async function submitComment(fd: FormData) {
    const body = String(fd.get("body") || "").trim();
    if (!body) return;
    setText("");
    const optimistic: CommentT = {
      id: `tmp-${Date.now()}`,
      author: "You",
      body,
      when: "just now",
      canDelete: true,
    };
    setList((l) => [...l, optimistic]);
    await addComment(fd);
  }

  function onDelete(id: string) {
    setList((l) => l.filter((c) => c.id !== id));
    start(() => {
      void deleteComment(id);
    });
  }

  const countMap = new Map(rx.map((r) => [r.emoji, r]));

  return (
    <div className="mt-3 border-t border-blue-100 pt-3">
      {/* reactions */}
      <div className="flex flex-wrap items-center gap-1.5">
        {REACTION_EMOJIS.map((emoji) => {
          const r = countMap.get(emoji);
          const mine = r?.mine ?? false;
          return (
            <button
              key={emoji}
              type="button"
              onClick={() => onToggle(emoji)}
              className={
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-sm transition " +
                (mine
                  ? "border-blue-400 bg-blue-100 text-blue-700"
                  : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50")
              }
              title={mine ? "Remove reaction" : "React"}
            >
              <span>{emoji}</span>
              {r && r.count > 0 && <span className="text-xs font-medium tabular-nums">{r.count}</span>}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="ml-1 text-xs font-medium text-blue-600 hover:underline"
        >
          💬 {list.length > 0 ? `${list.length} comment${list.length === 1 ? "" : "s"}` : "Comment"}
        </button>
      </div>

      {/* comments */}
      {(open || list.length > 0) && (
        <div className="mt-3 space-y-2">
          {list.map((c) => (
            <div key={c.id} className="group flex items-start gap-2 text-sm">
              <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-200 text-[10px] font-semibold text-slate-600">
                {c.author.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
              </div>
              <div className="min-w-0 flex-1 rounded-lg bg-white px-3 py-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-700">{c.author}</span>
                  <span className="text-[10px] text-slate-400">{c.when}</span>
                  {c.canDelete && (
                    <button
                      type="button"
                      onClick={() => onDelete(c.id)}
                      className="ml-auto text-[10px] text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-red-500"
                    >
                      delete
                    </button>
                  )}
                </div>
                <p className="whitespace-pre-wrap break-words text-slate-700">{c.body}</p>
              </div>
            </div>
          ))}

          <form action={submitComment} className="flex items-center gap-2">
            <input type="hidden" name="announcementId" value={announcementId} />
            <input
              name="body"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Add a comment…"
              maxLength={1000}
              className="flex-1 rounded-full border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-blue-400"
            />
            <button
              type="submit"
              disabled={!text.trim()}
              className="rounded-full bg-blue-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
            >
              Post
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
