"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, AlertTriangle } from "lucide-react";
import { moveTask, softDeleteTask } from "@/lib/actions/tasks";
import { priorityQuadrant, TASK_STATUS_LABEL } from "@/lib/constants";
import { cn } from "@/lib/cn";
import MoveControl from "./MoveControl";
import TaskLink from "../_components/TaskLink";

export type BoardTask = {
  id: string;
  title: string;
  status: string;
  sizeLabel: string | null;
  urgent: boolean;
  important: boolean;
  estimatedMins: number | null;
  dueAt: string | null;
  holdReason: string | null;
  reviewRequired: boolean;
  carryCount: number;
  reworkCount: number;
  kpiName: string | null;
  projectName: string | null;
  delegatedBy: string | null;
  checklistTotal?: number;
  checklistDone?: number;
};

const COLUMN_TINT: Record<string, string> = {
  NEW: "bg-slate-400",
  ACCEPTED: "bg-sky-400",
  IN_PROGRESS: "bg-blue-500",
  ON_HOLD: "bg-amber-400",
  PENDING_REVIEW: "bg-violet-500",
  CLOSED: "bg-emerald-500",
};

const quadTone: Record<string, string> = {
  "Do First": "bg-red-100 text-red-700",
  Schedule: "bg-blue-100 text-blue-700",
  Delegate: "bg-amber-100 text-amber-700",
  Eliminate: "bg-slate-100 text-slate-500",
};

export default function KanbanBoard({
  initialTasks,
  columns,
}: {
  initialTasks: BoardTask[];
  columns: string[];
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  function colOf(status: string) {
    return columns.includes(status) ? status : "NEW";
  }

  async function applyMove(taskId: string, newStatus: string) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || colOf(task.status) === newStatus) return;

    let holdReason: string | null = null;
    if (newStatus === "ON_HOLD") {
      holdReason = window.prompt("Reason for putting this task on hold? (required)") || null;
      if (!holdReason) return; // cancelled → abort the move
    }

    // optimistic update
    const prevStatus = task.status;
    const prevHoldReason = task.holdReason;
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus, holdReason: holdReason ?? t.holdReason } : t)),
    );

    const fd = new FormData();
    fd.set("taskId", taskId);
    fd.set("status", newStatus);
    if (holdReason) fd.set("holdReason", holdReason);
    startTransition(async () => {
      const res = await moveTask(fd);
      if (res && "error" in res && res.error) {
        // revert the optimistic move and tell the user why
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, status: prevStatus, holdReason: prevHoldReason } : t)),
        );
        window.alert(res.error);
        return;
      }
      router.refresh();
    });
  }

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  async function confirmRemoveTask() {
    if (!confirmDeleteId) return;
    const taskId = confirmDeleteId;
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    const fd = new FormData();
    fd.set("taskId", taskId);
    startTransition(async () => {
      await softDeleteTask(fd);
      setConfirmDeleteId(null);
      router.refresh();
    });
  }

  function removeTask(taskId: string) {
    setConfirmDeleteId(taskId);
  }

  const grouped: Record<string, BoardTask[]> = {};
  for (const c of columns) grouped[c] = [];
  for (const t of tasks) grouped[colOf(t.status)].push(t);

  return (
    <>
      <div className="flex gap-4 overflow-x-auto scroll-thin pb-4">
        {columns.map((status) => (
        <div
          key={status}
          onDragOver={(e) => {
            e.preventDefault();
            setOverCol(status);
          }}
          onDragLeave={() => setOverCol((c) => (c === status ? null : c))}
          onDrop={(e) => {
            e.preventDefault();
            const id = e.dataTransfer.getData("text/plain") || dragId;
            setOverCol(null);
            setDragId(null);
            if (id) applyMove(id, status);
          }}
          className="w-72 shrink-0"
        >
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={cn("h-2.5 w-2.5 rounded-full", COLUMN_TINT[status])} />
              <h2 className="text-sm font-semibold text-slate-700">{TASK_STATUS_LABEL[status]}</h2>
            </div>
            <span className="rounded-full bg-slate-100 px-2 text-xs text-slate-500">
              {grouped[status].length}
            </span>
          </div>

          <div
            className={cn(
              "space-y-2 rounded-xl p-2 min-h-24 transition-colors",
              overCol === status ? "bg-blue-100 ring-2 ring-blue-300" : "bg-slate-100/60",
            )}
          >
            {grouped[status].map((task) => {
              const quad = priorityQuadrant(task.urgent, task.important);
              return (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", task.id);
                    e.dataTransfer.effectAllowed = "move";
                    setDragId(task.id);
                  }}
                  onDragEnd={() => {
                    setDragId(null);
                    setOverCol(null);
                  }}
                  className={cn(
                    "cursor-grab rounded-xl border border-slate-200 bg-white p-3 shadow-sm active:cursor-grabbing",
                    dragId === task.id && "opacity-50",
                  )}
                >
                  <div className="flex items-start justify-between gap-1">
                    <TaskLink
                      taskId={task.id}
                      draggable={false}
                      className="text-sm font-medium leading-snug text-slate-900 hover:text-blue-600 hover:underline"
                    >
                      {task.title}
                    </TaskLink>
                    <button
                      type="button"
                      draggable={false}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        removeTask(task.id);
                      }}
                      className="shrink-0 text-slate-300 hover:text-red-500"
                      aria-label="Delete task"
                      title="Delete task"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", quadTone[quad])}>{quad}</span>
                    {task.kpiName && (
                      <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
                        {task.kpiName}
                      </span>
                    )}
                    {task.sizeLabel && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                        {task.sizeLabel.toLowerCase()}
                      </span>
                    )}
                    {task.reviewRequired && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">review</span>
                    )}
                    {task.carryCount > 0 && (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
                        ↻ carried {task.carryCount}×
                      </span>
                    )}
                    {task.reworkCount > 0 && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                        ↩ reworked {task.reworkCount}×
                      </span>
                    )}
                    {task.delegatedBy && (
                      <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                        ↪ {task.delegatedBy}
                      </span>
                    )}
                    {!!task.checklistTotal && (
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium",
                          task.checklistDone === task.checklistTotal
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-100 text-slate-600",
                        )}
                      >
                        ☑ {task.checklistDone}/{task.checklistTotal}
                      </span>
                    )}
                  </div>

                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                    {task.projectName && <span>📁 {task.projectName}</span>}
                    {task.estimatedMins != null && <span>⏱ {task.estimatedMins}m</span>}
                    {task.dueAt && <span>📅 {new Date(task.dueAt).toLocaleDateString()}</span>}
                  </div>

                  {task.status === "ON_HOLD" && task.holdReason && (
                    <div className="mt-2 rounded-md bg-amber-50 px-2 py-1 text-[11px] text-amber-700">
                      On hold: {task.holdReason}
                    </div>
                  )}

                  {/* Fallback for touch / no-drag: the Move-to dropdown still works */}
                  <MoveControl taskId={task.id} status={task.status} />
                </div>
              );
            })}
            {!grouped[status].length && (
              <div className="py-6 text-center text-xs text-slate-400">
                {overCol === status ? "Drop here" : "—"}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
      {confirmDeleteId && (
        <div 
          className="fixed inset-0 z-[100] grid place-items-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in"
          onClick={() => setConfirmDeleteId(null)}
        >
          <div 
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl animate-pop-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-red-600 mb-3">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-red-50">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Delete Task</h3>
                <p className="text-xs text-slate-500">Confirm task removal</p>
              </div>
            </div>
            
            <p className="text-sm text-slate-600 mb-4 leading-relaxed">
              Are you sure you want to move this task to Deleted Tasks? You can restore it any time.
            </p>

            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="rounded-lg border border-slate-300 px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={confirmRemoveTask}
                className="rounded-lg bg-red-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {pending ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
