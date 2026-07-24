"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTemplate } from "@/lib/actions/templates";

type Person = { id: string; name: string };

export default function UseTemplateButton({ templateId, people, selfId }: { templateId: string; people: Person[]; selfId: string }) {
  const [open, setOpen] = useState(false);
  const [assigneeId, setAssigneeId] = useState(selfId);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
      >
        Use template
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <select
        value={assigneeId}
        onChange={(e) => setAssigneeId(e.target.value)}
        className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
      >
        {people.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          const fd = new FormData();
          fd.set("templateId", templateId);
          fd.set("assigneeId", assigneeId);
          startTransition(async () => {
            const res = await useTemplate(fd);
            if (res && "id" in res && res.id) router.push(`/task/${res.id}`);
          });
        }}
        className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
      >
        Create
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-xs text-slate-400 hover:text-slate-600">
        cancel
      </button>
    </div>
  );
}
