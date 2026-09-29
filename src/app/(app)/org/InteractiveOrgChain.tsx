"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  GripVertical,
  Move,
  UserCheck,
  AlertCircle,
  ChevronDown,
  Check,
  RefreshCw,
  Search,
  Layers,
  Crown,
  Building2,
  SlidersHorizontal,
} from "lucide-react";
import { reassignReportingLine } from "@/lib/actions/admin";
import Avatar from "../_components/Avatar";

export type RawEmployee = {
  id: string;
  name: string;
  roleTitle: string;
  level?: number;
  systemRole?: string;
  departmentName?: string | null;
  reportsToId: string | null;
  avatarUrl?: string | null;
};

type TreeNode = {
  id: string;
  name: string;
  roleTitle: string;
  level?: number;
  systemRole?: string;
  departmentName?: string | null;
  reportsToId: string | null;
  avatarUrl?: string | null;
  children: TreeNode[];
};

// Calculate accurate hierarchy badge based on role title, depth, and systemRole
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

// Check if candidateId is a descendant of node (to prevent circular reporting loops in UI)
function isDescendant(node: TreeNode, candidateId: string): boolean {
  for (const child of node.children) {
    if (child.id === candidateId) return true;
    if (isDescendant(child, candidateId)) return true;
  }
  return false;
}

export default function InteractiveOrgChain({
  employees: initialEmployees,
  topPersonId,
  canEdit,
}: {
  employees: RawEmployee[];
  topPersonId: string | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [employees, setEmployees] = useState<RawEmployee[]>(initialEmployees);
  const [draggedEmpId, setDraggedEmpId] = useState<string | null>(null);
  const [dragOverEmpId, setDragOverEmpId] = useState<string | null>(null);
  const [selectedForChange, setSelectedForChange] = useState<RawEmployee | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTierFilter, setSelectedTierFilter] = useState<string>("ALL");

  // Re-build tree dynamically from current employees array
  const byManager = new Map<string, RawEmployee[]>();
  for (const e of employees) {
    if (e.id === topPersonId) continue;
    const parentId = e.reportsToId || topPersonId || "";
    if (parentId) {
      const arr = byManager.get(parentId) ?? [];
      arr.push(e);
      byManager.set(parentId, arr);
    }
  }

  function buildTree(e: RawEmployee): TreeNode {
    const childrenRaw = byManager.get(e.id) ?? [];
    // Sort children by hierarchy level
    childrenRaw.sort((a, b) => (a.level ?? 50) - (b.level ?? 50));
    return {
      id: e.id,
      name: e.name,
      roleTitle: e.roleTitle,
      level: e.level,
      systemRole: e.systemRole,
      departmentName: e.departmentName,
      reportsToId: e.reportsToId,
      avatarUrl: e.avatarUrl,
      children: childrenRaw.map(buildTree),
    };
  }

  const topEmp = employees.find((e) => e.id === topPersonId) || employees[0];
  const treeRoot = topEmp ? buildTree(topEmp) : null;

  async function handleReassign(draggedId: string, newManagerId: string) {
    if (draggedId === newManagerId) return;

    const draggedNode = treeRoot ? findNode(treeRoot, draggedId) : null;
    if (draggedNode && isDescendant(draggedNode, newManagerId)) {
      setStatusMsg({ type: "error", text: "Cannot assign a manager to report to their own subordinate." });
      return;
    }

    const draggedEmp = employees.find((e) => e.id === draggedId);
    const newManager = employees.find((e) => e.id === newManagerId);

    // Optimistic local update
    setEmployees((prev) =>
      prev.map((emp) => (emp.id === draggedId ? { ...emp, reportsToId: newManagerId } : emp))
    );

    setStatusMsg(null);

    startTransition(async () => {
      const res = await reassignReportingLine(draggedId, newManagerId);
      if (res?.error) {
        setEmployees(initialEmployees);
        setStatusMsg({ type: "error", text: res.error });
      } else {
        setStatusMsg({
          type: "success",
          text: `Successfully assigned ${draggedEmp?.name ?? "employee"} to report to ${newManager?.name ?? "manager"}.`,
        });
        router.refresh();
      }
    });
  }

  function findNode(node: TreeNode, id: string): TreeNode | null {
    if (node.id === id) return node;
    for (const child of node.children) {
      const found = findNode(child, id);
      if (found) return found;
    }
    return null;
  }

  // Recursive tree node renderer
  function NodeItem({ node, depth = 0 }: { node: TreeNode; depth?: number }) {
    const isDragged = draggedEmpId === node.id;
    const isTarget = dragOverEmpId === node.id && draggedEmpId !== node.id;
    const isValidTarget = isTarget && draggedEmpId && !isDescendant(node, draggedEmpId);
    const isInvalidTarget = isTarget && !isValidTarget;
    const badge = getHierarchyBadge(node.depth ?? depth, node.level, node.roleTitle, node.systemRole);

    // Check search / filter match
    const q = searchQuery.toLowerCase().trim();
    const isMatch =
      !q ||
      node.name.toLowerCase().includes(q) ||
      node.roleTitle.toLowerCase().includes(q) ||
      (node.departmentName || "").toLowerCase().includes(q);

    const isTierMatch = selectedTierFilter === "ALL" || badge.tier === selectedTierFilter;
    const isDimmed = (searchQuery.trim() && !isMatch) || (selectedTierFilter !== "ALL" && !isTierMatch);

    return (
      <div className={`relative ${isDimmed ? "opacity-35" : "opacity-100"}`}>
        <div
          draggable={canEdit && node.id !== topPersonId}
          onDragStart={(e) => {
            if (!canEdit || node.id === topPersonId) return;
            e.stopPropagation();
            setDraggedEmpId(node.id);
            e.dataTransfer.setData("text/plain", node.id);
            e.dataTransfer.effectAllowed = "move";
          }}
          onDragEnd={() => {
            setDraggedEmpId(null);
            setDragOverEmpId(null);
          }}
          onDragOver={(e) => {
            if (!canEdit || !draggedEmpId || draggedEmpId === node.id) return;
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = "move";
            if (dragOverEmpId !== node.id) setDragOverEmpId(node.id);
          }}
          onDragLeave={(e) => {
            e.stopPropagation();
            if (dragOverEmpId === node.id) setDragOverEmpId(null);
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const sourceId = draggedEmpId || e.dataTransfer.getData("text/plain");
            setDraggedEmpId(null);
            setDragOverEmpId(null);
            if (sourceId && sourceId !== node.id) {
              handleReassign(sourceId, node.id);
            }
          }}
          className={`group relative flex items-center justify-between gap-3 rounded-2xl border bg-white p-3 shadow-xs transition-all ${
            isDragged
              ? "opacity-50 border-blue-400 ring-2 ring-blue-400/30 scale-[0.98]"
              : isValidTarget
              ? "border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-500/40 shadow-md translate-x-1"
              : isInvalidTarget
              ? "border-rose-400 bg-rose-50/70 ring-2 ring-rose-400/30"
              : badge.isLeader
              ? "border-amber-300 bg-amber-50/30 hover:border-amber-400 hover:shadow-md"
              : badge.isHOD
              ? "border-blue-200 bg-blue-50/20 hover:border-blue-400 hover:shadow-md"
              : "border-slate-200 hover:border-blue-300 hover:shadow-md"
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            {canEdit && node.id !== topPersonId && (
              <span className="cursor-grab text-slate-300 transition group-hover:text-slate-500 active:cursor-grabbing">
                <GripVertical size={16} />
              </span>
            )}
            {/* Avatar Photo */}
            <Avatar
              name={node.name}
              url={node.avatarUrl}
              size={40}
              className="ring-1 ring-slate-200 shrink-0"
            />
            <div className="min-w-0 text-left">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-bold text-slate-900">{node.name}</span>
                <span className={`rounded px-1.5 py-0.2 text-[9px] font-bold border ${badge.color}`}>
                  {badge.tier}
                </span>
                {node.id === topPersonId && (
                  <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-300 flex items-center gap-1">
                    <Crown size={10} /> Top Leader
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="font-semibold text-blue-700">{node.roleTitle}</span>
                {node.departmentName && (
                  <>
                    <span>•</span>
                    <span className="text-slate-500">{node.departmentName}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isValidTarget && (
              <span className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">
                <UserCheck size={14} /> Drop to report to {node.name}
              </span>
            )}

            {isInvalidTarget && (
              <span className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold text-rose-700 bg-rose-100 px-2.5 py-1 rounded-full">
                <AlertCircle size={14} /> Cannot assign to subordinate
              </span>
            )}

            {canEdit && node.id !== topPersonId && !isTarget && (
              <button
                type="button"
                onClick={() => setSelectedForChange(node)}
                className="opacity-0 group-hover:opacity-100 transition rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 flex items-center gap-1.5"
                title="Change Manager"
              >
                Change Manager <ChevronDown size={13} />
              </button>
            )}
          </div>
        </div>

        {node.children.length > 0 && (
          <div className="mt-3 ml-6 space-y-3 border-l-2 border-dashed border-slate-200 pl-6">
            {node.children.map((child) => (
              <NodeItem key={child.id} node={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Filter Bar for Reporting Chain */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3.5 text-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative w-60">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              type="text"
              placeholder="Search in reporting chain..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <Layers size={14} className="text-blue-600 shrink-0" />
            <select
              value={selectedTierFilter}
              onChange={(e) => setSelectedTierFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-blue-500"
            >
              <option value="ALL">All Levels</option>
              <option value="L0">Level 0 • Director / CEO</option>
              <option value="L1">Level 1 • COO / Executive</option>
              <option value="L2">Level 2 • General Manager (GM)</option>
              <option value="L3">Level 3 • HOD / Department Manager</option>
              <option value="L4">Level 4 • Team Member / Exec</option>
              <option value="L5">Level 5 • Assistant / Intern</option>
            </select>
          </div>
        </div>

        {canEdit && (
          <div className="flex items-center gap-2 text-slate-600 font-medium">
            <Move size={14} className="text-blue-600" />
            <span>Drag any card to reassign reporting manager.</span>
            {isPending && (
              <span className="flex items-center gap-1 font-semibold text-blue-600 animate-pulse ml-2">
                <RefreshCw size={12} className="animate-spin" /> Saving...
              </span>
            )}
          </div>
        )}
      </div>

      {statusMsg && (
        <div
          className={`flex items-center gap-2 rounded-xl p-3 text-xs font-semibold ${
            statusMsg.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-rose-50 text-rose-800 border border-rose-200"
          }`}
        >
          {statusMsg.type === "success" ? <Check size={16} /> : <AlertCircle size={16} />}
          {statusMsg.text}
        </div>
      )}

      <div className="p-2">
        {treeRoot ? (
          <NodeItem node={treeRoot} />
        ) : (
          <div className="p-8 text-center text-sm text-slate-400">No employees found in the reporting chain.</div>
        )}
      </div>

      {/* Manual Change Manager Dialog */}
      {selectedForChange && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Change Manager for {selectedForChange.name}
                </h3>
                <p className="text-xs text-slate-500">Select a new reporting manager in the hierarchy</p>
              </div>
              <button
                onClick={() => setSelectedForChange(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700">New Reporting Manager</label>
              <select
                defaultValue={selectedForChange.reportsToId || ""}
                onChange={(e) => {
                  const newManagerId = e.target.value;
                  if (newManagerId && newManagerId !== selectedForChange.id) {
                    handleReassign(selectedForChange.id, newManagerId);
                    setSelectedForChange(null);
                  }
                }}
                className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
              >
                <option value="">Select Manager</option>
                {employees
                  .filter((e) => e.id !== selectedForChange.id)
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} — {e.roleTitle} ({e.departmentName || "General"})
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedForChange(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
