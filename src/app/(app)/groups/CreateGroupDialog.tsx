"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { createGroup } from "@/lib/actions/groups";

type Dept = { id: string; name: string };
type Person = { id: string; name: string };

export default function CreateGroupDialog({ departments, people }: { departments: Dept[]; people: Person[] }) {
  const [open, setOpen] = useState(false);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const nameById = new Map(people.map((p) => [p.id, p.name]));

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
                <p className="mb-1 text-xs font-medium text-slate-600">Members</p>
                {memberIds.map((id) => (
                  <input key={id} type="hidden" name="memberIds" value={id} />
                ))}
                {memberIds.length > 0 && (
                  <div className="mb-1.5 flex flex-wrap gap-1">
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
                <div className="max-h-32 overflow-y-auto rounded-lg border border-slate-200 p-1">
                  {people.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setMemberIds((m) => (m.includes(p.id) ? m.filter((x) => x !== p.id) : [...m, p.id]))}
                      className={
                        memberIds.includes(p.id)
                          ? "block w-full rounded px-2 py-1 text-left text-sm text-emerald-700 bg-emerald-50"
                          : "block w-full rounded px-2 py-1 text-left text-sm text-slate-600 hover:bg-slate-50"
                      }
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
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
