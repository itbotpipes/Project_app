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
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Shield,
  Layers,
  Crown,
  Image as ImageIcon,
  Edit3,
} from "lucide-react";
import { cn } from "@/lib/cn";
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

// Calculate hierarchy badge with clean, premium colors
function getHierarchyBadge(depth?: number, level?: number, roleTitle?: string, systemRole?: string) {
  const title = (roleTitle || "").toLowerCase();

  // L0: Director / CEO
  if (title.includes("ceo") || title.includes("director") || depth === 0) {
    return { label: "Director / CEO", color: "bg-amber-100 text-amber-800 border-amber-300", tier: "L0", isLeader: true };
  }
  // L1: COO / Executive
  if (title.includes("coo")) {
    return { label: "COO / Executive", color: "bg-purple-100 text-purple-800 border-purple-300", tier: "L1", isLeader: true };
  }
  // L2: General Manager (GM) / Operations Manager
  if (title.includes("general manager") || title.includes("operation manager") || title.includes("gm")) {
    return { label: "General / Ops Manager", color: "bg-indigo-100 text-indigo-800 border-indigo-300", tier: "L2", isLeader: true };
  }
  // L3: Department Heads & Managers
  if (title.includes("manager") || title.includes("head") || systemRole === "MANAGER") {
    return { label: "HOD / Manager", color: "bg-blue-100 text-blue-800 border-blue-300", tier: "L3", isHOD: true };
  }
  // L4: Engineers / Supervisors / Accountants / Officers
  if (
    title.includes("engineer") ||
    title.includes("supervisor") ||
    title.includes("accountant") ||
    title.includes("social media") ||
    title.includes("technician") ||
    title.includes("executive")
  ) {
    return { label: "Team Member / Exec", color: "bg-emerald-100 text-emerald-800 border-emerald-300", tier: "L4" };
  }
  // L5: Assistants / Interns
  return { label: "Assistant / Intern", color: "bg-slate-100 text-slate-700 border-slate-200", tier: "L5" };
}

// Build hierarchical tree inside a department where subordinates divide horizontally under their manager
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
      roots.push(p);
    }
  });

  // Sort roots by level / role priority
  roots.sort((a, b) => (a.depth ?? 50) - (b.depth ?? 50) || (a.level ?? 50) - (b.level ?? 50) || a.name.localeCompare(b.name));

  function populate(person: PositionPerson): DeptTreeNode {
    const children = (childrenMap.get(person.id) ?? []).sort(
      (a, b) => (a.depth ?? 50) - (b.depth ?? 50) || (a.level ?? 50) - (b.level ?? 50) || a.name.localeCompare(b.name)
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

  const allEmps = data.allEmployees || [];

  // Top Executives
  const chinmay = useMemo(() => {
    return (
      allEmps.find((e) => e.name === "Chinmay Desai") ||
      allEmps.find((e) => e.roleTitle.includes("CEO")) ||
      data.root
    );
  }, [allEmps, data.root]);

  const cherry = useMemo(() => {
    return (
      allEmps.find((e) => e.name === "Cherry Chandak") ||
      allEmps.find((e) => e.roleTitle.toLowerCase() === "coo") ||
      data.leadership.find((l) => l.roleTitle.toLowerCase() === "coo") ||
      null
    );
  }, [allEmps, data.leadership]);

  const kishan = useMemo(() => {
    return (
      allEmps.find((e) => e.name === "Kishan Dabhi") ||
      allEmps.find((e) => e.roleTitle.toLowerCase().includes("general manager")) ||
      null
    );
  }, [allEmps]);

  const rushi = useMemo(() => {
    return (
      allEmps.find((e) => e.name === "Rushi Degdawala") ||
      allEmps.find((e) => e.roleTitle.toLowerCase().includes("operation manager")) ||
      null
    );
  }, [allEmps]);

  // Operational Departments resolution
  const leadershipIds = useMemo(
    () => new Set([chinmay?.id, cherry?.id, kishan?.id, rushi?.id].filter(Boolean) as string[]),
    [chinmay, cherry, kishan, rushi]
  );

  function resolveDept(nameSnippet: string): PositionDept {
    const snippet = nameSnippet.toLowerCase();
    const d = data.departments.find((dept) => dept.name.toLowerCase().includes(snippet));
    if (d) {
      return {
        ...d,
        people: d.people.filter((p) => !leadershipIds.has(p.id)),
      };
    }
    const matchingPeople = allEmps.filter(
      (e) => (e.departmentName || "").toLowerCase().includes(snippet) && !leadershipIds.has(e.id)
    );
    return {
      id: snippet,
      name: nameSnippet,
      people: matchingPeople,
    };
  }

  const siteDept = useMemo(() => resolveDept("Site Execution"), [data.departments, allEmps, leadershipIds]);
  const opsDept = useMemo(() => resolveDept("Operations AMC"), [data.departments, allEmps, leadershipIds]);
  const measDept = useMemo(() => resolveDept("Measurement"), [data.departments, allEmps, leadershipIds]);
  const designDept = useMemo(() => resolveDept("Design"), [data.departments, allEmps, leadershipIds]);
  const purchaseDept = useMemo(() => resolveDept("Purchase"), [data.departments, allEmps, leadershipIds]);
  const accountsDept = useMemo(() => resolveDept("Accounts & Finance"), [data.departments, allEmps, leadershipIds]);
  const hrDept = useMemo(() => resolveDept("HR & Admin"), [data.departments, allEmps, leadershipIds]);
  const mktDept = useMemo(() => resolveDept("Marketing"), [data.departments, allEmps, leadershipIds]);

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

  async function handleSaveHierarchy() {
    if (!selectedPerson) return;
    const personId = selectedPerson.id;

    const targetRole = data.roles.find((r) => r.id === editRoleId);
    const effectiveRoleTitle = editCustomRole.trim() || targetRole?.title || selectedPerson.roleTitle;
    const targetDept = data.allDepartments.find((d) => d.id === editDeptId);
    const targetManager = data.allEmployees.find((e) => e.id === editReportsToId);

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

  async function handleDepartmentTransfer(personId: string, newDeptId: string) {
    const person = allEmps.find((e) => e.id === personId);
    if (!person) return;
    const targetDept = data.allDepartments.find((d) => d.id === newDeptId);
    if (!targetDept) return;

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
            people: [...filteredPeople, updatedPerson],
          };
        }
        return { ...dept, people: filteredPeople };
      });

      const updatedAll = prev.allEmployees.map((e) => (e.id === personId ? updatedPerson : e));

      return { ...prev, departments: updatedDepts, allEmployees: updatedAll };
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

  // Check if department is hidden by department filter
  function isDeptVisible(deptNameSnippet: string): boolean {
    if (selectedDeptFilter === "ALL") return true;
    const d = data.allDepartments.find((item) => item.id === selectedDeptFilter);
    if (!d) return true;
    return d.name.toLowerCase().includes(deptNameSnippet.toLowerCase());
  }

  return (
    <div className="space-y-5">
      {/* Search, Hierarchy Tier & Department Filters */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 sm:flex-row sm:items-center sm:justify-between shadow-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Input */}
          <div className="relative min-w-[200px] flex-1 sm:w-64 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              type="text"
              placeholder="Search employee, position..."
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
              <option value="L2">Level 2 • General / Ops Manager</option>
              <option value="L3">Level 3 • HOD / Manager</option>
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
              <option value="ALL">All Departments (33 Members)</option>
              <option value="Site Execution">Site Execution (07)</option>
              <option value="Operations AMC">Operations AMC / Refilling (03)</option>
              <option value="Measurement">Measurement (02)</option>
              <option value="Design">Design (06)</option>
              <option value="Purchase">Purchase (02)</option>
              <option value="Accounts & Finance">Accounts & Finance (03)</option>
              <option value="HR & Admin">HR & Admin (04)</option>
              <option value="Marketing">Marketing (02)</option>
            </select>
          </div>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <div className="flex items-center rounded-xl border border-slate-200 bg-white p-1 text-xs">
            <button
              onClick={() => setZoomLevel((z) => Math.max(60, z - 10))}
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

      {/* Status Msg */}
      {statusMsg && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-xl p-3 text-xs font-semibold",
            statusMsg.type === "success"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border border-rose-200 bg-rose-50 text-rose-800"
          )}
        >
          {statusMsg.type === "success" ? <Check size={16} className="text-emerald-600" /> : <AlertCircle size={16} className="text-rose-600" />}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Main Org Tree in Classic Light Box & Horizontal Connector Format */}
      <div
        className="overflow-x-auto pb-10 pt-4 transition-transform duration-200 origin-top"
        style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: "top center" }}
      >
        <div className="min-w-max flex flex-col items-center">
          {/* Header Title */}
          <div className="mb-6 text-center">
            <h2 className="text-lg font-extrabold tracking-wider text-slate-900 uppercase">
              NORTHERN STAR ENGINEERING
            </h2>
            <div className="flex items-center justify-center gap-2 text-[10px] font-bold tracking-widest text-slate-400 uppercase">
              <span className="h-px w-8 bg-slate-200" />
              <span>ORGANIZATION STRUCTURE</span>
              <span className="h-px w-8 bg-slate-200" />
            </div>
          </div>

          <ul className="org-tree min-w-max">
            {/* LEVEL 0: Chinmay Desai (CEO / MD) */}
            <li>
              {chinmay && (
                <div
                  onClick={() => openEditModal(chinmay)}
                  className="group relative inline-flex cursor-pointer items-center gap-3.5 whitespace-nowrap rounded-2xl border-2 border-amber-400 bg-gradient-to-b from-white to-amber-50/40 p-4 shadow-md transition-all hover:border-amber-500 hover:shadow-lg hover:-translate-y-0.5"
                >
                  <Avatar
                    name={chinmay.name}
                    url={chinmay.avatarUrl}
                    size={46}
                    className="ring-2 ring-amber-400 shadow-xs"
                  />
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-extrabold uppercase tracking-wide text-slate-900">
                        {chinmay.name}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-300">
                        <Crown size={10} className="text-amber-600" /> Level 0
                      </span>
                    </div>
                    <div className="text-xs font-bold text-amber-700">{chinmay.roleTitle}</div>
                    <div className="text-[10px] text-slate-500 font-medium">Head of Organization</div>
                  </div>
                  {canEdit && (
                    <div className="absolute -top-1.5 -right-1.5 hidden rounded-full bg-amber-600 p-1 text-white shadow-xs group-hover:block">
                      <Edit3 size={10} />
                    </div>
                  )}
                </div>
              )}

              {/* LEVEL 1: Cherry Chandak (COO) */}
              <ul>
                <li>
                  {cherry && (
                    <div
                      onClick={() => openEditModal(cherry)}
                      className="group relative inline-flex cursor-pointer items-center gap-3.5 whitespace-nowrap rounded-2xl border-2 border-purple-300 bg-gradient-to-b from-white to-purple-50/40 p-3.5 shadow-sm transition-all hover:border-purple-500 hover:shadow-md hover:-translate-y-0.5"
                    >
                      <Avatar
                        name={cherry.name}
                        url={cherry.avatarUrl}
                        size={42}
                        className="ring-2 ring-purple-400 shadow-xs"
                      />
                      <div className="text-left">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-900">{cherry.name}</span>
                          <span className="rounded px-1.5 py-0.5 text-[9px] font-bold border bg-purple-100 text-purple-800 border-purple-300">
                            L1
                          </span>
                        </div>
                        <div className="text-xs font-semibold text-purple-700">{cherry.roleTitle}</div>
                        <div className="text-[10px] text-slate-400 font-medium">
                          Reports to: {cherry.reportsToName || chinmay?.name}
                        </div>
                      </div>
                      {canEdit && (
                        <div className="absolute -top-1.5 -right-1.5 hidden rounded-full bg-purple-600 p-1 text-white shadow-xs group-hover:block">
                          <Edit3 size={10} />
                        </div>
                      )}
                    </div>
                  )}

                  {/* LEVEL 2: Two Branches splitting Horizontally under Cherry Chandak */}
                  <ul>
                    {/* BRANCH 1: Kishan Dabhi (General Manager) */}
                    {(selectedDeptFilter === "ALL" || isDeptVisible("Site Execution")) && (
                      <li>
                        {kishan && (
                          <div
                            onClick={() => openEditModal(kishan)}
                            className="group relative inline-flex cursor-pointer items-center gap-3 whitespace-nowrap rounded-2xl border-2 border-indigo-300 bg-gradient-to-b from-white to-indigo-50/40 p-3.5 shadow-sm transition-all hover:border-indigo-500 hover:shadow-md hover:-translate-y-0.5"
                          >
                            <Avatar
                              name={kishan.name}
                              url={kishan.avatarUrl}
                              size={40}
                              className="ring-2 ring-indigo-400 shadow-xs"
                            />
                            <div className="text-left">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-slate-900">{kishan.name}</span>
                                <span className="rounded px-1.5 py-0.5 text-[9px] font-bold border bg-indigo-100 text-indigo-800 border-indigo-300">
                                  L2
                                </span>
                              </div>
                              <div className="text-xs font-semibold text-indigo-700">{kishan.roleTitle}</div>
                              <div className="text-[10px] text-slate-400 font-medium">
                                Direct report to COO
                              </div>
                            </div>
                            {canEdit && (
                              <div className="absolute -top-1.5 -right-1.5 hidden rounded-full bg-indigo-600 p-1 text-white shadow-xs group-hover:block">
                                <Edit3 size={10} />
                              </div>
                            )}
                          </div>
                        )}

                        {/* Under Kishan Dabhi: SITE EXECUTION (07 MEMBERS) Horizontally Divided */}
                        <ul>
                          <DepartmentBranch
                            dept={siteDept}
                            colorTheme="orange"
                            countLabel="07 MEMBERS"
                            canEdit={canEdit}
                            draggedPersonId={draggedPersonId}
                            dragOverDeptId={dragOverDeptId}
                            dragOverPersonId={dragOverPersonId}
                            setDraggedPersonId={setDraggedPersonId}
                            setDragOverDeptId={setDragOverDeptId}
                            setDragOverPersonId={setDragOverPersonId}
                            handleDepartmentTransfer={handleDepartmentTransfer}
                            openEditModal={openEditModal}
                            rootId={chinmay?.id}
                            searchQuery={searchQuery}
                            selectedTierFilter={selectedTierFilter}
                          />
                        </ul>
                      </li>
                    )}

                    {/* BRANCH 2: Rushi Degdawala (Operation Manager) */}
                    {(selectedDeptFilter === "ALL" || !isDeptVisible("Site Execution")) && (
                      <li>
                        {rushi && (
                          <div
                            onClick={() => openEditModal(rushi)}
                            className="group relative inline-flex cursor-pointer items-center gap-3 whitespace-nowrap rounded-2xl border-2 border-blue-300 bg-gradient-to-b from-white to-blue-50/40 p-3.5 shadow-sm transition-all hover:border-blue-500 hover:shadow-md hover:-translate-y-0.5"
                          >
                            <Avatar
                              name={rushi.name}
                              url={rushi.avatarUrl}
                              size={40}
                              className="ring-2 ring-blue-400 shadow-xs"
                            />
                            <div className="text-left">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-slate-900">{rushi.name}</span>
                                <span className="rounded px-1.5 py-0.5 text-[9px] font-bold border bg-blue-100 text-blue-800 border-blue-300">
                                  L2
                                </span>
                              </div>
                              <div className="text-xs font-semibold text-blue-700">{rushi.roleTitle}</div>
                              <div className="text-[10px] text-slate-400 font-medium">
                                Direct report to COO
                              </div>
                            </div>
                            {canEdit && (
                              <div className="absolute -top-1.5 -right-1.5 hidden rounded-full bg-blue-600 p-1 text-white shadow-xs group-hover:block">
                                <Edit3 size={10} />
                              </div>
                            )}
                          </div>
                        )}

                        {/* Under Rushi Degdawala: The Operational Departments Horizontally Divided */}
                        <ul>
                          {/* 1. OPERATIONS AMC / REFILLING (03 MEMBERS) */}
                          {(selectedDeptFilter === "ALL" || isDeptVisible("Operations AMC")) && (
                            <DepartmentBranch
                              dept={opsDept}
                              colorTheme="teal"
                              countLabel="03 MEMBERS"
                              canEdit={canEdit}
                              draggedPersonId={draggedPersonId}
                              dragOverDeptId={dragOverDeptId}
                              dragOverPersonId={dragOverPersonId}
                              setDraggedPersonId={setDraggedPersonId}
                              setDragOverDeptId={setDragOverDeptId}
                              setDragOverPersonId={setDragOverPersonId}
                              handleDepartmentTransfer={handleDepartmentTransfer}
                              openEditModal={openEditModal}
                              rootId={chinmay?.id}
                              searchQuery={searchQuery}
                              selectedTierFilter={selectedTierFilter}
                            />
                          )}

                          {/* 2. MEASUREMENT (02 MEMBERS) */}
                          {(selectedDeptFilter === "ALL" || isDeptVisible("Measurement")) && (
                            <DepartmentBranch
                              dept={measDept}
                              colorTheme="rose"
                              countLabel="02 MEMBERS"
                              canEdit={canEdit}
                              draggedPersonId={draggedPersonId}
                              dragOverDeptId={dragOverDeptId}
                              dragOverPersonId={dragOverPersonId}
                              setDraggedPersonId={setDraggedPersonId}
                              setDragOverDeptId={setDragOverDeptId}
                              setDragOverPersonId={setDragOverPersonId}
                              handleDepartmentTransfer={handleDepartmentTransfer}
                              openEditModal={openEditModal}
                              rootId={chinmay?.id}
                              searchQuery={searchQuery}
                              selectedTierFilter={selectedTierFilter}
                            />
                          )}

                          {/* 3. DESIGN (06 MEMBERS) */}
                          {(selectedDeptFilter === "ALL" || isDeptVisible("Design")) && (
                            <DepartmentBranch
                              dept={designDept}
                              colorTheme="purple"
                              countLabel="06 MEMBERS"
                              canEdit={canEdit}
                              draggedPersonId={draggedPersonId}
                              dragOverDeptId={dragOverDeptId}
                              dragOverPersonId={dragOverPersonId}
                              setDraggedPersonId={setDraggedPersonId}
                              setDragOverDeptId={setDragOverDeptId}
                              setDragOverPersonId={setDragOverPersonId}
                              handleDepartmentTransfer={handleDepartmentTransfer}
                              openEditModal={openEditModal}
                              rootId={chinmay?.id}
                              searchQuery={searchQuery}
                              selectedTierFilter={selectedTierFilter}
                            />
                          )}

                          {/* 4. PURCHASE (02 MEMBERS) */}
                          {(selectedDeptFilter === "ALL" || isDeptVisible("Purchase")) && (
                            <DepartmentBranch
                              dept={purchaseDept}
                              colorTheme="amber"
                              countLabel="02 MEMBERS"
                              canEdit={canEdit}
                              draggedPersonId={draggedPersonId}
                              dragOverDeptId={dragOverDeptId}
                              dragOverPersonId={dragOverPersonId}
                              setDraggedPersonId={setDraggedPersonId}
                              setDragOverDeptId={setDragOverDeptId}
                              setDragOverPersonId={setDragOverPersonId}
                              handleDepartmentTransfer={handleDepartmentTransfer}
                              openEditModal={openEditModal}
                              rootId={chinmay?.id}
                              searchQuery={searchQuery}
                              selectedTierFilter={selectedTierFilter}
                            />
                          )}

                          {/* 5. ACCOUNTS & FINANCE (03 MEMBERS) */}
                          {(selectedDeptFilter === "ALL" || isDeptVisible("Accounts & Finance")) && (
                            <DepartmentBranch
                              dept={accountsDept}
                              colorTheme="blue"
                              countLabel="03 MEMBERS"
                              canEdit={canEdit}
                              draggedPersonId={draggedPersonId}
                              dragOverDeptId={dragOverDeptId}
                              dragOverPersonId={dragOverPersonId}
                              setDraggedPersonId={setDraggedPersonId}
                              setDragOverDeptId={setDragOverDeptId}
                              setDragOverPersonId={setDragOverPersonId}
                              handleDepartmentTransfer={handleDepartmentTransfer}
                              openEditModal={openEditModal}
                              rootId={chinmay?.id}
                              searchQuery={searchQuery}
                              selectedTierFilter={selectedTierFilter}
                            />
                          )}

                          {/* 6. HR & ADMIN (04 MEMBERS) + MARKETING (02 MEMBERS) */}
                          {(selectedDeptFilter === "ALL" || isDeptVisible("HR & Admin") || isDeptVisible("Marketing")) && (
                            <DepartmentBranch
                              dept={hrDept}
                              colorTheme="pink"
                              countLabel="04 MEMBERS"
                              subBranchDept={mktDept}
                              subBranchColorTheme="emerald"
                              subBranchCountLabel="02 MEMBERS"
                              canEdit={canEdit}
                              draggedPersonId={draggedPersonId}
                              dragOverDeptId={dragOverDeptId}
                              dragOverPersonId={dragOverPersonId}
                              setDraggedPersonId={setDraggedPersonId}
                              setDragOverDeptId={setDragOverDeptId}
                              setDragOverPersonId={setDragOverPersonId}
                              handleDepartmentTransfer={handleDepartmentTransfer}
                              openEditModal={openEditModal}
                              rootId={chinmay?.id}
                              searchQuery={searchQuery}
                              selectedTierFilter={selectedTierFilter}
                            />
                          )}
                        </ul>
                      </li>
                    )}
                  </ul>
                </li>
              </ul>
            </li>
          </ul>

          {/* Footer Headcount Note */}
          <div className="mt-12 flex items-center justify-center gap-3 text-xs font-bold uppercase tracking-widest text-slate-400 border-t border-slate-200/90 pt-4 w-full">
            <span>NORTHERN STAR ENGINEERING</span>
            <span>•</span>
            <span className="text-blue-600 font-extrabold">TOTAL HEADCOUNT 33</span>
          </div>
        </div>
      </div>

      {/* Edit Position Modal */}
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
                  <p className="text-xs text-slate-500">
                    {selectedPerson.departmentName || "General"} · Reports to:{" "}
                    <strong>{selectedPerson.reportsToName || "None (Top Root)"}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedPerson(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <div className="space-y-4">
              {/* 1. Official Role / Title */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Shield size={14} className="text-blue-600" /> Position / Role Title
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <select
                    value={editRoleId}
                    onChange={(e) => {
                      setEditRoleId(e.target.value);
                      const r = data.roles.find((item) => item.id === e.target.value);
                      if (r) {
                        setEditLevel(r.level ?? 30);
                        if (r.departmentId) setEditDeptId(r.departmentId);
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
                    placeholder="Or custom title..."
                    value={editCustomRole}
                    onChange={(e) => setEditCustomRole(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              {/* 2. Hierarchy Level */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Layers size={14} className="text-blue-600" /> Hierarchy Level
                </label>
                <select
                  value={editTier}
                  onChange={(e) => {
                    const t = e.target.value;
                    setEditTier(t);
                    if (t === "L0") setEditLevel(0);
                    else if (t === "L1") setEditLevel(5);
                    else if (t === "L2") setEditLevel(10);
                    else if (t === "L3") setEditLevel(25);
                    else if (t === "L4") setEditLevel(40);
                    else if (t === "L5") setEditLevel(60);
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                >
                  <option value="L0">L0 • Director / CEO</option>
                  <option value="L1">L1 • COO / Executive</option>
                  <option value="L2">L2 • General Manager / Operations Manager</option>
                  <option value="L3">L3 • Department Head / Manager</option>
                  <option value="L4">L4 • Team Member / Engineer / Supervisor</option>
                  <option value="L5">L5 • Assistant / Intern</option>
                </select>
              </div>

              {/* 3. Department */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Building2 size={14} className="text-blue-600" /> Department
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
                  <UserCheck size={14} className="text-blue-600" /> Reporting Manager
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

              {/* 5. System Role & Photo */}
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
                    <ImageIcon size={14} className="text-blue-600" /> Photo URL
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
 * Department Branch with Header Box and Horizontally Divided Member Tree
 */
function DepartmentBranch({
  dept,
  colorTheme = "blue",
  countLabel,
  subBranchDept,
  subBranchColorTheme = "emerald",
  subBranchCountLabel,
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
  searchQuery,
  selectedTierFilter,
}: {
  dept: PositionDept;
  colorTheme?: "orange" | "teal" | "rose" | "purple" | "amber" | "blue" | "pink" | "emerald";
  countLabel?: string;
  subBranchDept?: PositionDept;
  subBranchColorTheme?: "emerald" | "teal" | "blue";
  subBranchCountLabel?: string;
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
  searchQuery: string;
  selectedTierFilter: string;
}) {
  const isDeptTarget = dragOverDeptId === dept.id;
  const deptTree = useMemo(() => buildDeptTree(dept.people), [dept.people]);

  // Color themes for header pill
  const themeClasses: Record<string, { border: string; bg: string; text: string; badge: string }> = {
    orange: {
      border: "border-orange-400",
      bg: "bg-gradient-to-r from-orange-50 to-amber-50 text-orange-950",
      text: "text-orange-900",
      badge: "bg-orange-100 text-orange-800 border-orange-200",
    },
    teal: {
      border: "border-teal-400",
      bg: "bg-gradient-to-r from-teal-50 to-emerald-50 text-teal-950",
      text: "text-teal-900",
      badge: "bg-teal-100 text-teal-800 border-teal-200",
    },
    rose: {
      border: "border-rose-400",
      bg: "bg-gradient-to-r from-rose-50 to-red-50 text-rose-950",
      text: "text-rose-900",
      badge: "bg-rose-100 text-rose-800 border-rose-200",
    },
    purple: {
      border: "border-purple-400",
      bg: "bg-gradient-to-r from-purple-50 to-indigo-50 text-purple-950",
      text: "text-purple-900",
      badge: "bg-purple-100 text-purple-800 border-purple-200",
    },
    amber: {
      border: "border-amber-400",
      bg: "bg-gradient-to-r from-amber-50 to-yellow-50 text-amber-950",
      text: "text-amber-900",
      badge: "bg-amber-100 text-amber-800 border-amber-200",
    },
    blue: {
      border: "border-blue-400",
      bg: "bg-gradient-to-r from-blue-50 to-sky-50 text-blue-950",
      text: "text-blue-900",
      badge: "bg-blue-100 text-blue-800 border-blue-200",
    },
    pink: {
      border: "border-pink-400",
      bg: "bg-gradient-to-r from-pink-50 to-rose-50 text-pink-950",
      text: "text-pink-900",
      badge: "bg-pink-100 text-pink-800 border-pink-200",
    },
    emerald: {
      border: "border-emerald-400",
      bg: "bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-950",
      text: "text-emerald-900",
      badge: "bg-emerald-100 text-emerald-800 border-emerald-200",
    },
  };

  const theme = themeClasses[colorTheme] || themeClasses.blue;

  return (
    <li>
      {/* Department Header Pill */}
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
        className={cn(
          "whitespace-nowrap rounded-2xl border-2 px-4 py-2 shadow-xs transition-all",
          theme.border,
          theme.bg,
          isDeptTarget && "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-400 scale-105"
        )}
      >
        <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-[11px] sm:text-xs">
          <Building2 size={13} className="shrink-0 opacity-80" />
          <span>{dept.name}</span>
          <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-black border", theme.badge)}>
            {countLabel || `${dept.people.length} MEMBERS`}
          </span>
        </div>
      </div>

      {/* Subordinates divided Horizontally beneath Department */}
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
              searchQuery={searchQuery}
              selectedTierFilter={selectedTierFilter}
            />
          ))}
          {/* Sub-branch if any (e.g. Marketing branching from HR & Admin) */}
          {subBranchDept && (
            <DepartmentBranch
              dept={subBranchDept}
              colorTheme={subBranchColorTheme}
              countLabel={subBranchCountLabel}
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
              searchQuery={searchQuery}
              selectedTierFilter={selectedTierFilter}
            />
          )}
        </ul>
      )}
    </li>
  );
}

/**
 * Recursive Tree Node displaying a person card and dividing their subordinates horizontally beneath them
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
  searchQuery,
  selectedTierFilter,
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
  searchQuery: string;
  selectedTierFilter: string;
}) {
  const isDragged = draggedPersonId === node.id;
  const isPersonTarget = dragOverPersonId === node.id && draggedPersonId !== node.id;
  const badge = getHierarchyBadge(node.depth, node.level, node.roleTitle, node.systemRole);

  const q = searchQuery.toLowerCase().trim();
  const isMatch = !q || node.name.toLowerCase().includes(q) || node.roleTitle.toLowerCase().includes(q);
  const isTierMatch = selectedTierFilter === "ALL" || badge.tier === selectedTierFilter;
  const isDimmed = (q && !isMatch) || (selectedTierFilter !== "ALL" && !isTierMatch);

  return (
    <li>
      {/* Light, clean card for the person */}
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
        className={cn(
          "group relative flex cursor-pointer items-center justify-between gap-3 whitespace-nowrap rounded-2xl border-2 bg-white px-3.5 py-2.5 shadow-xs transition-all",
          isDragged && "opacity-50 border-blue-400 ring-2 ring-blue-300 scale-95",
          isPersonTarget && "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-400 shadow-md",
          badge.isHOD && "border-blue-300/90 bg-gradient-to-b from-blue-50/30 to-white hover:border-blue-500 hover:shadow-md hover:-translate-y-0.5",
          !badge.isHOD && !isPersonTarget && "border-slate-200 hover:border-blue-400 hover:shadow-md hover:-translate-y-0.5",
          isDimmed && "opacity-30"
        )}
      >
        <div className="flex items-center gap-2.5">
          {canEdit && node.id !== rootId && (
            <GripVertical
              size={14}
              className="text-slate-300 group-hover:text-slate-500 cursor-grab shrink-0"
            />
          )}

          {/* Avatar Component with photo / initials */}
          <Avatar
            name={node.name}
            url={node.avatarUrl}
            size={34}
            className="ring-1 ring-slate-200 shrink-0"
          />

          <div className="text-left">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-900">{node.name}</span>
              <span className={cn("rounded px-1.5 py-0.2 text-[9px] font-bold border", badge.color)}>
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
            title="Edit Position & Hierarchy"
            className="opacity-0 group-hover:opacity-100 rounded-lg p-1 text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition"
          >
            <Edit3 size={12} />
          </button>
        )}
      </div>

      {/* Subordinates divided Horizontally beneath their manager with org-tree connectors */}
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
              searchQuery={searchQuery}
              selectedTierFilter={selectedTierFilter}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
