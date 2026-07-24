"use client";

import { useState, useTransition } from "react";
import { addChecklistItem, toggleChecklistItem, deleteChecklistItem } from "@/lib/actions/checklist";

export type ChecklistItemDatum = { id: string; text: string; done: boolean; doneByName: string | null };

export default function Checklist({ taskId, items }: { taskId: string; items: ChecklistItemDatum[] }) {
  const [list, setList] = useState(items);
  const [text, setText] = useState("");
  const [, startTransition] = useTransition();

  const done = list.filter((i) => i.done).length;
  const pct = list.length ? Math.round((done / list.length) * 100) : 0;

  function addItem(fd: FormData) {
    const t = text.trim();
    if (!t) return;
    const tmpId = `tmp-${Date.now()}`;
    setList((l) => [...l, { id: tmpId, text: t, done: false, doneByName: null }]);
    setText("");
    startTransition(async () => {
      await addChecklistItem(fd);
    });
  }

  function toggle(id: string) {
    setList((l) => l.map((i) => (i.id === id ? { ...i, done: !i.done } : i)));
    const fd = new FormData();
    fd.set("id", id);
    startTransition(async () => {
      await toggleChecklistItem(fd);
    });
  }

  function remove(id: string) {
    setList((l) => l.filter((i) => i.id !== id));
    const fd = new FormData();
    fd.set("id", id);
    startTransition(async () => {
      await deleteChecklistItem(fd);
    });
  }

  return (
    <div>
      {list.length > 0 && (
        <div className="mb-3">
          <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
            <span>
              {done}/{list.length} done
            </span>
            <span>{pct}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      <ul className="space-y-1.5">
        {list.map((item) => (
          <li key={item.id} className="flex items-center gap-2 rounded-lg border border-slate-100 px-2 py-1.5">
            <input
              type="checkbox"
              checked={item.done}
              onChange={() => toggle(item.id)}
              className="h-4 w-4 shrink-0 accent-emerald-600"
            />
            <span className={item.done ? "flex-1 text-sm text-slate-400 line-through" : "flex-1 text-sm text-slate-700"}>
              {item.text}
            </span>
            {item.done && item.doneByName && (
              <span className="shrink-0 text-[10px] text-emerald-600">✓ {item.doneByName}</span>
            )}
            <button
              type="button"
              onClick={() => remove(item.id)}
              className="shrink-0 text-slate-300 hover:text-red-500"
              aria-label="Remove checklist item"
            >
              ×
            </button>
          </li>
        ))}
        {!list.length && <p className="text-sm text-slate-400">No checklist yet — add items below.</p>}
      </ul>

      <form
        action={(fd) => addItem(fd)}
        className="mt-3 flex items-center gap-2"
      >
        <input type="hidden" name="taskId" value={taskId} />
        <input
          name="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a checklist item…"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
        >
          Add
        </button>
      </form>
      <p className="mt-2 text-[11px] text-slate-400">
        Add as many items as you need — the task can only move to Closed once every box is ticked.
      </p>
    </div>
  );
}
