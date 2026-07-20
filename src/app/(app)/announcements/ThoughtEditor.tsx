"use client";

import { useState } from "react";
import { saveThought } from "@/lib/actions/announcements";

export default function ThoughtEditor({ initial }: { initial: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <form
      action={async (fd) => {
        const res = await saveThought(fd);
        setMsg(res?.error ? res.error : "✓ Thought of the day updated");
        setTimeout(() => setMsg(null), 2500);
      }}
      className="space-y-2"
    >
      <textarea
        name="body"
        rows={2}
        defaultValue={initial}
        placeholder="Share today's thought for the whole company…"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
      />
      <div className="flex items-center gap-3">
        <button className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
          Save thought
        </button>
        {msg && <span className="text-xs text-emerald-600">{msg}</span>}
      </div>
    </form>
  );
}
