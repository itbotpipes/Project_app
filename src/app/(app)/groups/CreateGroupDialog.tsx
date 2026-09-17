"use client";

import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { createGroup } from "@/lib/actions/groups";

type Dept = { id: string; name: string };
type Person = { id: string; name: string };

export default function CreateGroupDialog({ departments, people }: { departments: Dept[]; people: Person[] }) {
  const [open, setOpen] = useState(false);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const nameById = new Map(people.map((p) => [p.id, p.name]));

  const filteredPeople = people.filter((p) =>
    p.name.toLowerCase().includes(memberSearch.toLowerCase())
  );

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
        aria-label="Create group"
      >
        <Plus size={18} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" onClick={() => setOpen(false)}>
          <div
            className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-3 text-lg font-semibold">New department group</h2>
            <form
              action={async (fd) => {
                await createGroup(fd);
                setOpen(false);
                setMemberIds([]);
                setMemberSearch("");
              }}
              className="space-y-3"
            >
              <input
                name="name"
                required
                placeholder="Group name, e.g. Digital Marketing Team"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
              />
              <textarea
                name="description"
                rows={2}
                placeholder="Description (optional)"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
              />
              {departments.length > 0 && (
                <label className="block text-xs font-medium text-slate-600">
                  Link to department (optional)
                  <select name="departmentId" className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm">
                    <option value="">— none —</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-xs font-medium text-slate-600">Members</p>
                  {memberIds.length > 0 && (
                    <span className="text-[11px] font-semibold text-emerald-600">
                      {memberIds.length} selected
                    </span>
                  )}
                </div>

                {memberIds.map((id) => (
                  <input key={id} type="hidden" name="memberIds" value={id} />
                ))}

                {memberIds.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1 max-h-24 overflow-y-auto p-1 bg-slate-50 rounded-lg border border-slate-100">
                    {memberIds.map((id) => (
                      <span key={id} className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                        {nameById.get(id)}
                        <button type="button" onClick={() => setMemberIds((m) => m.filter((x) => x !== id))} className="text-emerald-500 hover:text-red-500">
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Member Search Bar */}
                <div className="relative mb-2">
                  <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    placeholder="Search members..."
                    className="w-full rounded-lg border border-slate-200 pl-8 pr-3 py-1.5 text-xs outline-none focus:border-emerald-500 bg-slate-50"
                  />
                  {memberSearch && (
                    <button
                      type="button"
                      onClick={() => setMemberSearch("")}
                      className="absolute right-2 top-2 text-xs text-slate-400 hover:text-slate-600"
                    >
                      ×
                    </button>
                  )}
                </div>

                <div className="max-h-36 overflow-y-auto rounded-lg border border-slate-200 p-1 divide-y divide-slate-100">
                  {filteredPeople.map((p) => {
                    const isSelected = memberIds.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setMemberIds((m) => (m.includes(p.id) ? m.filter((x) => x !== p.id) : [...m, p.id]))}
                        className={
                          isSelected
                            ? "flex items-center justify-between w-full rounded px-2.5 py-1.5 text-left text-xs font-medium text-emerald-700 bg-emerald-50/80"
                            : "flex items-center justify-between w-full rounded px-2.5 py-1.5 text-left text-xs text-slate-600 hover:bg-slate-50"
                        }
                      >
                        <span>{p.name}</span>
                        {isSelected && <span className="text-emerald-600 text-xs">✓</span>}
                      </button>
                    );
                  })}
                  {filteredPeople.length === 0 && (
                    <p className="px-2 py-3 text-center text-xs text-slate-400">No members found matching &quot;{memberSearch}&quot;</p>
                  )}
                </div>
              </div>
              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setMemberSearch("");
                  }}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                >
                  Create group
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

