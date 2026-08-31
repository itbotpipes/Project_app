"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, X, Settings } from "lucide-react";
import { addKpiTemplate, updateKpiWeightage, deleteKpiTemplate } from "@/lib/actions/admin";

type Kpi = { id: string; roleId: string; kraName: string; kpiName: string; weightage: number; isPrimary: boolean };

export default function ManageKpisDialog({ kpis, roleId }: { kpis: Kpi[]; roleId: string }) {
  const [open, setOpen] = useState(false);
  const total = useMemo(() => kpis.reduce((s, k) => s + k.weightage, 0), [kpis]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200 inline-flex items-center gap-1 transition-colors select-none"
      >
        <Settings size={13} />
        Manage Buckets
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-[2px]"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Manage KPI Buckets</h3>
                <p className="text-xs text-slate-500">
                  Each bucket represents a KPI column on your board.
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mb-3 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm font-medium">
              <span className="text-slate-600">Total Weightage:</span>
              <span className={total === 100 ? "text-emerald-600 font-bold" : "text-amber-600 font-bold"}>
                {total} / 100 points
              </span>
            </div>

            {total !== 100 && (
              <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
                ⚠️ <span className="font-semibold">Attention:</span> For scoring and appraisals to work correctly, your total weightage should sum to exactly 100 points.
              </div>
            )}

            <div className="max-h-[35vh] space-y-2 overflow-y-auto pr-1">
              {kpis.map((k) => (
                <div
                  key={k.id}
                  className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3 shadow-sm hover:border-slate-200"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-slate-800">{k.kpiName}</div>
                    <div className="truncate text-xs text-slate-400">
                      Area: {k.kraName} {k.isPrimary ? "" : " • Secondary"}
                    </div>
                  </div>
                  <form action={updateKpiWeightage} className="flex items-center gap-1.5">
                    <input type="hidden" name="id" value={k.id} />
                    <input
                      name="weightage"
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      defaultValue={k.weightage}
                      className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-right text-xs font-semibold focus:border-blue-500 focus:outline-hidden"
                    />
                    <button className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                      Save
                    </button>
                  </form>
                  <form action={deleteKpiTemplate}>
                    <input type="hidden" name="id" value={k.id} />
                    <button
                      className="rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                      title="Delete bucket (if unused)"
                    >
                      <Trash2 size={15} />
                    </button>
                  </form>
                </div>
              ))}
              {!kpis.length && (
                <p className="py-6 text-center text-sm text-slate-400">No KPI buckets defined for your role.</p>
              )}
            </div>

            <div className="mt-4 border-t border-slate-100 pt-4">
              <h4 className="mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Create New Bucket
              </h4>
              <form
                action={async (fd) => {
                  await addKpiTemplate(fd);
                }}
                className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]"
              >
                <input type="hidden" name="roleId" value={roleId} />
                <input
                  name="kraName"
                  required
                  placeholder="KRA Area (e.g. Execution)"
                  className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs focus:border-blue-500 focus:outline-hidden"
                />
                <input
                  name="kpiName"
                  required
                  placeholder="Bucket name (e.g. Pipe Laying)"
                  className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs focus:border-blue-500 focus:outline-hidden"
                />
                <input
                  name="weightage"
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  required
                  placeholder="Pts"
                  className="w-16 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-right focus:border-blue-500 focus:outline-hidden"
                />
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
                >
                  <Plus size={13} />
                  Add
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
