import { priorityQuadrant } from "@/lib/constants";

export type DailyTaskItem = {
  id: string;
  title: string;
  status: string;
  priority: string;
  priorityTone: string;
  kpiName: string | null;
  sizeLabel: string | null;
  estimatedMins: number | null;
  dueAt: string | null;
  completedAt: string | null;
  isOnTime: boolean | null;
  reworkCount: number;
  rejectionReason: string | null;
  holdReason: string | null;
  carryCount: number;
  wasActiveThatDay: boolean;
  createdThatDay: boolean;
  completedThatDay: boolean;
  dueThatDay: boolean;
  overdueThatDay: boolean;
};

export type PersonDailyReport = {
  employee: {
    id: string;
    name: string;
    email?: string;
    avatarUrl?: string | null;
    roleTitle: string;
    departmentName: string;
    managerName: string;
  };
  ritual: {
    morningPlanned: boolean;
    eveningClosed: boolean;
    reflection: string | null;
    plannedTasksCount: number;
  };
  metrics: {
    closedToday: number;
    inProgressToday: number;
    overdueCount: number;
    reworkCount: number;
    onTimeRate: number | null; // percentage
    plannedMinutes: number; // planned task workload
    totalEstimatedMins: number; // backward compatibility
    kpisTouched: string[];
  };
  status: "ON_TRACK" | "IN_PROGRESS" | "ATTENTION" | "NO_ACTIVITY";
  statusLabel: string;
  statusTone: string;
  tasks: DailyTaskItem[];
};

export type DailyReportSummary = {
  dateValue: string; // YYYY-MM-DD
  dateLabel: string; // e.g. "Saturday, 26 Sep 2026"
  isToday: boolean;
  totalEmployees: number;
  reportedEmployeesCount: number;
  totalClosedToday: number;
  totalOpenToday: number;
  overallOnTimeRate: number;
  attentionCount: number;
  noActivityCount: number;
  departmentCounts: Record<string, number>;
  departments: string[];
  reports: PersonDailyReport[];
  viewScope?: "COMPANY" | "TEAM" | "SELF";
};

export type TaskDailyState = {
  taskId: string;
  wasActiveThatDay: boolean;
  statusAtEndOfDay: string | null;
  createdThatDay: boolean;
  completedThatDay: boolean;
  dueThatDay: boolean;
  overdueThatDay: boolean;
  reworkedThatDay: boolean;
  carriedThatDay: boolean;
  plannedThatDay: boolean;
  checklistTickedThatDay: boolean;
  commentedThatDay: boolean;
  isOnTime: boolean | null;
  rejectionReason: string | null;
  holdReason: string | null;
  relevantForDay: boolean;
};

export function toDate(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val.toDate === "function") {
    const d = val.toDate();
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof val === "object" && typeof val._seconds === "number") {
    return new Date(val._seconds * 1000 + Math.round((val._nanoseconds || 0) / 1e6));
  }
  const parsed = new Date(val);
  return isNaN(parsed.getTime()) ? null : parsed;
}

export const QUAD_TONE: Record<string, string> = {
  "Do First": "bg-red-100 text-red-700",
  Schedule: "bg-blue-100 text-blue-700",
  Delegate: "bg-amber-100 text-amber-700",
  Eliminate: "bg-slate-100 text-slate-500",
};

/**
 * Pure evaluation function that reconstructs what actually occurred for a task on a specific calendar date.
 * Does NOT rely on future state (e.g. if closed later, does not show CLOSED on a past date).
 */
export function getTaskDailyState(
  task: any,
  taskAuditLogs: any[] = [],
  taskChecklistItems: any[] = [],
  ritualData: any | null = null,
  dayStart: Date,
  dayEnd: Date,
  isToday: boolean,
  now: Date = new Date()
): TaskDailyState {
  const createdAt = toDate(task.createdAt);
  const completedAt = toDate(task.completedAt);
  const dueAt = toDate(task.dueAt);
  const deletedAt = toDate(task.deletedAt);
  const rejectedAt = toDate(task.rejectedAt);
  const carryDate = toDate(task.carryForwardDate);

  // 1. If created strictly AFTER dayEnd, this task did NOT exist on this date.
  if (createdAt && createdAt.getTime() > dayEnd.getTime()) {
    return {
      taskId: task.id,
      wasActiveThatDay: false,
      statusAtEndOfDay: null,
      createdThatDay: false,
      completedThatDay: false,
      dueThatDay: false,
      overdueThatDay: false,
      reworkedThatDay: false,
      carriedThatDay: false,
      plannedThatDay: false,
      checklistTickedThatDay: false,
      commentedThatDay: false,
      isOnTime: null,
      rejectionReason: null,
      holdReason: null,
      relevantForDay: false,
    };
  }

  // 2. If soft-deleted strictly BEFORE dayStart, omit completely.
  if (deletedAt && deletedAt.getTime() < dayStart.getTime()) {
    return {
      taskId: task.id,
      wasActiveThatDay: false,
      statusAtEndOfDay: null,
      createdThatDay: false,
      completedThatDay: false,
      dueThatDay: false,
      overdueThatDay: false,
      reworkedThatDay: false,
      carriedThatDay: false,
      plannedThatDay: false,
      checklistTickedThatDay: false,
      commentedThatDay: false,
      isOnTime: null,
      rejectionReason: null,
      holdReason: null,
      relevantForDay: false,
    };
  }

  // 3. Date-specific event flags
  const createdThatDay = !!(createdAt && createdAt >= dayStart && createdAt <= dayEnd);

  // Check if completed on this date
  const completedThatDay = !!(
    (completedAt && completedAt >= dayStart && completedAt <= dayEnd) ||
    taskAuditLogs.some((l) => {
      const logDate = toDate(l.createdAt);
      return (
        logDate &&
        logDate >= dayStart &&
        logDate <= dayEnd &&
        (l.action === "task.complete" || (l.action === "task.move" && String(l.detail || "").startsWith("CLOSED")))
      );
    })
  );

  // Due on this date (only if not already completed/deleted prior to dayStart)
  const dueThatDay = !!(
    dueAt &&
    dueAt >= dayStart &&
    dueAt <= dayEnd &&
    (!completedAt || completedAt.getTime() >= dayStart.getTime()) &&
    (!deletedAt || deletedAt.getTime() >= dayStart.getTime())
  );

  // Morning ritual planned check
  let plannedThatDay = false;
  if (ritualData?.plannedTaskIds) {
    try {
      const parsed =
        typeof ritualData.plannedTaskIds === "string"
          ? JSON.parse(ritualData.plannedTaskIds)
          : ritualData.plannedTaskIds;
      if (Array.isArray(parsed) && parsed.includes(task.id)) {
        plannedThatDay = true;
      }
    } catch {}
  }

  // Checklist items ticked on this date
  const checklistTickedThatDay = taskChecklistItems.some((item) => {
    const doneAt = toDate(item.doneAt);
    return doneAt && doneAt >= dayStart && doneAt <= dayEnd;
  });

  // Audit events on this date
  const logsOnThatDate = taskAuditLogs.filter((l) => {
    const logDate = toDate(l.createdAt);
    return logDate && logDate >= dayStart && logDate <= dayEnd;
  });

  const commentedThatDay = logsOnThatDate.some(
    (l) => l.action === "task.comment" || l.action === "task.reply"
  );

  // Rework on this date (rejection / reopen event occurred on that date)
  const reworkedThatDay = !!(
    (rejectedAt && rejectedAt >= dayStart && rejectedAt <= dayEnd) ||
    logsOnThatDate.some(
      (l) => l.action === "task.reject" || (l.action === "task.move" && l.detail === "REOPENED")
    )
  );

  // Carry forward on this date
  const carriedThatDay = !!(
    (carryDate && carryDate >= dayStart && carryDate <= dayEnd) ||
    logsOnThatDate.some((l) => l.action === "task.autoCarryForward")
  );

  // 4. Historical Status Reconstruction at End of Day:
  let statusAtEndOfDay: string = "TODO";
  let rejectionReasonForDay: string | null = null;
  let holdReasonForDay: string | null = null;

  if (isToday) {
    statusAtEndOfDay = task.status || "TODO";
    rejectionReasonForDay = task.rejectionReason || null;
    holdReasonForDay = task.holdReason || null;
  } else {
    // Filter status-changing audit logs up to dayEnd
    const statusLogsUpToDayEnd = taskAuditLogs
      .filter((l) => {
        const logDate = toDate(l.createdAt);
        return (
          logDate &&
          logDate <= dayEnd &&
          ["task.move", "task.reject", "task.create", "task.complete"].includes(l.action)
        );
      })
      .sort((a, b) => (toDate(a.createdAt)?.getTime() || 0) - (toDate(b.createdAt)?.getTime() || 0));

    if (statusLogsUpToDayEnd.length > 0) {
      const lastLog = statusLogsUpToDayEnd[statusLogsUpToDayEnd.length - 1];
      if (lastLog.action === "task.reject") {
        statusAtEndOfDay = "REOPENED";
        rejectionReasonForDay = lastLog.detail || task.rejectionReason || null;
      } else if (lastLog.action === "task.complete") {
        statusAtEndOfDay = "CLOSED";
      } else if (lastLog.action === "task.create") {
        statusAtEndOfDay = "TODO";
      } else if (lastLog.action === "task.move") {
        const rawDetail = String(lastLog.detail || "").trim();
        if (rawDetail.startsWith("CLOSED")) {
          statusAtEndOfDay = "CLOSED";
        } else if (rawDetail.startsWith("PENDING_REVIEW")) {
          statusAtEndOfDay = "PENDING_REVIEW";
        } else if (rawDetail.startsWith("ON_HOLD")) {
          statusAtEndOfDay = "ON_HOLD";
          const match = rawDetail.match(/\((.*)\)/);
          holdReasonForDay = match ? match[1] : task.holdReason || null;
        } else if (rawDetail.startsWith("REOPENED")) {
          statusAtEndOfDay = "REOPENED";
          rejectionReasonForDay = task.rejectionReason || null;
        } else if (rawDetail.startsWith("IN_PROGRESS")) {
          statusAtEndOfDay = "IN_PROGRESS";
        } else if (rawDetail.startsWith("TODO")) {
          statusAtEndOfDay = "TODO";
        } else {
          statusAtEndOfDay = rawDetail || "TODO";
        }
      }
    } else {
      // Fallback if no audit logs exist before dayEnd
      if (completedAt && completedAt <= dayEnd) {
        statusAtEndOfDay = "CLOSED";
      } else {
        statusAtEndOfDay = "TODO";
      }
    }
  }

  const isClosedAtEndOfDay = statusAtEndOfDay === "CLOSED";

  // 5. Overdue on this date:
  // Due before dayStart, task created on or before dayEnd, not completed on or before dayEnd, and not closed at end of day
  const overdueThatDay = !!(
    dueAt &&
    dueAt.getTime() < dayStart.getTime() &&
    (!completedAt || completedAt.getTime() > dayEnd.getTime()) &&
    !isClosedAtEndOfDay &&
    (!deletedAt || deletedAt.getTime() > dayEnd.getTime())
  );

  // 6. Was active that day:
  const wasActiveThatDay = !!(
    createdThatDay ||
    completedThatDay ||
    reworkedThatDay ||
    carriedThatDay ||
    plannedThatDay ||
    checklistTickedThatDay ||
    commentedThatDay ||
    logsOnThatDate.length > 0 ||
    (isToday && (statusAtEndOfDay === "IN_PROGRESS" || statusAtEndOfDay === "PENDING_REVIEW"))
  );

  // 7. Timeliness evaluation for the date
  let isOnTime: boolean | null = null;
  if (completedThatDay) {
    if (dueAt && completedAt) {
      isOnTime = completedAt.getTime() <= dueAt.getTime();
    } else if (!dueAt) {
      isOnTime = true;
    }
  } else if (overdueThatDay) {
    isOnTime = false;
  } else if (dueThatDay) {
    if (isToday) {
      isOnTime = dueAt.getTime() < now.getTime() ? false : null;
    } else {
      isOnTime = isClosedAtEndOfDay ? true : false;
    }
  }

  // 8. Relevant for this date
  const relevantForDay = !!(
    wasActiveThatDay ||
    createdThatDay ||
    completedThatDay ||
    dueThatDay ||
    overdueThatDay ||
    reworkedThatDay ||
    carriedThatDay ||
    plannedThatDay
  );

  return {
    taskId: task.id,
    wasActiveThatDay,
    statusAtEndOfDay,
    createdThatDay,
    completedThatDay,
    dueThatDay,
    overdueThatDay,
    reworkedThatDay,
    carriedThatDay,
    plannedThatDay,
    checklistTickedThatDay,
    commentedThatDay,
    isOnTime,
    rejectionReason: rejectionReasonForDay,
    holdReason: holdReasonForDay,
    relevantForDay,
  };
}
