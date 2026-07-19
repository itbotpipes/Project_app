"use client";

import { useRef, useState } from "react";
import { BellPlus, X } from "lucide-react";
import { createReminder, dismissReminder } from "@/lib/actions/attachments";

type Rem = { id: string; remindAt: string; sent: boolean };

export default function Reminders({ taskId, reminders }: { taskId: string; reminders: Rem[] }) {
  const ref = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const pending = reminders.filter((r) => !r.sent);

  return (
    <div className="space-y-2">
      {pending.length > 0 && (
        <ul className="space-y-1.5">
          {pending.map((r) => (
            <li key={r.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5 text-sm">
              <span>⏰ {new Date(r.remindAt).toLocaleString()}</span>
              <form action={dismissReminder}>
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="taskId" value={taskId} />
                <button className="text-slate-400 hover:text-red-500" aria-label="Dismiss">
                  <X size={14} />
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
      <form
        ref={ref}
        action={async (fd) => {
          const res = await createReminder(fd);
          if (res?.error) setError(res.error);
          else {
            setError(null);
            ref.current?.reset();
          }
        }}
        className="flex flex-wrap items-center gap-2"
      >
        <input type="hidden" name="taskId" value={taskId} />
        <input
          name="remindAt"
          type="datetime-local"
          required
          className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
        />
        <button className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100">
          <BellPlus size={15} /> Set reminder
        </button>
      </form>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
