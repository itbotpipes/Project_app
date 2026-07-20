"use client";

import { useActionState, useEffect, useRef } from "react";
import { Sparkles, Send } from "lucide-react";
import { askCoach } from "@/lib/actions/coach";

type Msg = { role: "you" | "ai"; text: string };

export default function Chat() {
  const [state, action, pending] = useActionState(
    async (prev: { messages: Msg[] }, formData: FormData) => {
      const text = String(formData.get("message") || "").trim();
      if (!text) return prev;
      const res = await askCoach(null, formData);
      return { messages: [...prev.messages, { role: "you" as const, text }, { role: "ai" as const, text: res.reply }] };
    },
    { messages: [] as Msg[] },
  );
  const formRef = useRef<HTMLFormElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
    if (!pending) formRef.current?.reset();
  }, [state, pending]);

  const suggestions = ["What should I improve?", "Why did tasks slip?", "How do I grow toward promotion?"];

  return (
    <div>
      <div className="mb-3 max-h-80 space-y-3 overflow-y-auto">
        {state.messages.length === 0 && (
          <div className="rounded-lg bg-violet-50 p-3 text-sm text-violet-900">
            <Sparkles size={15} className="mr-1 inline" />
            Hi! I&apos;m your AI coach. Ask me about your week, or tap a suggestion below.
          </div>
        )}
        {state.messages.map((m, i) => (
          <div key={i} className={m.role === "you" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={
                "max-w-[85%] whitespace-pre-line rounded-2xl px-3 py-2 text-sm " +
                (m.role === "you" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-800")
              }
            >
              {m.text}
            </div>
          </div>
        ))}
        {pending && <div className="text-xs text-slate-400">Coach is thinking…</div>}
        <div ref={endRef} />
      </div>

      <div className="mb-2 flex flex-wrap gap-2">
        {suggestions.map((s) => (
          <form key={s} action={action}>
            <input type="hidden" name="message" value={s} />
            <button className="rounded-full border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100">
              {s}
            </button>
          </form>
        ))}
      </div>

      <form ref={formRef} action={action} className="flex gap-2">
        <input
          name="message"
          placeholder="Ask your coach…"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
        />
        <button
          disabled={pending}
          className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          <Send size={15} />
        </button>
      </form>
    </div>
  );
}
