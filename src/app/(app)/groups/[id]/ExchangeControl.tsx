"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Repeat } from "lucide-react";
import { reassignGroupTask } from "@/lib/actions/groups";

type Person = { id: string; name: string };

export default function ExchangeControl({ taskId, currentAssigneeId, members }: { taskId: string; currentAssigneeId: string; members: Person[] }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          setOpen((o) => !o);
        }}
        disabled={pending}
        className="inline-flex items-center gap-1 rounded-full border border-slate-300 px-2 py-0.5 text-[11px] font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40"
      >
        <Repeat size={11} /> Exchange
      </button>
      {open && (
        <div
          className="absolute right-0 top-full z-20 mt-1 w-40 rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
          onClick={(e) => e.preventDefault()}
        >
          {members.filter((m) => m.id !== currentAssigneeId).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setOpen(false);
                const fd = new FormData();
                fd.set("taskId", taskId);
                fd.set("assigneeId", m.id);
                startTransition(async () => {
                  const res = await reassignGroupTask(fd);
                  if (res && "error" in res && res.error) window.alert(res.error);
                  router.refresh();
                });
              }}
              className="block w-full rounded px-2 py-1 text-left text-xs text-slate-600 hover:bg-emerald-50"
            >
              → {m.name}
            </button>
          ))}
          {members.length <= 1 && <p className="px-2 py-1 text-[11px] text-slate-400">No other members</p>}
        </div>
      )}
    </div>
  );
}
