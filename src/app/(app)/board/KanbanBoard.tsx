"use client";

import { useState, useTransition, useEffect, useRef } from "react";
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
  kpiPoints?: { earnedPoints: number; maxPoints: number } | null;
  projectName: string | null;
  delegatedBy: string | null;
  checklistTotal?: number;
  checklistDone?: number;
  managerScore?: number | null;
  concernedContact?: string | null;
  rejectionReason?: string | null;
};

export function getTaskVisuals(task: {
  status: string;
  dueAt: string | Date | null;
  reworkCount?: number;
  carryCount?: number;
}, now: number) {
  const isClosed = task.status === "CLOSED";
  const isOnHold = task.status === "ON_HOLD";
  const isPendingReview = task.status === "PENDING_REVIEW";
  const isRework = task.status === "REOPENED" || (task.reworkCount != null && task.reworkCount > 0);

  let delayState: "overdue" | "slightly_delayed" | "due_soon" | null = null;
  let overdueDays = 0;

  if (!isClosed && task.dueAt && now > 0) {
    const dueTime = typeof task.dueAt === "string" ? new Date(task.dueAt).getTime() : task.dueAt.getTime();
    if (!isNaN(dueTime)) {
      const diffMs = dueTime - now;
      const diffHours = diffMs / (1000 * 60 * 60);

      if (diffHours < -24) {
        delayState = "overdue";
        overdueDays = Math.max(1, Math.floor(Math.abs(diffHours) / 24));
      } else if (diffHours < 0) {
        delayState = "slightly_delayed";
      } else if (diffHours <= 4) {
        delayState = "due_soon";
      }
    }
  }

  // Determine card styles and left accent border
  let cardStyles = "border-slate-200 bg-white hover:border-slate-300";
  let borderLeft = "border-l-4 border-l-slate-300";

  if (isClosed) {
    cardStyles = "border-slate-200 bg-slate-50/70";
    borderLeft = "border-l-4 border-l-emerald-500";
  } else if (delayState === "overdue") {
    cardStyles = "border-rose-300 bg-rose-50/40 shadow-sm shadow-rose-100/50";
    borderLeft = "border-l-4 border-l-rose-500";
  } else if (delayState === "slightly_delayed") {
    cardStyles = "border-amber-300 bg-amber-50/50 shadow-sm shadow-amber-100/50";
    borderLeft = "border-l-4 border-l-amber-500";
  } else if (isRework) {
    cardStyles = "border-orange-300 bg-orange-50/40 shadow-sm shadow-orange-100/50";
    borderLeft = "border-l-4 border-l-orange-500";
  } else if (isOnHold) {
    cardStyles = "border-amber-200 bg-amber-50/30";
    borderLeft = "border-l-4 border-l-amber-400";
  } else if (isPendingReview) {
    cardStyles = "border-violet-200 bg-violet-50/30";
    borderLeft = "border-l-4 border-l-violet-500";
  } else if (delayState === "due_soon") {
    cardStyles = "border-yellow-200 bg-yellow-50/30";
    borderLeft = "border-l-4 border-l-yellow-400";
  } else {
    const colLeftColor: Record<string, string> = {
      NEW: "border-l-slate-400",
      ACCEPTED: "border-l-sky-400",
      IN_PROGRESS: "border-l-blue-500",
    };
    borderLeft = `border-l-4 ${colLeftColor[task.status] || "border-l-slate-300"}`;
  }

  return {
    delayState,
    overdueDays,
    isRework,
    cardStyles,
    borderLeft,
  };
}

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

/** Locale-safe date formatter — avoids SSR/client hydration mismatches. */
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

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
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const container = scrollContainerRef.current;
    if (!container) return;

    const { clientX } = e;
    const { left, right } = container.getBoundingClientRect();

    const edgeSize = 120; // Scrolling activation zone width
    const maxSpeed = 16;  // Max scrolling velocity

    if (clientX < left + edgeSize) {
      const ratio = (left + edgeSize - clientX) / edgeSize;
      container.scrollLeft -= ratio * maxSpeed;
    } else if (clientX > right - edgeSize) {
      const ratio = (clientX - (right - edgeSize)) / edgeSize;
      container.scrollLeft += ratio * maxSpeed;
    }
  }

  // Hold-reason modal state
  const [holdModal, setHoldModal] = useState<{ taskId: string; newStatus: string } | null>(null);
  const [holdInput, setHoldInput] = useState("");
  const [holdError, setHoldError] = useState("");
  // Error toast state
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [now, setNow] = useState<number>(0);

  useEffect(() => {
    setTasks(initialTasks);
    setNow(Date.now());
  }, [initialTasks]);

  function colOf(status: string) {
    return columns.includes(status) ? status : "NEW";
  }

  async function applyMove(taskId: string, newStatus: string, holdReason?: string) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || colOf(task.status) === newStatus) return;

    if (newStatus === "ON_HOLD" && !holdReason) {
      // Open the custom hold-reason modal instead of window.prompt
      setHoldInput("");
      setHoldError("");
      setHoldModal({ taskId, newStatus });
      return;
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
        // revert the optimistic move and show an inline error toast
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, status: prevStatus, holdReason: prevHoldReason } : t)),
        );
        setErrorMsg(res.error);
        setTimeout(() => setErrorMsg(null), 4000);
        return;
      }
      router.refresh();
    });
  }

  function submitHoldReason() {
    if (!holdModal) return;
    if (!holdInput.trim()) {
      setHoldError("A reason is required.");
      return;
    }
    const { taskId, newStatus } = holdModal;
    setHoldModal(null);
    applyMove(taskId, newStatus, holdInput.trim());
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
      <div
        ref={scrollContainerRef}
        onDragOver={handleDragOver}
        className="flex gap-4 overflow-x-auto scroll-thin pb-4"
      >
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
              const visuals = getTaskVisuals(task, now);
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
                    "cursor-grab rounded-xl border p-3 shadow-sm transition-all active:cursor-grabbing",
                    visuals.cardStyles,
                    visuals.borderLeft,
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

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", quadTone[quad])}>{quad}</span>

                    {/* Delay & Urgency Badges */}
                    {visuals.delayState === "overdue" && (
                      <span className="rounded-full bg-rose-100 border border-rose-300 px-2 py-0.5 text-xs font-semibold text-rose-800 inline-flex items-center gap-1 shadow-xs">
                        🚨 Delayed ({visuals.overdueDays}d)
                      </span>
                    )}
                    {visuals.delayState === "slightly_delayed" && (
                      <span className="rounded-full bg-amber-100 border border-amber-300 px-2 py-0.5 text-xs font-semibold text-amber-800 inline-flex items-center gap-1 shadow-xs">
                        ⚠️ Slightly Delayed
                      </span>
                    )}
                    {visuals.delayState === "due_soon" && (
                      <span className="rounded-full bg-yellow-100 border border-yellow-300 px-2 py-0.5 text-xs font-medium text-yellow-800 inline-flex items-center gap-1">
                        ⏰ Due Soon
                      </span>
                    )}

                    {/* Rework Badge */}
                    {visuals.isRework && (
                      <span className="rounded-full bg-orange-100 border border-orange-300 px-2 py-0.5 text-xs font-semibold text-orange-800 inline-flex items-center gap-1">
                        ↩️ Rework{task.reworkCount > 0 ? ` (${task.reworkCount}×)` : ""}
                      </span>
                    )}

                    {/* Status Badge */}
                    {task.status === "PENDING_REVIEW" && (
                      <span className="rounded-full bg-violet-100 border border-violet-200 px-2 py-0.5 text-xs font-semibold text-violet-800">
                        👀 Under Review
                      </span>
                    )}

                    {task.kpiName && (
                      <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
                        {task.kpiName}
                      </span>
                    )}
                    {task.kpiPoints && (
                      <span className="rounded-full bg-violet-600 text-white px-2 py-0.5 text-xs font-semibold inline-flex items-center gap-0.5">
                        ⭐ {task.kpiPoints.earnedPoints} pts
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
                    {task.managerScore != null && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800" title={`Quality score: ${task.managerScore}%`}>
                        🏅 {task.managerScore}%
                      </span>
                    )}
                    {task.carryCount > 0 && (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
                        ↻ carried {task.carryCount}×
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

                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                    {task.projectName && <span>📁 {task.projectName}</span>}
                    {task.estimatedMins != null && <span>⏱ {task.estimatedMins}m</span>}
                    {task.dueAt && <span>📅 {fmtDate(task.dueAt)}</span>}
                    {task.concernedContact && (
                      <span className="font-medium text-slate-700 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-[11px] inline-flex items-center gap-1">
                        👤 Contact: {task.concernedContact}
                      </span>
                    )}
                  </div>

                  {task.status === "ON_HOLD" && task.holdReason && (
                    <div className="mt-2 rounded-md bg-amber-50 border border-amber-200 px-2 py-1 text-[11px] text-amber-800">
                      <span className="font-medium">On hold:</span> {task.holdReason}
                    </div>
                  )}

                  {task.rejectionReason && task.status !== "CLOSED" && (
                    <div className="mt-2 rounded-md bg-rose-50 border border-rose-200 px-2 py-1 text-[11px] text-rose-800">
                      <span className="font-semibold">Rejection note:</span> {task.rejectionReason}
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

      {/* ── Hold-Reason Modal ── */}
      {holdModal && (
        <div
          className="fixed inset-0 z-[110] grid place-items-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => setHoldModal(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-amber-50 text-amber-600">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Put Task On Hold</h3>
                <p className="text-xs text-slate-500">Please provide a reason</p>
              </div>
            </div>

            <label className="block text-xs font-medium text-slate-700 mb-1">
              Reason <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              autoFocus
              value={holdInput}
              onChange={(e) => { setHoldInput(e.target.value); setHoldError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") submitHoldReason(); if (e.key === "Escape") setHoldModal(null); }}
              placeholder="e.g. Waiting for client approval…"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
            />
            {holdError && <p className="mt-1 text-xs text-red-500">{holdError}</p>}

            <div className="mt-4 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setHoldModal(null)}
                className="rounded-lg border border-slate-300 px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitHoldReason}
                className="rounded-lg bg-amber-500 px-3.5 py-2 text-xs font-medium text-white hover:bg-amber-600"
              >
                Confirm Hold
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Error Toast ── */}
      {errorMsg && (
        <div className="fixed bottom-6 left-1/2 z-[120] -translate-x-1/2 rounded-xl bg-red-600 px-4 py-3 text-sm text-white shadow-xl flex items-center gap-3">
          <AlertTriangle size={16} />
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="ml-2 text-white/70 hover:text-white text-lg leading-none">×</button>
        </div>
      )}
    </>
  );
}
