"use client";

import { useRef, useState, useTransition } from "react";
import { Edit2, X } from "lucide-react";
import { updateEmployee } from "@/lib/actions/admin";

type Opt = { id: string; label: string };

interface EmployeeData {
  id: string;
  name: string;
  email: string;
  roleId: string;
  reportsToId: string | null;
  reportsToIds?: string[];
  systemRole: string;
  birthday?: string | Date | null;
}

export default function EditEmployeeDialog({
  employee,
  roles,
  managers,
  systemRoles,
}: {
  employee: EmployeeData;
  roles: Opt[];
  managers: Opt[];
  systemRoles: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [selectedReportsToIds, setSelectedReportsToIds] = useState<string[]>(
    employee.reportsToIds || (employee.reportsToId ? [employee.reportsToId] : [])
  );

  // Format default date string for input type="date"
  let defaultBday = "";
  if (employee.birthday) {
    const d = new Date(employee.birthday);
    if (!isNaN(d.getTime())) {
      defaultBday = d.toISOString().split("T")[0];
    }
  }

  return (
    <>
      <button
        onClick={() => {
          setOpen(true);
          setMsg(null);
        }}
        className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 hover:text-slate-800"
      >
        Edit ✎
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-xl animate-scale">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-800">Edit Employee: {employee.name}</h3>
              <button
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            <form
              action={async (fd) => {
                startTransition(async () => {
                  const res = await updateEmployee(fd);
                  if (res?.error) {
                    setMsg(res.error);
                  } else {
                    setMsg("✓ Employee details updated successfully!");
                    setTimeout(() => {
                      setOpen(false);
                      setMsg(null);
                    }, 1500);
                  }
                });
              }}
              className="mt-4 grid gap-3 sm:grid-cols-2"
            >
              <input type="hidden" name="id" value={employee.id} />
              
              <label className="text-xs font-semibold text-slate-600 sm:col-span-2">
                Full Name
                <input
                  name="name"
                  required
                  defaultValue={employee.name}
                  placeholder="Full name"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white outline-none focus:border-blue-500"
                />
              </label>

              <label className="text-xs font-semibold text-slate-600 sm:col-span-2">
                Email Address
                <input
                  name="email"
                  type="email"
                  required
                  defaultValue={employee.email}
                  placeholder="email@nse.local"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white outline-none focus:border-blue-500"
                />
              </label>

              <label className="text-xs font-semibold text-slate-600">
                Position / Role
                <select
                  name="roleId"
                  required
                  defaultValue={employee.roleId}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm outline-none focus:border-blue-500"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="sm:col-span-2">
                <span className="text-xs font-semibold text-slate-600">Reports To (Select one or more managers)</span>
                <div className="mt-1 max-h-32 overflow-y-auto rounded-lg border border-slate-300 bg-white p-2 space-y-1">
                  {managers
                    .filter((m) => m.id !== employee.id) // Cannot report to self
                    .map((m) => {
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
                  {managers.filter((m) => m.id !== employee.id).length === 0 && (
                    <p className="text-xs text-slate-400 p-1">No managers available.</p>
                  )}
                </div>
              </div>

              <label className="text-xs font-semibold text-slate-600">
                System Role (Access Level)
                <select
                  name="systemRole"
                  defaultValue={employee.systemRole}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm outline-none focus:border-blue-500"
                >
                  {systemRoles.map((sr) => (
                    <option key={sr.id} value={sr.name}>
                      {sr.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-xs font-semibold text-slate-600">
                Birthday
                <input
                  name="birthday"
                  type="date"
                  defaultValue={defaultBday}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm outline-none focus:border-blue-500"
                />
              </label>

              <label className="text-xs font-semibold text-slate-600 sm:col-span-2">
                Profile Photo (leave empty to keep current photo)
                <input
                  name="avatarFile"
                  type="file"
                  accept="image/*"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </label>

              <label className="text-xs font-semibold text-slate-600 sm:col-span-2">
                Reset Password (leave empty to keep unchanged)
                <input
                  name="password"
                  type="password"
                  placeholder="Type new password to override..."
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </label>

              <div className="sm:col-span-2 mt-2 flex items-center justify-between border-t border-slate-100 pt-3">
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={pending}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {pending ? "Saving..." : "Save details"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </div>
                {msg && (
                  <span className={`text-xs font-medium ${msg.startsWith("✓") ? "text-emerald-600" : "text-red-500"}`}>
                    {msg}
                  </span>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
