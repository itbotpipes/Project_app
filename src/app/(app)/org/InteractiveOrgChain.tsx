"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GripVertical, Move, UserCheck, AlertCircle, ChevronDown, Check, RefreshCw } from "lucide-react";
import { reassignReportingLine } from "@/lib/actions/admin";

export type RawEmployee = {
  id: string;
  name: string;
  roleTitle: string;
  reportsToId: string | null;
  avatarUrl?: string | null;
};

type TreeNode = {
  id: string;
  name: string;
  roleTitle: string;
  reportsToId: string | null;
  avatarUrl?: string | null;
  children: TreeNode[];
};

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
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
    return {
      id: e.id,
      name: e.name,
      roleTitle: e.roleTitle,
      reportsToId: e.reportsToId,
      avatarUrl: e.avatarUrl,
      children: (byManager.get(e.id) ?? []).map(buildTree),
    };
  }

  const topEmp = employees.find((e) => e.id === topPersonId) || employees[0];
  const treeRoot = topEmp ? buildTree(topEmp) : null;

  async function handleReassign(draggedId: string, newManagerId: string) {
    if (draggedId === newManagerId) return;

    // Local validation check for circular loop
    const draggedNode = treeRoot ? findNode(treeRoot, draggedId) : null;
    if (draggedNode && isDescendant(draggedNode, newManagerId)) {
      setStatusMsg({ type: "error", text: "Cannot assign a manager to report to their own subordinate." });
      return;
    }

    const draggedEmp = employees.find(e => e.id === draggedId);
    const newManager = employees.find(e => e.id === newManagerId);

    // Optimistic local update
    setEmployees(prev =>
      prev.map(emp => (emp.id === draggedId ? { ...emp, reportsToId: newManagerId } : emp))
    );

    setStatusMsg(null);

    startTransition(async () => {
      const res = await reassignReportingLine(draggedId, newManagerId);
      if (res?.error) {
        // Revert on error
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

    // Check if valid target (not self and not a descendant)
    const isValidTarget =
      isTarget &&
      draggedEmpId &&
      !isDescendant(node, draggedEmpId);

    const isInvalidTarget = isTarget && !isValidTarget;

    return (
      <div className="relative">
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
          className={`group relative flex items-center justify-between gap-3 rounded-xl border bg-white p-3 shadow-sm transition-all ${
            isDragged
              ? "opacity-50 border-blue-400 ring-2 ring-blue-400/30 scale-[0.98]"
              : isValidTarget
              ? "border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-500/40 shadow-md translate-x-1"
              : isInvalidTarget
              ? "border-rose-400 bg-rose-50/70 ring-2 ring-rose-400/30"
              : "border-slate-200 hover:border-blue-300 hover:shadow-md"
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            {canEdit && node.id !== topPersonId && (
              <span className="cursor-grab text-slate-300 transition group-hover:text-slate-500 active:cursor-grabbing">
                <GripVertical size={16} />
              </span>
            )}
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
              {initials(node.name)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold text-slate-900">{node.name}</span>
                {node.id === topPersonId && (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                    Top Leader
                  </span>
                )}
              </div>
              <div className="truncate text-xs text-slate-500">{node.roleTitle}</div>
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
                onClick={() => setSelectedForChange({ id: node.id, name: node.name, roleTitle: node.roleTitle, reportsToId: node.reportsToId })}
                className="opacity-0 group-hover:opacity-100 transition rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 flex items-center gap-1"
                title="Change Manager"
              >
                Change Manager <ChevronDown size={12} />
              </button>
            )}
          </div>
        </div>

        {node.children.length > 0 && (
          <div className="mt-3 ml-5 space-y-3 border-l-2 border-dashed border-slate-200 pl-5">
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
      {canEdit && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-2.5 text-xs text-blue-800">
          <span className="flex items-center gap-2 font-medium">
            <Move size={15} className="text-blue-600" />
            <strong className="font-semibold">Drag & Drop Enabled:</strong> Drag any employee card and drop it onto another employee to reassign their manager.
          </span>
          {isPending && (
            <span className="flex items-center gap-1 font-semibold text-blue-600 animate-pulse">
              <RefreshCw size={12} className="animate-spin" /> Saving changes...
            </span>
          )}
        </div>
      )}

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

      {treeRoot ? (
        <NodeItem node={treeRoot} />
      ) : (
        <div className="p-8 text-center text-sm text-slate-400">No employees found in the org chart.</div>
      )}

      {/* Manual Change Manager Dialog */}
      {selectedForChange && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Change Manager for {selectedForChange.name}</h3>
              <p className="text-xs text-slate-500">Select a new reporting manager from the list below.</p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">New Manager</label>
              <select
                defaultValue={selectedForChange.reportsToId || ""}
                onChange={(e) => {
                  const newManagerId = e.target.value;
                  if (newManagerId && newManagerId !== selectedForChange.id) {
                    handleReassign(selectedForChange.id, newManagerId);
                    setSelectedForChange(null);
                  }
                }}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm outline-none transition focus:border-blue-500 focus:bg-white"
              >
                <option value="" disabled>Select manager...</option>
                {employees
                  .filter((e) => e.id !== selectedForChange.id)
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} ({e.roleTitle})
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedForChange(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
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
