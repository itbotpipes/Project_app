"use client";

import { useRef, useState } from "react";
import { UserPlus } from "lucide-react";
import { createEmployee } from "@/lib/actions/admin";

type Opt = { id: string; label: string };

export default function NewEmployeeForm({
  roles,
  managers,
}: {
  roles: Opt[];
  managers: Opt[];
}) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
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
          <label className="text-xs font-medium text-slate-600">
            Reports to
            <select name="reportsToId" className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm">
              <option value="">— none —</option>
              {managers.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </label>
          <label className="text-xs font-medium text-slate-600">
            System role
            <select name="systemRole" defaultValue="EMPLOYEE" className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm">
              <option value="EMPLOYEE">Employee</option>
              <option value="MANAGER">Manager</option>
              <option value="CEO">CEO</option>
              <option value="ADMIN">Admin</option>
            </select>
          </label>
          <label className="text-xs font-medium text-slate-600">
            Birthday
            <input name="birthday" type="date" className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm" />
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
