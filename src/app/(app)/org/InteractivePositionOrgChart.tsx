"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  GripVertical,
  Move,
  UserCheck,
  AlertCircle,
  Check,
  RefreshCw,
  Building2,
  Search,
  SlidersHorizontal,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Shield,
  Briefcase,
  Layers,
  Crown,
  Image as ImageIcon,
  Edit3,
} from "lucide-react";
import {
  updateEmployeeRole,
  reassignReportingLine,
  updateRoleDepartment,
  updateEmployeeHierarchy,
} from "@/lib/actions/admin";
import Avatar from "../_components/Avatar";

export type RoleOption = {
  id: string;
  title: string;
  departmentId: string | null;
  level?: number;
};

export type DeptOption = {
  id: string;
  name: string;
};

export type PositionPerson = {
  id: string;
  name: string;
  email?: string;
  roleId: string;
  roleTitle: string;
  level?: number;
  depth?: number;
  systemRole?: string;
  reportsToId: string | null;
  reportsToName?: string | null;
  departmentId: string | null;
  departmentName?: string | null;
  avatarUrl?: string | null;
};

export type PositionDept = {
  id: string;
  name: string;
  people: PositionPerson[];
};

export type PositionOrgData = {
  root: PositionPerson | null;
  leadership: PositionPerson[];
  departments: PositionDept[];
  allDepartments: DeptOption[];
  roles: RoleOption[];
  allEmployees: PositionPerson[];
};

type DeptTreeNode = PositionPerson & {
  children: DeptTreeNode[];
};

// Calculate accurate hierarchy badge based on reporting depth, level, and role title
function getHierarchyBadge(depth?: number, level?: number, roleTitle?: string, systemRole?: string) {
  const title = (roleTitle || "").toLowerCase();

  // L0: Director / CEO
  if (title.includes("ceo") || title.includes("director") || depth === 0) {
    return { label: "Director / CEO", color: "bg-amber-100 text-amber-800 border-amber-300", tier: "L0", isLeader: true };
  }
  // L1: COO / Executive
  if (title.includes("coo") || (depth === 1 && !title.includes("gm") && !title.includes("manager"))) {
    return { label: "COO / Executive", color: "bg-purple-100 text-purple-800 border-purple-300", tier: "L1", isLeader: true };
  }
  // L2: General Manager (GM)
  if (title.includes("gm") || title.includes("general manager")) {
    return { label: "General Manager", color: "bg-indigo-100 text-indigo-800 border-indigo-300", tier: "L2", isLeader: true };
  }
  // L3: Department Heads & Managers (e.g. HR Manager, Accounts Manager, Purchase Manager, Operations Manager, Design Manager)
  if (title.includes("manager") || title.includes("head") || systemRole === "MANAGER") {
    return { label: "HOD / Manager", color: "bg-blue-100 text-blue-800 border-blue-300", tier: "L3", isHOD: true };
  }
  // L4: Engineers / Officers / Accountants / Team Members
  if (title.includes("engineer") || title.includes("officer") || title.includes("accountant") || title.includes("social media") || title.includes("executive")) {
    return { label: "Team Member / Exec", color: "bg-emerald-100 text-emerald-800 border-emerald-300", tier: "L4" };
  }
  // L5: Assistants / Interns / Field Staff
  return { label: "Assistant / Intern", color: "bg-slate-100 text-slate-700 border-slate-200", tier: "L5" };
}

// Build department hierarchical tree where subordinates nest under their manager
function buildDeptTree(people: PositionPerson[]): DeptTreeNode[] {
  const peopleMap = new Map<string, PositionPerson>();
  people.forEach((p) => peopleMap.set(p.id, p));

  const childrenMap = new Map<string, PositionPerson[]>();
  const roots: PositionPerson[] = [];

  people.forEach((p) => {
    // If their manager is also in this department, group under that manager
    if (p.reportsToId && peopleMap.has(p.reportsToId)) {
      const arr = childrenMap.get(p.reportsToId) ?? [];
      arr.push(p);
      childrenMap.set(p.reportsToId, arr);
    } else {
      // Top-level root for this department (e.g. HOD reporting to COO/CEO/GM)
      roots.push(p);
    }
  });

  // Sort roots by depth (L2 before L3)
  roots.sort((a, b) => (a.depth ?? 50) - (b.depth ?? 50) || (a.level ?? 50) - (b.level ?? 50));

  function populate(person: PositionPerson): DeptTreeNode {
    const children = (childrenMap.get(person.id) ?? []).sort(
      (a, b) => (a.depth ?? 50) - (b.depth ?? 50) || (a.level ?? 50) - (b.level ?? 50)
    );
    return {
      ...person,
      children: children.map(populate),
    };
  }

  return roots.map(populate);
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

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTierFilter, setSelectedTierFilter] = useState<string>("ALL");
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>("ALL");
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  // Edit form states for modal
  const [editRoleId, setEditRoleId] = useState("");
  const [editCustomRole, setEditCustomRole] = useState("");
  const [editTier, setEditTier] = useState("L3");
  const [editLevel, setEditLevel] = useState<number>(30);
  const [editDeptId, setEditDeptId] = useState("");
  const [editReportsToId, setEditReportsToId] = useState<string>("");
  const [editSystemRole, setEditSystemRole] = useState("EMPLOYEE");
  const [editAvatarUrl, setEditAvatarUrl] = useState("");

  // Helper to find person across data
  function findPerson(id: string): PositionPerson | null {
    if (data.root?.id === id) return data.root;
    for (const p of data.leadership) {
      if (p.id === id) return p;
    }
    for (const d of data.departments) {
      const p = d.people.find((person) => person.id === id);
      if (p) return p;
    }
    return data.allEmployees?.find((e) => e.id === id) || null;
  }

  // Open edit modal with current person's values
  function openEditModal(person: PositionPerson) {
    if (!canEdit) return;
    setSelectedPerson(person);
    setEditRoleId(person.roleId || "");
    setEditCustomRole("");
    const badge = getHierarchyBadge(person.depth, person.level, person.roleTitle, person.systemRole);
    setEditTier(badge.tier);
    setEditLevel(person.level ?? 30);
    setEditDeptId(person.departmentId || "");
    setEditReportsToId(person.reportsToId || "");
    setEditSystemRole(person.systemRole || "EMPLOYEE");
    setEditAvatarUrl(person.avatarUrl || "");
  }

  // Save full employee hierarchy
  async function handleSaveHierarchy() {
    if (!selectedPerson) return;
    const personId = selectedPerson.id;

    const targetRole = data.roles.find((r) => r.id === editRoleId);
    const effectiveRoleTitle = editCustomRole.trim() || targetRole?.title || selectedPerson.roleTitle;
    const targetDept = data.allDepartments.find((d) => d.id === editDeptId);
    const targetManager = data.allEmployees.find((e) => e.id === editReportsToId);

    // Optimistic UI update
    setData((prev) => {
      const updatedPerson: PositionPerson = {
        ...selectedPerson,
        roleId: editRoleId || selectedPerson.roleId,
        roleTitle: effectiveRoleTitle,
        level: editLevel,
        departmentId: editDeptId || selectedPerson.departmentId,
        departmentName: targetDept?.name || selectedPerson.departmentName,
        reportsToId: editReportsToId || null,
        reportsToName: targetManager?.name || null,
        systemRole: editSystemRole,
        avatarUrl: editAvatarUrl || selectedPerson.avatarUrl,
      };

      const updatedAllEmployees = prev.allEmployees.map((e) =>
        e.id === personId ? updatedPerson : e
      );

      let updatedRoot = prev.root?.id === personId ? updatedPerson : prev.root;
      let updatedLeadership = prev.leadership.map((l) => (l.id === personId ? updatedPerson : l));

      const updatedDepts = prev.departments.map((dept) => {
        const filtered = dept.people.filter((p) => p.id !== personId);
        if (dept.id === editDeptId) {
          return {
            ...dept,
            people: [...filtered, updatedPerson].sort((a, b) => (a.depth ?? 50) - (b.depth ?? 50)),
          };
        }
        return { ...dept, people: filtered };
      });

      return {
        ...prev,
        root: updatedRoot,
        leadership: updatedLeadership,
        departments: updatedDepts,
        allEmployees: updatedAllEmployees,
      };
    });

    const targetName = selectedPerson.name;
    setSelectedPerson(null);
    setStatusMsg(null);

    startTransition(async () => {
      const res = await updateEmployeeHierarchy({
        employeeId: personId,
        roleId: editRoleId || undefined,
        customRoleTitle: editCustomRole.trim() || undefined,
        level: editLevel,
        departmentId: editDeptId || undefined,
        reportsToId: editReportsToId === "" ? null : editReportsToId,
        systemRole: editSystemRole,
        avatarUrl: editAvatarUrl || null,
      });

      if (res?.error) {
        setData(initialData);
        setStatusMsg({ type: "error", text: res.error });
      } else {
        setStatusMsg({
          type: "success",
          text: `Updated position, hierarchy level (${editTier}) and reporting line for ${targetName}.`,
        });
        router.refresh();
      }
    });
  }

  // Handle drag & drop department transfer
  async function handleDepartmentTransfer(personId: string, newDeptId: string) {
    const person = findPerson(personId);
    if (!person) return;

    const targetDept = data.allDepartments.find((d) => d.id === newDeptId);
    if (!targetDept) return;

    // Optimistic UI update
    setData((prev) => {
      const updatedPerson = {
        ...person,
        departmentId: newDeptId,
        departmentName: targetDept.name,
      };

      const updatedDepts = prev.departments.map((dept) => {
        const filteredPeople = dept.people.filter((p) => p.id !== personId);
        if (dept.id === newDeptId) {
          return {
            ...dept,
            people: [...filteredPeople, updatedPerson].sort((a, b) => (a.depth ?? 50) - (b.depth ?? 50)),
          };
        }
        return { ...dept, people: filteredPeople };
      });

      return { ...prev, departments: updatedDepts };
    });

    setStatusMsg(null);
    startTransition(async () => {
      let res;
      if (person.roleId) {
        res = await updateRoleDepartment(person.roleId, newDeptId);
      } else {
        res = await updateEmployeeHierarchy({ employeeId: personId, departmentId: newDeptId });
      }

      if (res?.error) {
        setData(initialData);
        setStatusMsg({ type: "error", text: res.error });
      } else {
        setStatusMsg({
          type: "success",
          text: `Transferred ${person.name} to ${targetDept.name}.`,
        });
        router.refresh();
      }
    });
  }

  // Filtered view logic
  const filteredDepartments = useMemo(() => {
    return data.departments
      .filter((dept) => {
        if (selectedDeptFilter !== "ALL" && dept.id !== selectedDeptFilter) return false;
        return true;
      })
      .map((dept) => {
        const people = dept.people.filter((person) => {
          if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            const matchesName = person.name.toLowerCase().includes(q);
            const matchesRole = person.roleTitle.toLowerCase().includes(q);
            const matchesDept = (person.departmentName || dept.name).toLowerCase().includes(q);
            if (!matchesName && !matchesRole && !matchesDept) return false;
          }

          if (selectedTierFilter !== "ALL") {
            const badge = getHierarchyBadge(person.depth, person.level, person.roleTitle, person.systemRole);
            if (badge.tier !== selectedTierFilter) return false;
          }

          return true;
        });

        return { ...dept, people };
      })
      .filter((dept) => selectedDeptFilter !== "ALL" || dept.people.length > 0);
  }, [data.departments, selectedDeptFilter, selectedTierFilter, searchQuery]);

  return (
    <div className="space-y-5">
      {/* Top Filter & Hierarchy Selector Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 sm:flex-row sm:items-center sm:justify-between shadow-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Input */}
          <div className="relative min-w-[200px] flex-1 sm:w-64 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              type="text"
              placeholder="Search name, position..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-9 pr-3 text-xs text-slate-800 placeholder-slate-400 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            )}
          </div>

          {/* Hierarchy Tier Selector */}
          <div className="flex items-center gap-1.5">
            <Layers size={14} className="text-blue-600 shrink-0" />
            <select
              value={selectedTierFilter}
              onChange={(e) => setSelectedTierFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none transition focus:border-blue-500"
            >
              <option value="ALL">All Hierarchy Levels</option>
              <option value="L0">Level 0 • Director / CEO</option>
              <option value="L1">Level 1 • COO / Executive</option>
              <option value="L2">Level 2 • General Manager (GM)</option>
              <option value="L3">Level 3 • HOD / Department Manager</option>
              <option value="L4">Level 4 • Team Member / Exec</option>
              <option value="L5">Level 5 • Assistant / Intern</option>
            </select>
          </div>

          {/* Department Filter */}
          <div className="flex items-center gap-1.5">
            <Building2 size={14} className="text-blue-600 shrink-0" />
            <select
              value={selectedDeptFilter}
              onChange={(e) => setSelectedDeptFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none transition focus:border-blue-500"
            >
              <option value="ALL">All Departments ({data.departments.length})</option>
              {data.allDepartments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Zoom & View Scale Controls */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <div className="flex items-center rounded-xl border border-slate-200 bg-white p-1 text-xs">
            <button
              onClick={() => setZoomLevel((z) => Math.max(70, z - 10))}
              title="Zoom out"
              className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            >
              <ZoomOut size={14} />
            </button>
            <span className="w-12 text-center font-semibold text-slate-600">{zoomLevel}%</span>
            <button
              onClick={() => setZoomLevel((z) => Math.min(130, z + 10))}
              title="Zoom in"
              className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            >
              <ZoomIn size={14} />
            </button>
            {zoomLevel !== 100 && (
              <button
                onClick={() => setZoomLevel(100)}
                title="Reset zoom"
                className="ml-1 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <RotateCcw size={12} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Editing Instructions Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50/70 p-3.5 text-xs text-blue-900">
        <div className="flex items-center gap-2">
          <Move className="text-blue-600 shrink-0" size={16} />
          <span>
            {canEdit ? (
              <>
                <strong>Interactive Org Structure:</strong> Click any employee card or badge to change their{" "}
                <strong className="text-blue-950 underline">position title, L-level tier (L0-L5), department or reporting manager</strong> directly from here.
              </>
            ) : (
              <>Full company organizational hierarchy and departmental structure.</>
            )}
          </span>
        </div>
        {isPending && (
          <div className="flex items-center gap-1.5 font-semibold text-blue-700">
            <RefreshCw size={13} className="animate-spin" /> Saving changes...
          </div>
        )}
      </div>

      {/* Status Notification Toast */}
      {statusMsg && (
        <div
          className={`flex items-center gap-2 rounded-xl p-3 text-xs font-semibold ${
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

      {/* Main Org Tree in Classic Box & Connector Format */}
      <div
        className="overflow-x-auto pb-8 pt-2 transition-transform duration-200 origin-top"
        style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: "top center" }}
      >
        {data.root && (
          <ul className="org-tree min-w-max">
            <li>
              {/* Level 0: Top Leader / CEO Card */}
              <div
                onClick={() => openEditModal(data.root!)}
                className="group relative inline-block cursor-pointer whitespace-nowrap rounded-2xl border-2 border-blue-400/90 bg-gradient-to-b from-white to-blue-50/40 p-4 shadow-md transition-all hover:border-blue-600 hover:shadow-lg hover:-translate-y-0.5"
              >
                <div className="flex items-center gap-3.5">
                  <Avatar
                    name={data.root.name}
                    url={data.root.avatarUrl}
                    size={46}
                    className="ring-2 ring-blue-500 shadow-xs"
                  />
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-extrabold uppercase tracking-wide text-slate-900">
                        {data.root.name}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-300">
                        <Crown size={10} className="text-amber-600" /> Level 0
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-blue-700">{data.root.roleTitle}</div>
                    <div className="text-[10px] text-slate-500 font-medium">Head of Organization</div>
                  </div>
                </div>
                {canEdit && (
                  <div className="absolute -top-2 -right-2 hidden rounded-full bg-blue-600 p-1 text-white shadow-md group-hover:block">
                    <SlidersHorizontal size={11} />
                  </div>
                )}
              </div>

              {/* Render Executive Leadership (e.g. COO Cherry) and fan out into parallel Department Columns */}
              {data.leadership.length > 0 ? (
                <ul>
                  {data.leadership.map((exec) => {
                    const badge = getHierarchyBadge(exec.depth, exec.level, exec.roleTitle, exec.systemRole);

                    return (
                      <li key={exec.id}>
                        <div
                          onClick={() => openEditModal(exec)}
                          className="group relative inline-block cursor-pointer whitespace-nowrap rounded-2xl border-2 border-purple-300 bg-white p-3.5 shadow-sm transition-all hover:border-purple-500 hover:shadow-md hover:-translate-y-0.5"
                        >
                          <div className="flex items-center gap-3">
                            <Avatar
                              name={exec.name}
                              url={exec.avatarUrl}
                              size={42}
                              className="ring-2 ring-purple-400"
                            />
                            <div className="text-left">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-slate-900">{exec.name}</span>
                                <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold border ${badge.color}`}>
                                  {badge.tier}
                                </span>
                              </div>
                              <div className="text-xs font-semibold text-purple-700">{exec.roleTitle}</div>
                              <div className="text-[10px] text-slate-400 font-medium">
                                Reports to: {exec.reportsToName || data.root?.name}
                              </div>
                            </div>
                          </div>
                          {canEdit && (
                            <div className="absolute -top-1.5 -right-1.5 hidden rounded-full bg-purple-600 p-1 text-white shadow-xs group-hover:block">
                              <Edit3 size={10} />
                            </div>
                          )}
                        </div>

                        {/* Connected Department Columns in parallel under COO */}
                        {filteredDepartments.length > 0 && (
                          <ul>
                            {filteredDepartments.map((dept) => (
                              <DepartmentBranch
                                key={dept.id}
                                dept={dept}
                                canEdit={canEdit}
                                draggedPersonId={draggedPersonId}
                                dragOverDeptId={dragOverDeptId}
                                dragOverPersonId={dragOverPersonId}
                                setDraggedPersonId={setDraggedPersonId}
                                setDragOverDeptId={setDragOverDeptId}
                                setDragOverPersonId={setDragOverPersonId}
                                handleDepartmentTransfer={handleDepartmentTransfer}
                                openEditModal={openEditModal}
                                rootId={data.root?.id}
                              />
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                /* Directly under root if no COO */
                filteredDepartments.length > 0 && (
                  <ul>
                    {filteredDepartments.map((dept) => (
                      <DepartmentBranch
                        key={dept.id}
                        dept={dept}
                        canEdit={canEdit}
                        draggedPersonId={draggedPersonId}
                        dragOverDeptId={dragOverDeptId}
                        dragOverPersonId={dragOverPersonId}
                        setDraggedPersonId={setDraggedPersonId}
                        setDragOverDeptId={setDragOverDeptId}
                        setDragOverPersonId={setDragOverPersonId}
                        handleDepartmentTransfer={handleDepartmentTransfer}
                        openEditModal={openEditModal}
                        rootId={data.root?.id}
                      />
                    ))}
                  </ul>
                )
              )}
            </li>
          </ul>
        )}
      </div>

      {/* Comprehensive Hierarchy & Position Edit Modal Dialog */}
      {selectedPerson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 space-y-5 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <Avatar
                  name={selectedPerson.name}
                  url={editAvatarUrl || selectedPerson.avatarUrl}
                  size={46}
                  className="ring-2 ring-blue-500"
                />
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    {selectedPerson.name}
                    <span className="rounded bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800 border border-blue-200">
                      {editTier}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">{selectedPerson.roleTitle} • Edit Position & Hierarchy Level</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedPerson(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                ✕
              </button>
            </div>

            {/* Modal Body / Hierarchy Selectors */}
            <div className="space-y-4">
              {/* 1. Interactive L-Position Level Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                  <Layers size={14} className="text-blue-600" /> Hierarchy Level (L-Position)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { tier: "L0", label: "L0 • Director / CEO", level: 0, desc: "Root Leader" },
                    { tier: "L1", label: "L1 • COO / Executive", level: 10, desc: "Executive Tier" },
                    { tier: "L2", label: "L2 • General Manager", level: 20, desc: "GM Leadership" },
                    { tier: "L3", label: "L3 • HOD / Manager", level: 30, desc: "Department Head" },
                    { tier: "L4", label: "L4 • Team Member / Exec", level: 50, desc: "Engineer / Officer" },
                    { tier: "L5", label: "L5 • Assistant / Intern", level: 70, desc: "Support Staff" },
                  ].map((item) => {
                    const isSelected = editTier === item.tier;
                    return (
                      <button
                        key={item.tier}
                        type="button"
                        onClick={() => {
                          setEditTier(item.tier);
                          setEditLevel(item.level);
                        }}
                        className={`flex flex-col rounded-xl border p-2.5 text-left text-xs transition ${
                          isSelected
                            ? "border-blue-600 bg-blue-50 text-blue-900 ring-2 ring-blue-400/40 shadow-xs"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-center justify-between font-bold">
                          <span>{item.label}</span>
                          {isSelected && <Check size={13} className="text-blue-600" />}
                        </div>
                        <span className="text-[10px] text-slate-400 font-normal mt-0.5">{item.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Position / Role Title */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Briefcase size={14} className="text-blue-600" /> Position / Role Title
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <select
                    value={editRoleId}
                    onChange={(e) => {
                      setEditRoleId(e.target.value);
                      const selectedRole = data.roles.find((r) => r.id === e.target.value);
                      if (selectedRole) {
                        const badge = getHierarchyBadge(selectedPerson.depth, selectedRole.level, selectedRole.title, editSystemRole);
                        setEditTier(badge.tier);
                        setEditLevel(selectedRole.level ?? 30);
                      }
                    }}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  >
                    <option value="">Select Existing Role</option>
                    {data.roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title}
                      </option>
                    ))}
                  </select>

                  <input
                    type="text"
                    placeholder="Or type new role title..."
                    value={editCustomRole}
                    onChange={(e) => setEditCustomRole(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              {/* 3. Assigned Department */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Building2 size={14} className="text-blue-600" /> Assigned Department
                </label>
                <select
                  value={editDeptId}
                  onChange={(e) => setEditDeptId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                >
                  <option value="">Select Department</option>
                  {data.allDepartments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 4. Reporting Manager */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <UserCheck size={14} className="text-blue-600" /> Reporting Manager (Hierarchy Anchor)
                </label>
                <select
                  value={editReportsToId}
                  onChange={(e) => setEditReportsToId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                >
                  <option value="">None (Top Leader / Root)</option>
                  {data.allEmployees
                    .filter((emp) => emp.id !== selectedPerson.id)
                    .map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} — {emp.roleTitle} ({emp.departmentName || "General"})
                      </option>
                    ))}
                </select>
              </div>

              {/* 5. System Role & Photo URL */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                    <Shield size={14} className="text-blue-600" /> System Role
                  </label>
                  <select
                    value={editSystemRole}
                    onChange={(e) => setEditSystemRole(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  >
                    <option value="EMPLOYEE">EMPLOYEE</option>
                    <option value="MANAGER">MANAGER (HOD)</option>
                    <option value="CEO">CEO / EXECUTIVE</option>
                    <option value="ADMIN">ADMIN</option>
                    <option value="TECHNICIAN">FIELD TECHNICIAN</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                    <ImageIcon size={14} className="text-blue-600" /> Photo / Avatar URL
                  </label>
                  <input
                    type="text"
                    placeholder="https://... photo URL"
                    value={editAvatarUrl}
                    onChange={(e) => setEditAvatarUrl(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedPerson(null)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveHierarchy}
                disabled={isPending}
                className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition disabled:opacity-50"
              >
                {isPending && <RefreshCw size={13} className="animate-spin" />}
                Save Position & Level
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Subcomponent for each department column branch in the tree
 */
function DepartmentBranch({
  dept,
  canEdit,
  draggedPersonId,
  dragOverDeptId,
  dragOverPersonId,
  setDraggedPersonId,
  setDragOverDeptId,
  setDragOverPersonId,
  handleDepartmentTransfer,
  openEditModal,
  rootId,
}: {
  dept: PositionDept;
  canEdit: boolean;
  draggedPersonId: string | null;
  dragOverDeptId: string | null;
  dragOverPersonId: string | null;
  setDraggedPersonId: (id: string | null) => void;
  setDragOverDeptId: (id: string | null) => void;
  setDragOverPersonId: (id: string | null) => void;
  handleDepartmentTransfer: (personId: string, newDeptId: string) => void;
  openEditModal: (person: PositionPerson) => void;
  rootId?: string;
}) {
  const isDeptTarget = dragOverDeptId === dept.id;
  const deptTree = useMemo(() => buildDeptTree(dept.people), [dept.people]);

  return (
    <li>
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
            handleDepartmentTransfer(draggedPersonId, dept.id);
          }
        }}
        className={`whitespace-nowrap rounded-2xl border-2 px-5 py-2.5 shadow-sm transition-all ${
          isDeptTarget
            ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-400 text-emerald-800 scale-105"
            : "border-blue-300 bg-gradient-to-b from-blue-50/50 to-white text-blue-900"
        }`}
      >
        <div className="flex items-center gap-2 font-bold capitalize text-xs sm:text-sm">
          <Building2 size={15} className="text-blue-600" />
          <span>{dept.name}</span>
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
            {dept.people.length}
          </span>
        </div>
      </div>

      {/* Hierarchical tree inside department: L3 Manager on top -> L4 subordinates connected below */}
      {deptTree.length > 0 && (
        <ul>
          {deptTree.map((node) => (
            <DeptPersonTreeNode
              key={node.id}
              node={node}
              canEdit={canEdit}
              draggedPersonId={draggedPersonId}
              dragOverDeptId={dragOverDeptId}
              dragOverPersonId={dragOverPersonId}
              setDraggedPersonId={setDraggedPersonId}
              setDragOverDeptId={setDragOverDeptId}
              setDragOverPersonId={setDragOverPersonId}
              handleDepartmentTransfer={handleDepartmentTransfer}
              openEditModal={openEditModal}
              rootId={rootId}
              deptId={dept.id}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/**
 * Recursive tree node rendering person and connecting their subordinates underneath
 */
function DeptPersonTreeNode({
  node,
  canEdit,
  draggedPersonId,
  dragOverDeptId,
  dragOverPersonId,
  setDraggedPersonId,
  setDragOverDeptId,
  setDragOverPersonId,
  handleDepartmentTransfer,
  openEditModal,
  rootId,
  deptId,
}: {
  node: DeptTreeNode;
  canEdit: boolean;
  draggedPersonId: string | null;
  dragOverDeptId: string | null;
  dragOverPersonId: string | null;
  setDraggedPersonId: (id: string | null) => void;
  setDragOverDeptId: (id: string | null) => void;
  setDragOverPersonId: (id: string | null) => void;
  handleDepartmentTransfer: (personId: string, newDeptId: string) => void;
  openEditModal: (person: PositionPerson) => void;
  rootId?: string;
  deptId: string;
}) {
  const isDragged = draggedPersonId === node.id;
  const isPersonTarget = dragOverPersonId === node.id && draggedPersonId !== node.id;
  const badge = getHierarchyBadge(node.depth, node.level, node.roleTitle, node.systemRole);

  return (
    <li>
      <div
        draggable={canEdit && node.id !== rootId}
        onDragStart={(e) => {
          if (!canEdit || node.id === rootId) return;
          setDraggedPersonId(node.id);
          e.dataTransfer.setData("text/plain", node.id);
        }}
        onDragEnd={() => {
          setDraggedPersonId(null);
          setDragOverDeptId(null);
          setDragOverPersonId(null);
        }}
        onDragOver={(e) => {
          if (!canEdit || !draggedPersonId || draggedPersonId === node.id) return;
          e.preventDefault();
          setDragOverPersonId(node.id);
        }}
        onDragLeave={() => setDragOverPersonId(null)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOverPersonId(null);
          if (draggedPersonId && draggedPersonId !== node.id) {
            handleDepartmentTransfer(draggedPersonId, deptId);
          }
        }}
        onClick={() => openEditModal(node)}
        className={`group relative flex cursor-pointer items-center justify-between gap-3 whitespace-nowrap rounded-2xl border-2 bg-white px-3.5 py-2.5 shadow-xs transition-all ${
          isDragged
            ? "opacity-50 border-blue-400 ring-2 ring-blue-300 scale-95"
            : isPersonTarget
            ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-400 shadow-md"
            : badge.isHOD
            ? "border-blue-300/90 bg-gradient-to-b from-blue-50/40 to-white hover:border-blue-500 hover:shadow-md hover:-translate-y-0.5"
            : "border-slate-200 hover:border-blue-400 hover:shadow-md hover:-translate-y-0.5"
        }`}
      >
        <div className="flex items-center gap-2.5">
          {canEdit && node.id !== rootId && (
            <GripVertical
              size={14}
              className="text-slate-300 group-hover:text-slate-500 cursor-grab shrink-0"
            />
          )}
          {/* Employee Avatar / Photo */}
          <Avatar
            name={node.name}
            url={node.avatarUrl}
            size={34}
            className="ring-1 ring-slate-200 shrink-0"
          />
          <div className="text-left">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-900">{node.name}</span>
              <span className={`rounded px-1.5 py-0.2 text-[9px] font-bold border ${badge.color}`}>
                {badge.tier}
              </span>
            </div>
            <div className="text-[11px] font-medium text-blue-700">{node.roleTitle}</div>
            {node.reportsToName && (
              <div className="text-[9px] text-slate-400">↳ Reports to {node.reportsToName}</div>
            )}
          </div>
        </div>

        {canEdit && (
          <button
            type="button"
            title="Edit Hierarchy & Position"
            className="opacity-0 group-hover:opacity-100 rounded-lg p-1 text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition"
          >
            <Edit3 size={12} />
          </button>
        )}
      </div>

      {/* Nested Subordinates (L4/L5) connected directly below their manager */}
      {node.children.length > 0 && (
        <ul>
          {node.children.map((child) => (
            <DeptPersonTreeNode
              key={child.id}
              node={child}
              canEdit={canEdit}
              draggedPersonId={draggedPersonId}
              dragOverDeptId={dragOverDeptId}
              dragOverPersonId={dragOverPersonId}
              setDraggedPersonId={setDraggedPersonId}
              setDragOverDeptId={setDragOverDeptId}
              setDragOverPersonId={setDragOverPersonId}
              handleDepartmentTransfer={handleDepartmentTransfer}
              openEditModal={openEditModal}
              rootId={rootId}
              deptId={deptId}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
