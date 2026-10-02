"use client";

import { useState, useTransition, useMemo } from "react";
import {
  Building2,
  Users,
  Plus,
  Edit2,
  Trash2,
  UserPlus,
  UserMinus,
  Search,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  AlertTriangle,
  Briefcase,
  Shield,
  ArrowRightLeft,
  CheckCircle2,
} from "lucide-react";
import Avatar from "../_components/Avatar";
import {
  createDepartment,
  updateDepartment,
  deleteDepartment,
  updateEmployeeDepartment,
  assignEmployeesToDepartment,
  removeEmployeeFromDepartment,
  updateEmployee,
} from "@/lib/actions/admin";

export interface DepartmentItem {
  id: string;
  name: string;
  createdAt?: string | null;
}

export interface RoleOption {
  id: string;
  title: string;
  level: number;
  departmentId: string | null;
}

export interface EmployeeItem {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  active: boolean;
  roleId: string;
  departmentId?: string | null;
  role: { id?: string; title: string; departmentId?: string | null };
  systemRole: string;
  reportsToId?: string | null;
  reportsToIds?: string[];
  reportsToName?: string | null;
  birthday?: string | null;
}

export interface DepartmentManagerProps {
  departments: DepartmentItem[];
  employees: EmployeeItem[];
  roles: RoleOption[];
  systemRoles: Array<{ id: string; name: string }>;
  managers: Array<{ id: string; label: string }>;
}

export default function DepartmentManager({
  departments,
  employees,
  roles,
  systemRoles,
  managers,
}: DepartmentManagerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedDeptIds, setExpandedDeptIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newDeptName, setNewDeptName] = useState("");
  const [deptToEdit, setDeptToEdit] = useState<DepartmentItem | null>(null);
  const [editDeptName, setEditDeptName] = useState("");
  const [deptToDelete, setDeptToDelete] = useState<DepartmentItem | null>(null);
  const [deptToAddMembers, setDeptToAddMembers] = useState<DepartmentItem | null>(null);
  const [selectedEmpIdsToAdd, setSelectedEmpIdsToAdd] = useState<string[]>([]);
  const [employeeToEdit, setEmployeeToEdit] = useState<EmployeeItem | null>(null);
  const [transferEmployee, setTransferEmployee] = useState<EmployeeItem | null>(null);
  const [targetTransferDeptId, setTargetTransferDeptId] = useState<string>("");

  // Feedback notifications
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function showFeedback(type: "success" | "error", text: string) {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 4000);
  }

  // Toggle accordion for a department
  function toggleDeptExpand(id: string) {
    setExpandedDeptIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Build employee-to-department resolution map
  // An employee belongs to emp.departmentId, or fallback to emp.role.departmentId
  const enrichedEmployees = useMemo(() => {
    return employees.map((emp) => {
      const resolvedDeptId = emp.departmentId || emp.role?.departmentId || null;
      return {
        ...emp,
        resolvedDeptId,
      };
    });
  }, [employees]);

  // Group employees by department ID
  const employeesByDept = useMemo(() => {
    const map = new Map<string, typeof enrichedEmployees>();
    for (const emp of enrichedEmployees) {
      const key = emp.resolvedDeptId || "unassigned";
      const list = map.get(key) || [];
      list.push(emp);
      map.set(key, list);
    }
    return map;
  }, [enrichedEmployees]);

  // Group roles by department ID
  const rolesByDept = useMemo(() => {
    const map = new Map<string, RoleOption[]>();
    for (const role of roles) {
      const key = role.departmentId || "unassigned";
      const list = map.get(key) || [];
      list.push(role);
      map.set(key, list);
    }
    return map;
  }, [roles]);

  // Total stats
  const totalAssignedCount = useMemo(() => {
    return enrichedEmployees.filter((e) => e.resolvedDeptId !== null).length;
  }, [enrichedEmployees]);

  const unassignedEmployees = useMemo(() => {
    return enrichedEmployees.filter((e) => e.resolvedDeptId === null);
  }, [enrichedEmployees]);

  // Filtered department list based on search
  const filteredDepartments = useMemo(() => {
    if (!searchQuery.trim()) return departments;
    const q = searchQuery.toLowerCase();
    return departments.filter((dept) => {
      if (dept.name.toLowerCase().includes(q)) return true;
      const deptEmps = employeesByDept.get(dept.id) || [];
      return deptEmps.some(
        (e) => e.name.toLowerCase().includes(q) || e.role?.title?.toLowerCase().includes(q) || e.email.toLowerCase().includes(q)
      );
    });
  }, [departments, searchQuery, employeesByDept]);

  // Handlers
  function handleCreateDepartment(e: React.FormEvent) {
    e.preventDefault();
    if (!newDeptName.trim()) return;
    const fd = new FormData();
    fd.set("name", newDeptName.trim());

    startTransition(async () => {
      const res = await createDepartment(fd);
      if (res?.error) {
        showFeedback("error", res.error);
      } else {
        showFeedback("success", `Department "${newDeptName.trim()}" created successfully!`);
        setNewDeptName("");
        setIsCreateOpen(false);
      }
    });
  }

  function handleUpdateDepartment(e: React.FormEvent) {
    e.preventDefault();
    if (!deptToEdit || !editDeptName.trim()) return;

    startTransition(async () => {
      const res = await updateDepartment({ id: deptToEdit.id, name: editDeptName.trim() });
      if (res?.error) {
        showFeedback("error", res.error);
      } else {
        showFeedback("success", `Department renamed to "${editDeptName.trim()}"!`);
        setDeptToEdit(null);
      }
    });
  }

  function handleDeleteDepartment() {
    if (!deptToDelete) return;

    startTransition(async () => {
      const res = await deleteDepartment(deptToDelete.id);
      if (res?.error) {
        showFeedback("error", res.error);
      } else {
        showFeedback("success", `Department "${deptToDelete.name}" deleted and members moved to General.`);
        setDeptToDelete(null);
      }
    });
  }

  function handleAddMembersToDept() {
    if (!deptToAddMembers || selectedEmpIdsToAdd.length === 0) return;

    startTransition(async () => {
      const res = await assignEmployeesToDepartment({
        departmentId: deptToAddMembers.id,
        employeeIds: selectedEmpIdsToAdd,
      });
      if (res?.error) {
        showFeedback("error", res.error);
      } else {
        showFeedback(
          "success",
          `Assigned ${selectedEmpIdsToAdd.length} employee(s) to ${deptToAddMembers.name}!`
        );
        setSelectedEmpIdsToAdd([]);
        setDeptToAddMembers(null);
      }
    });
  }

  function handleRemoveMemberFromDept(emp: EmployeeItem) {
    if (!confirm(`Remove ${emp.name} from their department? They will be moved to General / Unassigned.`)) {
      return;
    }

    startTransition(async () => {
      const res = await removeEmployeeFromDepartment(emp.id);
      if (res?.error) {
        showFeedback("error", res.error);
      } else {
        showFeedback("success", `${emp.name} moved to General / Unassigned.`);
      }
    });
  }

  function handleTransferEmployee() {
    if (!transferEmployee) return;

    startTransition(async () => {
      const res = await updateEmployeeDepartment({
        employeeId: transferEmployee.id,
        departmentId: targetTransferDeptId || null,
      });
      if (res?.error) {
        showFeedback("error", res.error);
      } else {
        const destName = departments.find((d) => d.id === targetTransferDeptId)?.name || "General / Unassigned";
        showFeedback("success", `${transferEmployee.name} moved to ${destName}!`);
        setTransferEmployee(null);
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Toast Notification */}
      {feedback && (
        <div
          className={`flex items-center justify-between rounded-xl p-3 text-xs font-medium border ${
            feedback.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-red-50 border-red-200 text-red-800"
          } transition-all animate-fadeIn`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            <span>{feedback.text}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Header & Overview Stats */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
              <Building2 size={16} />
            </div>
            <h2 className="text-base font-bold text-slate-900">Departments &amp; Teams</h2>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            Organize company structure, view team rosters, and manage department assignments.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-2 text-xs">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">
              {departments.length} Departments
            </span>
            <span className="rounded-full bg-blue-50 px-2.5 py-1 font-medium text-blue-700">
              {totalAssignedCount} Assigned
            </span>
            {unassignedEmployees.length > 0 && (
              <span className="rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-700">
                {unassignedEmployees.length} Unassigned
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
          >
            <Plus size={14} />
            New Department
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search departments, members, or roles..."
            className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Department Cards List */}
      <div className="space-y-3">
        {filteredDepartments.map((dept) => {
          const deptEmployees = employeesByDept.get(dept.id) || [];
          const activeEmpsCount = deptEmployees.filter((e) => e.active).length;
          const deptRoles = rolesByDept.get(dept.id) || [];
          const isExpanded = expandedDeptIds.has(dept.id);

          return (
            <div
              key={dept.id}
              className={`rounded-xl border transition-all ${
                isExpanded ? "border-blue-200 bg-blue-50/20 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              {/* Department Card Header */}
              <div className="p-3.5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div
                  className="flex items-center gap-3 cursor-pointer select-none flex-1 min-w-0"
                  onClick={() => toggleDeptExpand(dept.id)}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 font-bold">
                    {dept.name.slice(0, 2).toUpperCase()}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900 truncate">{dept.name}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                        {deptEmployees.length} {deptEmployees.length === 1 ? "member" : "members"}
                        {activeEmpsCount !== deptEmployees.length && ` (${activeEmpsCount} active)`}
                      </span>
                    </div>

                    {/* Roles summary chips */}
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      {deptRoles.length > 0 ? (
                        deptRoles.slice(0, 3).map((r) => (
                          <span
                            key={r.id}
                            className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600"
                          >
                            {r.title}
                          </span>
                        ))
                      ) : (
                        <span className="text-[10px] text-slate-400">No designated roles</span>
                      )}
                      {deptRoles.length > 3 && (
                        <span className="text-[10px] text-slate-400">+{deptRoles.length - 3} more</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right side: Member preview stack + Actions */}
                <div className="flex items-center justify-between sm:justify-end gap-2 border-t border-slate-100 pt-2 sm:border-t-0 sm:pt-0">
                  {/* Member avatars preview */}
                  <div className="flex -space-x-1.5 overflow-hidden pr-2">
                    {deptEmployees.slice(0, 4).map((e) => (
                      <Avatar key={e.id} name={e.name} url={e.avatarUrl} size={24} />
                    ))}
                    {deptEmployees.length > 4 && (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-[9px] font-bold text-slate-600 ring-2 ring-white">
                        +{deptEmployees.length - 4}
                      </div>
                    )}
                  </div>

                  {/* Add Member button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeptToAddMembers(dept);
                      setSelectedEmpIdsToAdd([]);
                    }}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-blue-600"
                    title="Add members to department"
                  >
                    <UserPlus size={13} />
                    <span className="hidden sm:inline">Add</span>
                  </button>

                  {/* Rename button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeptToEdit(dept);
                      setEditDeptName(dept.name);
                    }}
                    className="rounded-md border border-slate-200 bg-white p-1 text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                    title="Rename department"
                  >
                    <Edit2 size={13} />
                  </button>

                  {/* Delete button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeptToDelete(dept);
                    }}
                    className="rounded-md border border-slate-200 bg-white p-1 text-slate-500 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                    title="Delete department"
                  >
                    <Trash2 size={13} />
                  </button>

                  {/* Expand / Collapse Button */}
                  <button
                    type="button"
                    onClick={() => toggleDeptExpand(dept.id)}
                    className="flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
                  >
                    <span>{isExpanded ? "Hide" : "View"} ({deptEmployees.length})</span>
                    {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>
                </div>
              </div>

              {/* Expanded Department Members List */}
              {isExpanded && (
                <div className="border-t border-slate-200 bg-white p-3.5 space-y-3 rounded-b-xl">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Users size={13} />
                      <span>Department Members ({deptEmployees.length})</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setDeptToAddMembers(dept);
                        setSelectedEmpIdsToAdd([]);
                      }}
                      className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <UserPlus size={12} /> Assign more people
                    </button>
                  </div>

                  {deptEmployees.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
                      No members are currently assigned to this department.
                      <button
                        type="button"
                        onClick={() => {
                          setDeptToAddMembers(dept);
                          setSelectedEmpIdsToAdd([]);
                        }}
                        className="mt-2 block mx-auto text-blue-600 font-semibold hover:underline"
                      >
                        + Assign employee
                      </button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-slate-100">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                          <tr>
                            <th className="px-3 py-2">Member</th>
                            <th className="px-3 py-2">Role &amp; Position</th>
                            <th className="px-3 py-2">Reports To</th>
                            <th className="px-3 py-2">Access</th>
                            <th className="px-3 py-2">Status</th>
                            <th className="px-3 py-2 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {deptEmployees.map((emp) => (
                            <tr key={emp.id} className={`hover:bg-slate-50/70 ${!emp.active ? "opacity-60" : ""}`}>
                              {/* Member info */}
                              <td className="px-3 py-2.5">
                                <div className="flex items-center gap-2.5">
                                  <Avatar name={emp.name} url={emp.avatarUrl} size={28} />
                                  <div>
                                    <div className="font-semibold text-slate-900">{emp.name}</div>
                                    <div className="text-[11px] text-slate-400">{emp.email}</div>
                                  </div>
                                </div>
                              </td>

                              {/* Role */}
                              <td className="px-3 py-2.5">
                                <span className="font-medium text-slate-700">
                                  {emp.role?.title || "Unassigned Position"}
                                </span>
                              </td>

                              {/* Manager */}
                              <td className="px-3 py-2.5 text-slate-600">
                                {emp.reportsToName ? (
                                  <span>{emp.reportsToName}</span>
                                ) : emp.reportsToId ? (
                                  <span>{employees.find((m) => m.id === emp.reportsToId)?.name || "Manager"}</span>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>

                              {/* Access */}
                              <td className="px-3 py-2.5">
                                <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                                  {emp.systemRole}
                                </span>
                              </td>

                              {/* Active status */}
                              <td className="px-3 py-2.5">
                                <span
                                  className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                    emp.active
                                      ? "bg-emerald-100 text-emerald-800"
                                      : "bg-slate-100 text-slate-600"
                                  }`}
                                >
                                  {emp.active ? "Active" : "Inactive"}
                                </span>
                              </td>

                              {/* Actions */}
                              <td className="px-3 py-2.5 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {/* Edit Employee Dialog Trigger */}
                                  <button
                                    type="button"
                                    onClick={() => setEmployeeToEdit(emp)}
                                    className="rounded border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100"
                                    title="Edit employee details"
                                  >
                                    Edit
                                  </button>

                                  {/* Quick Transfer Department */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setTransferEmployee(emp);
                                      setTargetTransferDeptId(emp.resolvedDeptId || "");
                                    }}
                                    className="rounded border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100 hover:text-blue-600"
                                    title="Transfer to another department"
                                  >
                                    Transfer
                                  </button>

                                  {/* Remove from Department */}
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveMemberFromDept(emp)}
                                    className="rounded border border-slate-200 p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                                    title="Remove from this department"
                                  >
                                    <UserMinus size={12} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {filteredDepartments.length === 0 && departments.length > 0 && (
          <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400">
            No departments match &ldquo;{searchQuery}&rdquo;.
          </div>
        )}

        {/* Unassigned / General Section (if any unassigned employees exist) */}
        {unassignedEmployees.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/30 p-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-800 font-bold text-xs">
                  GEN
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    General / Unassigned Members ({unassignedEmployees.length})
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    These employees are not yet assigned to a specific department.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex -space-x-1.5 overflow-hidden">
                  {unassignedEmployees.slice(0, 4).map((e) => (
                    <Avatar key={e.id} name={e.name} url={e.avatarUrl} size={24} />
                  ))}
                  {unassignedEmployees.length > 4 && (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-[9px] font-bold text-slate-600 ring-2 ring-white">
                      +{unassignedEmployees.length - 4}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => toggleDeptExpand("unassigned")}
                  className="rounded-md bg-white border border-amber-200 px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-50"
                >
                  {expandedDeptIds.has("unassigned") ? "Hide List" : "View & Assign"}
                </button>
              </div>
            </div>

            {/* Unassigned list expanded */}
            {expandedDeptIds.has("unassigned") && (
              <div className="mt-3 overflow-x-auto rounded-lg border border-amber-200 bg-white p-2">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase">
                    <tr>
                      <th className="px-3 py-2">Employee</th>
                      <th className="px-3 py-2">Role</th>
                      <th className="px-3 py-2">Access</th>
                      <th className="px-3 py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {unassignedEmployees.map((emp) => (
                      <tr key={emp.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <Avatar name={emp.name} url={emp.avatarUrl} size={24} />
                            <div>
                              <span className="font-semibold text-slate-800">{emp.name}</span>
                              <span className="block text-[10px] text-slate-400">{emp.email}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-slate-600">{emp.role?.title || "—"}</td>
                        <td className="px-3 py-2">
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
                            {emp.systemRole}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setTransferEmployee(emp);
                              setTargetTransferDeptId(departments[0]?.id || "");
                            }}
                            className="rounded-md bg-blue-50 border border-blue-200 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                          >
                            + Assign Department
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── MODAL 1: Create New Department ─────────────────────────────────── */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl animate-scale">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                  <Building2 size={16} />
                </div>
                <h3 className="text-sm font-bold text-slate-900">Create New Department</h3>
              </div>
              <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateDepartment} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Department Name</label>
                <input
                  type="text"
                  required
                  value={newDeptName}
                  onChange={(e) => setNewDeptName(e.target.value)}
                  placeholder="e.g. Engineering, Sales, Human Resources"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  autoFocus
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || !newDeptName.trim()}
                  className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {isPending ? "Creating..." : "Create Department"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 2: Rename Department ─────────────────────────────────────── */}
      {deptToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl animate-scale">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Rename Department</h3>
              <button onClick={() => setDeptToEdit(null)} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleUpdateDepartment} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Department Name</label>
                <input
                  type="text"
                  required
                  value={editDeptName}
                  onChange={(e) => setEditDeptName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                  autoFocus
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDeptToEdit(null)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || !editDeptName.trim()}
                  className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {isPending ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 3: Delete Department Confirmation ────────────────────────── */}
      {deptToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl animate-scale">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 text-red-600">
                <AlertTriangle size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Delete Department</h3>
                <p className="text-xs text-slate-500">{deptToDelete.name}</p>
              </div>
            </div>

            <div className="mt-3 space-y-2 text-xs text-slate-600">
              <p>
                Are you sure you want to delete <strong>&ldquo;{deptToDelete.name}&rdquo;</strong>?
              </p>
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-amber-800 text-[11px]">
                <strong>Notice:</strong> All members and roles currently in this department will remain safe and be moved to{" "}
                <strong>General / Unassigned</strong>.
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setDeptToDelete(null)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteDepartment}
                disabled={isPending}
                className="rounded-lg bg-red-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isPending ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 4: Add / Assign Members to Department ────────────────────── */}
      {deptToAddMembers && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-xl animate-scale">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Add Members to {deptToAddMembers.name}
                </h3>
                <p className="text-xs text-slate-500">
                  Select employees to assign to this department.
                </p>
              </div>
              <button onClick={() => setDeptToAddMembers(null)} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>

            <div className="mt-3 max-h-72 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-lg">
              {employees.map((emp) => {
                const isCurrentDept = emp.departmentId === deptToAddMembers.id || emp.role?.departmentId === deptToAddMembers.id;
                const isSelected = selectedEmpIdsToAdd.includes(emp.id);

                return (
                  <label
                    key={emp.id}
                    className={`flex items-center justify-between p-2.5 text-xs cursor-pointer hover:bg-slate-50 ${
                      isCurrentDept ? "bg-slate-50/50 opacity-60 cursor-not-allowed" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        disabled={isCurrentDept}
                        checked={isSelected || isCurrentDept}
                        onChange={(e) => {
                          if (isCurrentDept) return;
                          if (e.target.checked) {
                            setSelectedEmpIdsToAdd((prev) => [...prev, emp.id]);
                          } else {
                            setSelectedEmpIdsToAdd((prev) => prev.filter((id) => id !== emp.id));
                          }
                        }}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <Avatar name={emp.name} url={emp.avatarUrl} size={24} />
                      <div>
                        <span className="font-semibold text-slate-800">{emp.name}</span>
                        <span className="block text-[10px] text-slate-400">
                          {emp.role?.title || "No Role"} {emp.departmentId ? `• in other dept` : `• unassigned`}
                        </span>
                      </div>
                    </div>

                    {isCurrentDept && (
                      <span className="text-[10px] font-medium text-emerald-600">Already in department</span>
                    )}
                  </label>
                );
              })}
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="text-xs text-slate-500">
                {selectedEmpIdsToAdd.length} employee(s) selected
              </span>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDeptToAddMembers(null)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isPending || selectedEmpIdsToAdd.length === 0}
                  onClick={handleAddMembersToDept}
                  className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {isPending ? "Assigning..." : `Assign to ${deptToAddMembers.name}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 5: Quick Transfer Employee Department ─────────────────────── */}
      {transferEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl animate-scale">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ArrowRightLeft size={16} className="text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Transfer Department: {transferEmployee.name}
                </h3>
              </div>
              <button onClick={() => setTransferEmployee(null)} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Select Destination Department</label>
                <select
                  value={targetTransferDeptId}
                  onChange={(e) => setTargetTransferDeptId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                >
                  <option value="">General / Unassigned</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setTransferEmployee(null)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleTransferEmployee}
                disabled={isPending}
                className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isPending ? "Transferring..." : "Confirm Transfer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 6: Full Edit Employee in Department ──────────────────────── */}
      {employeeToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-xl animate-scale">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                Edit Employee: {employeeToEdit.name}
              </h3>
              <button onClick={() => setEmployeeToEdit(null)} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>

            <form
              action={async (fd) => {
                startTransition(async () => {
                  const res = await updateEmployee(fd);
                  if (res?.error) {
                    showFeedback("error", res.error);
                  } else {
                    showFeedback("success", `Updated details for ${employeeToEdit.name}!`);
                    setEmployeeToEdit(null);
                  }
                });
              }}
              className="mt-4 grid gap-3 sm:grid-cols-2"
            >
              <input type="hidden" name="id" value={employeeToEdit.id} />

              <label className="text-xs font-semibold text-slate-700 sm:col-span-2">
                Full Name
                <input
                  name="name"
                  required
                  defaultValue={employeeToEdit.name}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </label>

              <label className="text-xs font-semibold text-slate-700 sm:col-span-2">
                Email
                <input
                  name="email"
                  type="email"
                  required
                  defaultValue={employeeToEdit.email}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </label>

              <label className="text-xs font-semibold text-slate-700">
                Role / Position
                <select
                  name="roleId"
                  required
                  defaultValue={employeeToEdit.roleId}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-xs font-semibold text-slate-700">
                System Access
                <select
                  name="systemRole"
                  defaultValue={employeeToEdit.systemRole}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                >
                  {systemRoles.map((sr) => (
                    <option key={sr.id} value={sr.name}>
                      {sr.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-xs font-semibold text-slate-700 sm:col-span-2">
                Reporting Manager
                <select
                  name="reportsToIds"
                  defaultValue={employeeToEdit.reportsToId || ""}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                >
                  <option value="">None (Top-Level / CEO)</option>
                  {managers
                    .filter((m) => m.id !== employeeToEdit.id)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                </select>
              </label>

              <div className="flex justify-end gap-2 sm:col-span-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEmployeeToEdit(null)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {isPending ? "Saving..." : "Save Employee"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
