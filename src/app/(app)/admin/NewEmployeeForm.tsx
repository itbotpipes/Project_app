"use client";

import { useRef, useState } from "react";
import { UserPlus } from "lucide-react";
import { createEmployee } from "@/lib/actions/admin";

type Opt = { id: string; label: string };

export default function NewEmployeeForm({
  roles,
  managers,
  systemRoles,
}: {
  roles: Opt[];
  managers: Opt[];
  systemRoles: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [selectedReportsToIds, setSelectedReportsToIds] = useState<string[]>([]);
  const ref = useRef<HTMLFormElement>(null);

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        <UserPlus size={16} /> Add employee
      </button>

      {open && (
        <form
          ref={ref}
          action={async (fd) => {
            const res = await createEmployee(fd);
            if (res?.error) setMsg(res.error);
            else {
              setMsg("✓ Employee added (password: password123)");
              setSelectedReportsToIds([]);
              ref.current?.reset();
            }
          }}
          className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2"
        >
          <input name="name" required placeholder="Full name" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <input name="email" type="email" required placeholder="email@nse.local" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <label className="text-xs font-medium text-slate-600">
            Role
            <select name="roleId" required className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm">
              {roles.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </label>
          <div className="sm:col-span-2">
            <span className="text-xs font-semibold text-slate-600">Reports To (Select one or more managers)</span>
            <div className="mt-1 max-h-32 overflow-y-auto rounded-lg border border-slate-300 bg-white p-2 space-y-1">
              {managers.map((m) => {
                const isChecked = selectedReportsToIds.includes(m.id);
                return (
                  <label key={m.id} className="flex items-center gap-2 text-sm text-slate-700 hover:bg-slate-50 p-1.5 rounded cursor-pointer select-none">
                    <input
                      type="checkbox"
                      name="reportsToIds"
                      value={m.id}
                      checked={isChecked}
                      onChange={() => {
                        setSelectedReportsToIds((prev) =>
                          prev.includes(m.id)
                            ? prev.filter((id) => id !== m.id)
                            : [...prev, m.id]
                        );
                      }}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>{m.label}</span>
                  </label>
                );
              })}
              {managers.length === 0 && (
                <p className="text-xs text-slate-400 p-1">No managers available.</p>
              )}
            </div>
          </div>
          <label className="text-xs font-medium text-slate-600">
            System role
            <select name="systemRole" defaultValue="EMPLOYEE" className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm">
              {systemRoles.map((sr) => (
                <option key={sr.id} value={sr.name}>
                  {sr.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-slate-600">
            Password
            <input name="password" type="password" placeholder="Password (default: password123)" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm" />
          </label>
          <label className="text-xs font-medium text-slate-600">
            Birthday
            <input name="birthday" type="date" className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm" />
          </label>
          <label className="text-xs font-medium text-slate-600 sm:col-span-2">
            Profile Photo
            <input name="avatarFile" type="file" accept="image/*" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm" />
          </label>
          <div className="sm:col-span-2 flex items-center gap-3">
            <button className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
              Create employee
            </button>
            {msg && <span className="text-sm text-slate-600">{msg}</span>}
          </div>
        </form>
      )}
    </>
  );
}
