"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GripVertical, Move, UserCheck, AlertCircle, Check, RefreshCw, Building2 } from "lucide-react";
import { updateEmployeeRole, reassignReportingLine, updateRoleDepartment } from "@/lib/actions/admin";

export type RoleOption = { id: string; title: string; departmentId: string | null };
export type DeptOption = { id: string; name: string };

export type PositionPerson = {
  id: string;
  name: string;
  roleId: string;
  roleTitle: string;
  reportsToId: string | null;
  departmentId: string | null;
  avatarUrl?: string | null;
};

export type PositionDept = {
  id: string;
  name: string;
  people: PositionPerson[];
};

export type PositionOrgData = {
  root: PositionPerson | null;
  departments: PositionDept[];
  allDepartments: DeptOption[];
  roles: RoleOption[];
};

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export default function InteractivePositionOrgChart({
  initialData,
  canEdit,
}: {
  initialData: PositionOrgData;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [data, setData] = useState<PositionOrgData>(initialData);
  const [draggedPersonId, setDraggedPersonId] = useState<string | null>(null);
  const [dragOverDeptId, setDragOverDeptId] = useState<string | null>(null);
  const [dragOverPersonId, setDragOverPersonId] = useState<string | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<PositionPerson | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  // Helper to find person across data
  function findPerson(id: string): PositionPerson | null {
    if (data.root?.id === id) return data.root;
    for (const d of data.departments) {
      const p = d.people.find((person) => person.id === id);
      if (p) return p;
    }
    return null;
  }

  // Handle changing department directly for person's role/position
  async function handleDepartmentChange(personId: string, newDeptId: string) {
    const person = findPerson(personId);
    if (!person || !person.roleId) return;

    const targetDept = data.allDepartments.find((d) => d.id === newDeptId);
    if (!targetDept) return;

    // Optimistic UI update
    setData((prev) => {
      const updatedPerson = { ...person, departmentId: newDeptId };
      const updatedDepts = prev.departments.map((dept) => {
        const filteredPeople = dept.people.filter((p) => p.id !== personId);
        if (dept.id === newDeptId) {
          return { ...dept, people: [...filteredPeople, updatedPerson] };
        }
        return { ...dept, people: filteredPeople };
      });
      return { ...prev, departments: updatedDepts };
    });

    setStatusMsg(null);
    startTransition(async () => {
      const res = await updateRoleDepartment(person.roleId, newDeptId);
      if (res?.error) {
        setData(initialData);
        setStatusMsg({ type: "error", text: res.error });
      } else {
        setStatusMsg({
          type: "success",
          text: `Moved ${person.roleTitle} (${person.name}) to department ${targetDept.name}.`,
        });
        router.refresh();
      }
    });
  }

  // Handle changing person's position/role via dropdown or drag & drop
  async function handleRoleChange(personId: string, targetRoleId: string, targetDeptId?: string | null) {
    const person = findPerson(personId);
    if (!person) return;

    const newRole = data.roles.find((r) => r.id === targetRoleId);
    if (!newRole) return;

    // Optimistic UI update
    setData((prev) => {
      const updatedPerson = {
        ...person,
        roleId: newRole.id,
        roleTitle: newRole.title,
        departmentId: newRole.departmentId,
      };

      if (prev.root?.id === personId) {
        return { ...prev, root: updatedPerson };
      }

      const updatedDepts = prev.departments.map((dept) => {
        const filteredPeople = dept.people.filter((p) => p.id !== personId);
        if (dept.id === newRole.departmentId) {
          return {
            ...dept,
            people: [...filteredPeople, updatedPerson],
          };
        }
        return { ...dept, people: filteredPeople };
      });

      return { ...prev, departments: updatedDepts };
    });

    setStatusMsg(null);
    startTransition(async () => {
      const res = await updateEmployeeRole(personId, targetRoleId);
      if (res?.error) {
        setData(initialData);
        setStatusMsg({ type: "error", text: res.error });
      } else {
        setStatusMsg({
          type: "success",
          text: `Updated ${person.name}'s position to ${newRole.title}.`,
        });
        router.refresh();
      }
    });
  }

  // Handle reporting line change in position chart
  async function handleReassignReporting(personId: string, newManagerId: string | null) {
    const person = findPerson(personId);
    if (!person) return;

    setStatusMsg(null);
    startTransition(async () => {
      const res = await reassignReportingLine(personId, newManagerId);
      if (res?.error) {
        setStatusMsg({ type: "error", text: res.error });
      } else {
        setStatusMsg({
          type: "success",
          text: `Updated ${person.name}'s reporting manager.`,
        });
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Top Banner & Control Instructions */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50/60 p-4 text-xs text-blue-900">
        <div className="flex items-center gap-2">
          <Move className="text-blue-600 shrink-0" size={16} />
          <span>
            {canEdit ? (
              <>
                <strong>Department & Position Management:</strong> Drag employee cards into a department column to transfer them, or click any card to update department, position, and reporting line.
              </>
            ) : (
              <>Company organizational view by position and department structure.</>
            )}
          </span>
        </div>
        {isPending && (
          <div className="flex items-center gap-1.5 font-medium text-blue-700">
            <RefreshCw size={13} className="animate-spin" /> Saving changes...
          </div>
        )}
      </div>

      {/* Status Feedback Toast */}
      {statusMsg && (
        <div
          className={`flex items-center gap-2 rounded-xl p-3.5 text-xs font-medium ${
            statusMsg.type === "success"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          {statusMsg.type === "success" ? (
            <Check size={16} className="text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle size={16} className="text-rose-600 shrink-0" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Main Position Org Tree */}
      <div className="overflow-x-auto py-4">
        {data.root && (
          <ul className="org-tree min-w-max">
            <li>
              {/* Top Leader / Root Box */}
              <div
                onClick={() => canEdit && setSelectedPerson(data.root)}
                className="inline-block cursor-pointer whitespace-nowrap rounded-xl border-2 border-blue-400 bg-white px-6 py-3 shadow-sm transition hover:border-blue-600 hover:shadow-md"
              >
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blue-600 font-bold text-white text-xs">
                    {initials(data.root.name)}
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-bold uppercase tracking-wide text-blue-900">{data.root.name}</div>
                    <div className="text-xs font-semibold text-blue-600">{data.root.roleTitle}</div>
                  </div>
                </div>
              </div>

              {/* Departments Columns */}
              {data.departments.length > 0 && (
                <ul>
                  {data.departments.map((dept) => {
                    const isDeptTarget = dragOverDeptId === dept.id;

                    return (
                      <li key={dept.id}>
                        {/* Department Header Box */}
                        <div
                          onDragOver={(e) => {
                            if (!canEdit || !draggedPersonId) return;
                            e.preventDefault();
                            setDragOverDeptId(dept.id);
                          }}
                          onDragLeave={() => setDragOverDeptId(null)}
                          onDrop={(e) => {
                            e.preventDefault();
                            setDragOverDeptId(null);
                            if (draggedPersonId) {
                              // Move department directly
                              handleDepartmentChange(draggedPersonId, dept.id);
                            }
                          }}
                          className={`whitespace-nowrap rounded-xl border-2 px-5 py-2.5 text-sm font-bold capitalize shadow-sm transition ${
                            isDeptTarget
                              ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-400 text-emerald-800 scale-105"
                              : "border-blue-300 bg-white text-blue-700"
                          }`}
                        >
                          {dept.name}
                        </div>

                        {/* People in Department */}
                        {dept.people.length > 0 && (
                          <ul>
                            {dept.people.map((person) => {
                              const isDragged = draggedPersonId === person.id;
                              const isPersonTarget = dragOverPersonId === person.id && draggedPersonId !== person.id;

                              return (
                                <li key={person.id}>
                                  <div
                                    draggable={canEdit && person.id !== data.root?.id}
                                    onDragStart={(e) => {
                                      if (!canEdit || person.id === data.root?.id) return;
                                      setDraggedPersonId(person.id);
                                      e.dataTransfer.setData("text/plain", person.id);
                                    }}
                                    onDragEnd={() => {
                                      setDraggedPersonId(null);
                                      setDragOverDeptId(null);
                                      setDragOverPersonId(null);
                                    }}
                                    onDragOver={(e) => {
                                      if (!canEdit || !draggedPersonId || draggedPersonId === person.id) return;
                                      e.preventDefault();
                                      setDragOverPersonId(person.id);
                                    }}
                                    onDragLeave={() => setDragOverPersonId(null)}
                                    onDrop={(e) => {
                                      e.preventDefault();
                                      setDragOverPersonId(null);
                                      if (draggedPersonId && draggedPersonId !== person.id) {
                                        handleDepartmentChange(draggedPersonId, dept.id);
                                      }
                                    }}
                                    onClick={() => canEdit && setSelectedPerson(person)}
                                    className={`group relative flex cursor-pointer items-center justify-between gap-3 whitespace-nowrap rounded-xl border-2 bg-white px-3.5 py-2.5 shadow-sm transition ${
                                      isDragged
                                        ? "opacity-50 border-blue-400 ring-2 ring-blue-300 scale-95"
                                        : isPersonTarget
                                        ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-400 shadow-md"
                                        : "border-blue-200 hover:border-blue-400 hover:shadow-md"
                                    }`}
                                  >
                                    <div className="flex items-center gap-2.5">
                                      {canEdit && person.id !== data.root?.id && (
                                        <GripVertical size={14} className="text-slate-300 group-hover:text-slate-500 cursor-grab" />
                                      )}
                                      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-blue-100 font-bold text-blue-700 text-[11px]">
                                        {initials(person.name)}
                                      </div>
                                      <div className="text-left">
                                        <div className="text-xs font-bold text-slate-800">{person.name}</div>
                                        <div className="text-[11px] font-medium text-blue-600">{person.roleTitle}</div>
                                      </div>
                                    </div>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          </ul>
        )}
      </div>

      {/* Modal Dialog to Edit Person's Department, Position/Role & Reporting Line */}
      {selectedPerson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-100 space-y-5">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Manage Department & Position</h3>
                <p className="text-xs text-slate-500">Update department, position or reporting line for {selectedPerson.name}</p>
              </div>
              <button
                onClick={() => setSelectedPerson(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Building2 size={13} className="text-blue-600" /> Department
                </label>
                <select
                  value={selectedPerson.departmentId || ""}
                  onChange={(e) => {
                    const newDeptId = e.target.value;
                    if (newDeptId) {
                      handleDepartmentChange(selectedPerson.id, newDeptId);
                      setSelectedPerson((prev) => (prev ? { ...prev, departmentId: newDeptId } : null));
                    }
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                >
                  {data.allDepartments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Assigned Role / Position</label>
                <select
                  value={selectedPerson.roleId}
                  onChange={(e) => {
                    const newRoleId = e.target.value;
                    handleRoleChange(selectedPerson.id, newRoleId);
                    setSelectedPerson((prev) => (prev ? { ...prev, roleId: newRoleId } : null));
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                >
                  {data.roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reporting Manager</label>
                <select
                  value={selectedPerson.reportsToId || ""}
                  onChange={(e) => {
                    const managerId = e.target.value || null;
                    handleReassignReporting(selectedPerson.id, managerId);
                    setSelectedPerson((prev) => (prev ? { ...prev, reportsToId: managerId } : null));
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                >
                  <option value="">None (Top Leader / Root)</option>
                  {data.root && selectedPerson.id !== data.root.id && (
                    <option value={data.root.id}>{data.root.name} ({data.root.roleTitle})</option>
                  )}
                  {data.departments.flatMap((d) =>
                    d.people
                      .filter((p) => p.id !== selectedPerson.id)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.roleTitle})
                        </option>
                      ))
                  )}
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedPerson(null)}
                className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
