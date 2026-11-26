"use client";

import { useState } from "react";
import { Plus, X, User, Users2 } from "lucide-react";
import { createTemplate } from "@/lib/actions/templates";
import { cn } from "@/lib/cn";

type KpiOpt = { id: string; kpiName: string; roleId: string };
type RoleOpt = { id: string; title: string };

export default function CreateTemplateDialog({
  kpiOptions,
  roles,
  lockRoleId,
  lockRoleName,
  userRoleId,
  buttonLabel,
  defaultPersonal = true,
}: {
  kpiOptions: KpiOpt[];
  roles?: RoleOpt[];
  lockRoleId?: string;
  lockRoleName?: string;
  userRoleId?: string;
  buttonLabel?: string;
  defaultPersonal?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [checklist, setChecklist] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [isPersonal, setIsPersonal] = useState(lockRoleId ? false : defaultPersonal);
  const [roleId, setRoleId] = useState(lockRoleId ?? "");

  function add() {
    const t = draft.trim();
    if (!t) return;
    setChecklist((c) => [...c, t]);
    setDraft("");
  }

  // Determine effective role:
  // - Personal template: strictly user's own role (or locked role)
  // - Shared template: target position selected in dropdown, or locked role, or user's role
  const effectiveRoleId = isPersonal
    ? (lockRoleId || userRoleId || roleId)
    : (roleId || lockRoleId || userRoleId);

  const rawKpiForRole = effectiveRoleId
    ? kpiOptions.filter((k) => k.roleId === effectiveRoleId)
    : kpiOptions;

  // Deduplicate by KPI name (case-insensitive) so no KPI is ever shown double
  const seenKpiNames = new Set<string>();
  const kpiForRole: KpiOpt[] = [];
  for (const k of rawKpiForRole) {
    const key = k.kpiName.trim().toLowerCase();
    if (!seenKpiNames.has(key)) {
      seenKpiNames.add(key);
      kpiForRole.push(k);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-700 shadow-xs transition active:scale-95"
      >
        <Plus size={16} /> {buttonLabel ?? "New Template"}
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-xs p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl border border-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h2 className="text-lg font-bold text-slate-900">
                {lockRoleName ? `New template for ${lockRoleName}` : "Create Task Template"}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <form
              action={async (fd) => {
                if (lockRoleId) {
                  fd.set("roleId", lockRoleId);
                  fd.set("isPersonal", "false");
                } else {
                  fd.set("isPersonal", isPersonal ? "true" : "false");
                  if (isPersonal && userRoleId) {
                    fd.set("roleId", userRoleId);
                  }
                }
                await createTemplate(fd);
                setOpen(false);
                setChecklist([]);
              }}
              className="space-y-4"
            >
              {/* Template Scope Selection (Personal vs Shared) */}
              {!lockRoleId && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Template Ownership / Scope
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setIsPersonal(true)}
                      className={cn(
                        "flex items-center gap-2 p-2.5 rounded-xl border text-left transition text-xs",
                        isPersonal
                          ? "border-blue-600 bg-blue-50/60 font-semibold text-blue-900 ring-2 ring-blue-600/20"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      <User size={15} className={isPersonal ? "text-blue-600" : "text-slate-400"} />
                      <div>
                        <div className="font-bold">My Personal Template</div>
                        <div className="text-[10px] text-slate-500 font-normal">Private to my account</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsPersonal(false)}
                      className={cn(
                        "flex items-center gap-2 p-2.5 rounded-xl border text-left transition text-xs",
                        !isPersonal
                          ? "border-blue-600 bg-blue-50/60 font-semibold text-blue-900 ring-2 ring-blue-600/20"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      <Users2 size={15} className={!isPersonal ? "text-blue-600" : "text-slate-400"} />
                      <div>
                        <div className="font-bold">Shared / Role Template</div>
                        <div className="text-[10px] text-slate-500 font-normal">Visible to position/team</div>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Template Name <span className="text-red-500">*</span>
                </label>
                <input
                  name="name"
                  required
                  placeholder="e.g. Weekly Site Safety Inspection, Daily Quotation Check"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Task Title Generated <span className="text-red-500">*</span>
                </label>
                <input
                  name="title"
                  required
                  placeholder="The default title this template fills in"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description / Instructions (optional)
                </label>
                <textarea
                  name="description"
                  rows={2}
                  placeholder="Pre-filled task description or standard operating procedure"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              {/* Position selector when shared */}
              {!lockRoleId && !isPersonal && roles && roles.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Target Position (optional)
                  </label>
                  <select
                    name="roleId"
                    value={roleId}
                    onChange={(e) => setRoleId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
                  >
                    <option value="">— Any position (General / Company-wide) —</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    KPI Bucket
                  </label>
                  <select
                    name="kpiTemplateId"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
                  >
                    <option value="">— none —</option>
                    {kpiForRole.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.kpiName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Size / Difficulty
                  </label>
                  <select
                    name="sizeLabel"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
                  >
                    <option value="">— default —</option>
                    <option value="EASY">Easy (~30m)</option>
                    <option value="MEDIUM">Medium (~2h)</option>
                    <option value="DIFFICULT">Difficult (Half/Full Day)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Category Tag (optional)
                </label>
                <input
                  name="category"
                  placeholder="e.g. Audit, Reporting, Inspection"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </div>

              {/* Checklist builder */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-700">Pre-defined Checklist Steps</p>
                  <span className="text-[11px] text-slate-400">{checklist.length} items</span>
                </div>

                {checklist.map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input type="hidden" name="checklist" value={c} />
                    <span className="flex-1 rounded-lg bg-white border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800 shadow-2xs">
                      ☐ {c}
                    </span>
                    <button
                      type="button"
                      onClick={() => setChecklist((l) => l.filter((_, idx) => idx !== i))}
                      className="p-1 text-slate-400 hover:text-red-500"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}

                <div className="flex items-center gap-2 pt-1">
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        add();
                      }
                    }}
                    placeholder="Add step — press Enter"
                    className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={add}
                    className="rounded-lg bg-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-300 transition"
                  >
                    Add
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 shadow-xs transition"
                >
                  Save Template
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
