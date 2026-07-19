"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { addKpiTemplate, updateKpiWeightage, deleteKpiTemplate } from "@/lib/actions/admin";

type Role = { id: string; title: string };
type Kpi = { id: string; roleId: string; kraName: string; kpiName: string; weightage: number; isPrimary: boolean };

export default function KpiManager({ roles, kpis }: { roles: Role[]; kpis: Kpi[] }) {
  const [roleId, setRoleId] = useState(roles[0]?.id ?? "");
  const list = useMemo(() => kpis.filter((k) => k.roleId === roleId), [kpis, roleId]);
  const total = list.reduce((s, k) => s + k.weightage, 0);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <select
          value={roleId}
          onChange={(e) => setRoleId(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          {roles.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
        </select>
        <span className={"text-sm font-medium " + (total === 100 ? "text-emerald-600" : "text-amber-600")}>
          Total weightage: {total} / 100
        </span>
      </div>

      <div className="space-y-1.5">
        {list.map((k) => (
          <div key={k.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{k.kpiName}</div>
              <div className="truncate text-xs text-slate-400">{k.kraName}{k.isPrimary ? "" : " · secondary"}</div>
            </div>
            <form action={updateKpiWeightage} className="flex items-center gap-1">
              <input type="hidden" name="id" value={k.id} />
              <input
                name="weightage"
                type="number"
                min="0"
                max="100"
                step="0.5"
                defaultValue={k.weightage}
                className="w-16 rounded-md border border-slate-300 px-2 py-1 text-right"
              />
              <button className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100">Save</button>
            </form>
            <form action={deleteKpiTemplate}>
              <input type="hidden" name="id" value={k.id} />
              <button className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Delete (only if unused)">
                <Trash2 size={15} />
              </button>
            </form>
          </div>
        ))}
        {!list.length && <p className="text-sm text-slate-400">No KPIs for this role yet.</p>}
      </div>

      <form
        action={async (fd) => {
          await addKpiTemplate(fd);
        }}
        className="mt-4 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[1fr_1fr_auto_auto_auto]"
      >
        <input type="hidden" name="roleId" value={roleId} />
        <input name="kraName" required placeholder="KRA (area)" className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
        <input name="kpiName" required placeholder="KPI / bucket name" className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
        <input name="weightage" type="number" min="0" max="100" step="0.5" placeholder="pts" className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
        <label className="flex items-center gap-1 text-xs text-slate-600"><input type="checkbox" name="isPrimary" defaultChecked /> primary</label>
        <button className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
          <Plus size={14} /> Add
        </button>
      </form>
    </div>
  );
}
