"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { createTemplate } from "@/lib/actions/templates";

type KpiOpt = { id: string; kpiName: string; roleId: string };
type RoleOpt = { id: string; title: string };

export default function CreateTemplateDialog({
  kpiOptions,
  roles,
  lockRoleId,
  lockRoleName,
  buttonLabel,
}: {
  kpiOptions: KpiOpt[];
  roles?: RoleOpt[];
  lockRoleId?: string;
  lockRoleName?: string;
  buttonLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [checklist, setChecklist] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [roleId, setRoleId] = useState(lockRoleId ?? "");

  function add() {
    const t = draft.trim();
    if (!t) return;
    setChecklist((c) => [...c, t]);
    setDraft("");
  }

  const kpiForRole = kpiOptions.filter((k) => !roleId || k.roleId === roleId);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        <Plus size={16} /> {buttonLabel ?? "New template"}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" onClick={() => setOpen(false)}>
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-3 text-lg font-semibold">
              {lockRoleName ? `New template for ${lockRoleName}` : "New task template"}
            </h2>
            <form
              action={async (fd) => {
                if (lockRoleId) fd.set("roleId", lockRoleId);
                await createTemplate(fd);
                setOpen(false);
                setChecklist([]);
              }}
              className="space-y-3"
            >
              <input name="name" required placeholder="Template name, e.g. Weekly client report"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500" />
              <input name="title" required placeholder="Task title this creates"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500" />
              <textarea name="description" rows={2} placeholder="Description (optional)"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500" />
              {!lockRoleId && roles && roles.length > 0 && (
                <label className="block text-xs font-medium text-slate-600">
                  Position (who this template is for)
                  <select
                    name="roleId"
                    value={roleId}
                    onChange={(e) => setRoleId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
                  >
                    <option value="">— any position (general) —</option>
                    {roles.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
                  </select>
                </label>
              )}
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs font-medium text-slate-600">
                  KPI bucket
                  <select name="kpiTemplateId" className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm">
                    <option value="">— none —</option>
                    {kpiForRole.map((k) => <option key={k.id} value={k.id}>{k.kpiName}</option>)}
                  </select>
                </label>
                <label className="text-xs font-medium text-slate-600">
                  Category
                  <input name="category" className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm" />
                </label>
              </div>
              <div className="rounded-lg border border-slate-200 p-2.5">
                <p className="mb-1.5 text-xs font-semibold text-slate-600">
                  Checklist{" "}
                  <span className="font-normal text-slate-400">— matching this position&apos;s KPIs helps everyone score consistently</span>
                </p>
                {checklist.map((c, i) => (
                  <div key={i} className="mb-1 flex items-center gap-2">
                    <input type="hidden" name="checklist" value={c} />
                    <span className="flex-1 rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-700">☐ {c}</span>
                    <button type="button" onClick={() => setChecklist((l) => l.filter((_, idx) => idx !== i))} className="text-slate-300 hover:text-red-500">
                      <X size={13} />
                    </button>
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
                    placeholder="Checklist item — press Enter"
                    className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-xs outline-none focus:border-blue-500"
                  />
                  <button type="button" onClick={add} className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200">Add</button>
                </div>
              </div>
              <div className="mt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100">Cancel</button>
                <button type="submit" className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">Save template</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
