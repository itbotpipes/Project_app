import { adminDb } from "@/lib/firebase/admin";
import { fetchAllRoles, fetchAllDepartments, fetchKpiTemplatesByRole } from "@/lib/cache";
import { priorityQuadrant } from "@/lib/constants";
import { canScoreCompanyWide, isManagerLike, hasPermission } from "@/lib/auth";
import { getReportRange, type DateRangeInput, type DateRangeResult } from "./dateRanges";
import { getTaskDailyState, toDate, QUAD_TONE } from "./dailyReportState";

export type TaskReportItem = {
  id: string;
  title: string;
  status: string;
  priority: string;
  priorityTone: string;
  kpiId: string | null;
  kpiName: string;
  sizeLabel: string | null;
  estimatedMins: number | null;
  createdAt: string | null;
  dueAt: string | null;
  completedAt: string | null;
  isOnTime: boolean | null;
  reworkCount: number;
  carryCount: number;
  rejectionReason: string | null;
  holdReason: string | null;
  wasActiveInRange: boolean;
};

export type KpiUsageDetail = {
  kpiId: string;
  kpiName: string;
  totalTasks: number;
  usagePct: number; // e.g. 33.3%
  completedTasks: number;
  completionRate: number; // e.g. 85.7%
  onTimeTasks: number;
  onTimeRate: number; // e.g. 83.3%
  reworkTasks: number;
  carryTasks: number;
  plannedMinutes: number;
  tasks: TaskReportItem[];
};

export type TrendBucket = {
  label: string;
  subLabel?: string;
  created: number;
  completed: number;
  overdue: number;
};

export type EmployeeTaskReportData = {
  employee: {
    id: string;
    name: string;
    email?: string;
    avatarUrl?: string | null;
    roleTitle: string;
    departmentName: string;
    managerName: string;
    roleId?: string;
  };
  range: {
    rangeType: string;
    startDate: string;
    endDate: string;
    label: string;
    subLabel?: string;
    dateParam: string;
    fromParam?: string;
    toParam?: string;
    prevParams: Record<string, string>;
    nextParams: Record<string, string>;
  };
  summaryCards: {
    totalTasks: number;
    completedTasks: number;
    completionRate: number;
    onTimeCompletedTasks: number;
    onTimeRate: number | null;
    activeTasks: number;
    reworkTasks: number;
    reworkRate: number;
    carryTasks: number;
    carryRate: number;
    plannedMinutes: number;
    plannedHours: number;
  };
  qualityExplanations: {
    completion: {
      rate: number;
      formula: string;
      description: string;
    };
    onTime: {
      rate: number | null;
      formula: string;
      description: string;
    };
    rework: {
      rate: number;
      formula: string;
      description: string;
    };
    carry: {
      rate: number;
      formula: string;
      description: string;
    };
  };
  kpiUsage: KpiUsageDetail[];
  mostUsedKpi: KpiUsageDetail | null;
  leastUsedKpi: KpiUsageDetail | null;
  statusBreakdown: Array<{
    status: string;
    label: string;
    count: number;
    pct: number;
    tone: string;
  }>;
  activityTrend: TrendBucket[];
  workInsights: string[];
  tasks: TaskReportItem[];
  viewerCanScore: boolean;
};

/**
 * Deep serializer to plain JSON objects for Server-to-Client Component passing.
 */
function toPlainObject<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Loads the complete task report and KPI work analysis for an employee across any date range.
 */
export async function loadEmployeeTaskReport(
  employeeId: string,
  rangeInput: DateRangeInput = {},
  viewerUser?: any
): Promise<EmployeeTaskReportData | null> {
  // ── 1. Permission Verification ───────────────────────────────────────────
  const [empDoc, rolesSnap, departmentsSnap, allEmpsSnap] = await Promise.all([
    adminDb.collection("Employee").doc(employeeId).get(),
    fetchAllRoles(adminDb),
    fetchAllDepartments(adminDb),
    adminDb.collection("Employee").get(),
  ]);

  if (!empDoc.exists) return null;
  const empData = { id: empDoc.id, ...empDoc.data() } as any;

  if (viewerUser) {
    const isCompanyWide =
      canScoreCompanyWide(viewerUser) ||
      hasPermission(viewerUser, "scores") ||
      hasPermission(viewerUser, "admin");

    const isDirectManager =
      (Array.isArray(empData.reportsToIds) && empData.reportsToIds.includes(viewerUser.id)) ||
      empData.reportsToId === viewerUser.id ||
      viewerUser.id === employeeId;

    const isMgr = isManagerLike(viewerUser.systemRole, viewerUser.systemRoleObj) || hasPermission(viewerUser, "team");

    const allowed = isCompanyWide || (isMgr && isDirectManager) || viewerUser.id === employeeId;
    if (!allowed) {
      return null;
    }
  }

  // ── 2. Calculate Date Range Boundaries ────────────────────────────────────
  const rangeResult = getReportRange(rangeInput);
  const { startDate, endDate, rangeType, label, subLabel, dateParam, fromParam, toParam, prevParams, nextParams } = rangeResult;

  const now = new Date();
  const rangeIncludesToday = now.getTime() >= startDate.getTime() && now.getTime() <= endDate.getTime();

  // ── 3. Resolve Metadata: Roles, Departments, Manager, KPI Templates ───────
  const rolesMap = new Map<string, any>();
  rolesSnap.docs?.forEach((d: any) => rolesMap.set(d.id, d.data()));

  const deptsMap = new Map<string, any>();
  departmentsSnap.docs?.forEach((d: any) => deptsMap.set(d.id, d.data().name));

  const allEmpsMap = new Map<string, any>();
  allEmpsSnap.docs?.forEach((d: any) => allEmpsMap.set(d.id, d.data().name));

  const role = empData.roleId ? rolesMap.get(empData.roleId) : null;
  const roleTitle = role?.title || "Team Member";
  const departmentName = role?.departmentId ? deptsMap.get(role.departmentId) || "General" : "General";

  const mgrIds = Array.isArray(empData.reportsToIds) ? empData.reportsToIds : empData.reportsToId ? [empData.reportsToId] : [];
  const mgrNames = mgrIds.map((id: string) => allEmpsMap.get(id)).filter(Boolean);
  const managerName = mgrNames.length > 0 ? mgrNames.join(", ") : "—";

  // Preload KPI templates
  const [allKpisSnap, roleKpisSnap] = await Promise.all([
    adminDb.collection("KpiTemplate").get(),
    empData.roleId ? fetchKpiTemplatesByRole(empData.roleId, adminDb) : Promise.resolve({ docs: [] } as any),
  ]);

  const kpisMap = new Map<string, string>();
  allKpisSnap.docs?.forEach((d: any) => kpisMap.set(d.id, d.data().kpiName));

  // ── 4. Query Tasks for Employee intersecting the Date Range ───────────────
  const [allAssigneeTasksSnap, openTasksSnap] = await Promise.all([
    adminDb.collection("Task")
      .where("assigneeId", "==", employeeId)
      .where("createdAt", "<=", endDate)
      .get(),
    rangeIncludesToday
      ? adminDb.collection("Task")
          .where("assigneeId", "==", employeeId)
          .where("status", "!=", "CLOSED")
          .get()
      : Promise.resolve({ docs: [] } as any),
  ]);

  const rawTasksMap = new Map<string, any>();
  for (const doc of allAssigneeTasksSnap.docs || []) {
    rawTasksMap.set(doc.id, { id: doc.id, ...doc.data() });
  }
  for (const doc of openTasksSnap.docs || []) {
    if (!rawTasksMap.has(doc.id)) {
      rawTasksMap.set(doc.id, { id: doc.id, ...doc.data() });
    }
  }

  // Parallel fetch audit logs for these tasks up to endDate for point-in-time status
  const logsByTaskId = new Map<string, any[]>();
  const taskIdsList = Array.from(rawTasksMap.keys());

  if (taskIdsList.length > 0) {
    const chunks = [];
    for (let i = 0; i < taskIdsList.length; i += 30) {
      chunks.push(taskIdsList.slice(i, i + 30));
    }

    const historySnaps = await Promise.all(
      chunks.map((c) =>
        adminDb.collection("AuditLog")
          .where("entity", "==", "Task")
          .where("entityId", "in", c)
          .get()
      )
    );

    for (const snap of historySnaps) {
      for (const doc of snap.docs || []) {
        const l = doc.data();
        const taskId = l.entityId;
        if (taskId) {
          if (!logsByTaskId.has(taskId)) logsByTaskId.set(taskId, []);
          const existing = logsByTaskId.get(taskId)!;
          if (!existing.some((e) => e.id === doc.id || (e.createdAt?.seconds === l.createdAt?.seconds && e.action === l.action))) {
            existing.push({ id: doc.id, ...l });
          }
        }
      }
    }
  }

  // ── 5. Evaluate and Filter Tasks for the Selected Period ──────────────────
  const periodTasks: TaskReportItem[] = [];
  const rawTasks = Array.from(rawTasksMap.values());

  for (const t of rawTasks) {
    const createdAt = toDate(t.createdAt);
    const completedAt = toDate(t.completedAt);
    const dueAt = toDate(t.dueAt);
    const deletedAt = toDate(t.deletedAt);
    const rejectedAt = toDate(t.rejectedAt);
    const carryDate = toDate(t.carryForwardDate);
    const taskLogs = logsByTaskId.get(t.id) || [];

    // Guard: Exclude tasks created after endDate
    if (createdAt && createdAt.getTime() > endDate.getTime()) continue;

    // Guard: Exclude tasks soft-deleted before startDate
    if (deletedAt && deletedAt.getTime() < startDate.getTime()) continue;

    const createdInRange = !!(createdAt && createdAt >= startDate && createdAt <= endDate);
    const completedInRange = !!(completedAt && completedAt >= startDate && completedAt <= endDate);
    const dueInRange = !!(dueAt && dueAt >= startDate && dueAt <= endDate);

    // Audit activity in range
    const logsInRange = taskLogs.filter((l) => {
      const logDate = toDate(l.createdAt);
      return logDate && logDate >= startDate && logDate <= endDate;
    });

    const reworkedInRange = !!(
      (rejectedAt && rejectedAt >= startDate && rejectedAt <= endDate) ||
      logsInRange.some((l) => l.action === "task.reject" || (l.action === "task.move" && l.detail === "REOPENED"))
    );

    const carriedInRange = !!(
      (carryDate && carryDate >= startDate && carryDate <= endDate) ||
      logsInRange.some((l) => l.action === "task.autoCarryForward")
    );

    // Historical status at end of period
    let statusAtEndOfPeriod = "TODO";
    let rejectionReasonForPeriod = t.rejectionReason || null;
    let holdReasonForPeriod = t.holdReason || null;

    if (rangeIncludesToday) {
      statusAtEndOfPeriod = t.status || "TODO";
    } else {
      const statusLogsUpToEnd = taskLogs
        .filter((l) => {
          const logDate = toDate(l.createdAt);
          return logDate && logDate <= endDate && ["task.move", "task.reject", "task.create", "task.complete"].includes(l.action);
        })
        .sort((a, b) => (toDate(a.createdAt)?.getTime() || 0) - (toDate(b.createdAt)?.getTime() || 0));

      if (statusLogsUpToEnd.length > 0) {
        const lastLog = statusLogsUpToEnd[statusLogsUpToEnd.length - 1];
        if (lastLog.action === "task.reject") {
          statusAtEndOfPeriod = "REOPENED";
          rejectionReasonForPeriod = lastLog.detail || t.rejectionReason || null;
        } else if (lastLog.action === "task.complete") {
          statusAtEndOfPeriod = "CLOSED";
        } else if (lastLog.action === "task.create") {
          statusAtEndOfPeriod = "TODO";
        } else if (lastLog.action === "task.move") {
          const rawDetail = String(lastLog.detail || "").trim();
          if (rawDetail.startsWith("CLOSED")) {
            statusAtEndOfPeriod = "CLOSED";
          } else if (rawDetail.startsWith("PENDING_REVIEW")) {
            statusAtEndOfPeriod = "PENDING_REVIEW";
          } else if (rawDetail.startsWith("ON_HOLD")) {
            statusAtEndOfPeriod = "ON_HOLD";
            const match = rawDetail.match(/\((.*)\)/);
            holdReasonForPeriod = match ? match[1] : t.holdReason || null;
          } else if (rawDetail.startsWith("REOPENED")) {
            statusAtEndOfPeriod = "REOPENED";
            rejectionReasonForPeriod = t.rejectionReason || null;
          } else if (rawDetail.startsWith("IN_PROGRESS")) {
            statusAtEndOfPeriod = "IN_PROGRESS";
          } else if (rawDetail.startsWith("TODO")) {
            statusAtEndOfPeriod = "TODO";
          } else {
            statusAtEndOfPeriod = rawDetail || "TODO";
          }
        }
      } else {
        if (completedAt && completedAt <= endDate) {
          statusAtEndOfPeriod = "CLOSED";
        } else {
          statusAtEndOfPeriod = "TODO";
        }
      }
    }

    const wasActiveInRange = !!(
      createdInRange ||
      completedInRange ||
      reworkedInRange ||
      carriedInRange ||
      logsInRange.length > 0 ||
      (rangeIncludesToday && (statusAtEndOfPeriod === "IN_PROGRESS" || statusAtEndOfPeriod === "PENDING_REVIEW"))
    );

    const isOverdueInRange = !!(
      dueAt &&
      dueAt.getTime() <= endDate.getTime() &&
      (!completedAt || completedAt.getTime() > endDate.getTime()) &&
      statusAtEndOfPeriod !== "CLOSED" &&
      (!deletedAt || deletedAt.getTime() > endDate.getTime())
    );

    const relevant = createdInRange || completedInRange || dueInRange || wasActiveInRange || isOverdueInRange;
    if (!relevant) continue;

    // Timeliness
    let isOnTime: boolean | null = null;
    if (completedInRange) {
      if (dueAt && completedAt) {
        isOnTime = completedAt.getTime() <= dueAt.getTime();
      } else if (!dueAt) {
        isOnTime = true;
      }
    } else if (isOverdueInRange) {
      isOnTime = false;
    } else if (dueInRange) {
      if (rangeIncludesToday) {
        isOnTime = dueAt.getTime() < now.getTime() ? false : null;
      } else {
        isOnTime = statusAtEndOfPeriod === "CLOSED" ? true : false;
      }
    }

    const quad = priorityQuadrant(t.urgent, t.important);
    const kpiName = t.kpiTemplateId ? kpisMap.get(t.kpiTemplateId) || "Other / Custom" : "Miscellaneous / General";

    periodTasks.push({
      id: t.id,
      title: t.title || "Untitled Task",
      status: statusAtEndOfPeriod,
      priority: quad,
      priorityTone: QUAD_TONE[quad] ?? "bg-slate-100 text-slate-600",
      kpiId: t.kpiTemplateId || null,
      kpiName,
      sizeLabel: t.sizeLabel || null,
      estimatedMins: t.estimatedMins || null,
      createdAt: createdAt ? createdAt.toISOString() : null,
      dueAt: dueAt ? dueAt.toISOString() : null,
      completedAt: completedAt ? completedAt.toISOString() : null,
      isOnTime,
      reworkCount: reworkedInRange ? 1 : (t.reworkCount && createdInRange ? t.reworkCount : 0),
      carryCount: carriedInRange ? 1 : (t.carryCount && createdInRange ? t.carryCount : 0),
      rejectionReason: rejectionReasonForPeriod,
      holdReason: holdReasonForPeriod,
      wasActiveInRange,
    });
  }

  // ── 6. Aggregate Summary Metrics ──────────────────────────────────────────
  const totalTasks = periodTasks.length;
  const completedTasks = periodTasks.filter((t) => t.status === "CLOSED").length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 1000) / 10 : 0;

  const onTimeCompleted = periodTasks.filter((t) => t.status === "CLOSED" && t.isOnTime === true).length;
  const onTimeRate = completedTasks > 0 ? Math.round((onTimeCompleted / completedTasks) * 1000) / 10 : null;

  const activeTasks = periodTasks.filter((t) => t.status !== "CLOSED").length;
  const reworkTasks = periodTasks.filter((t) => t.reworkCount > 0 || t.status === "REOPENED").length;
  const reworkRate = totalTasks > 0 ? Math.round((reworkTasks / totalTasks) * 1000) / 10 : 0;

  const carryTasks = periodTasks.filter((t) => t.carryCount > 0).length;
  const carryRate = totalTasks > 0 ? Math.round((carryTasks / totalTasks) * 1000) / 10 : 0;

  const plannedMinutes = periodTasks.reduce((acc, t) => acc + (t.estimatedMins || 0), 0);
  const plannedHours = Math.round((plannedMinutes / 60) * 10) / 10;

  // ── 7. KPI Usage Breakdown ────────────────────────────────────────────────
  const kpiGroups = new Map<string, TaskReportItem[]>();
  for (const t of periodTasks) {
    const key = t.kpiName;
    if (!kpiGroups.has(key)) kpiGroups.set(key, []);
    kpiGroups.get(key)!.push(t);
  }

  const kpiUsage: KpiUsageDetail[] = Array.from(kpiGroups.entries()).map(([kpiName, tasks]) => {
    const kpiId = tasks[0]?.kpiId || "generic";
    const kpiTotal = tasks.length;
    const usagePct = totalTasks > 0 ? Math.round((kpiTotal / totalTasks) * 1000) / 10 : 0;
    const kpiClosed = tasks.filter((t) => t.status === "CLOSED").length;
    const kpiCompletionRate = kpiTotal > 0 ? Math.round((kpiClosed / kpiTotal) * 1000) / 10 : 0;
    const kpiOnTime = tasks.filter((t) => t.status === "CLOSED" && t.isOnTime === true).length;
    const kpiOnTimeRate = kpiClosed > 0 ? Math.round((kpiOnTime / kpiClosed) * 1000) / 10 : 100;
    const kpiRework = tasks.filter((t) => t.reworkCount > 0 || t.status === "REOPENED").length;
    const kpiCarry = tasks.filter((t) => t.carryCount > 0).length;
    const kpiMins = tasks.reduce((acc, t) => acc + (t.estimatedMins || 0), 0);

    return {
      kpiId,
      kpiName,
      totalTasks: kpiTotal,
      usagePct,
      completedTasks: kpiClosed,
      completionRate: kpiCompletionRate,
      onTimeTasks: kpiOnTime,
      onTimeRate: kpiOnTimeRate,
      reworkTasks: kpiRework,
      carryTasks: kpiCarry,
      plannedMinutes: kpiMins,
      tasks,
    };
  });

  // Sort by highest usage first
  kpiUsage.sort((a, b) => b.totalTasks - a.totalTasks);

  const mostUsedKpi = kpiUsage.length > 0 ? kpiUsage[0] : null;
  const leastUsedKpi = kpiUsage.length > 1 ? kpiUsage[kpiUsage.length - 1] : null;

  // ── 8. Status Breakdown ───────────────────────────────────────────────────
  const statusCounts: Record<string, number> = {
    CLOSED: 0,
    IN_PROGRESS: 0,
    PENDING_REVIEW: 0,
    ON_HOLD: 0,
    REOPENED: 0,
    TODO: 0,
  };

  for (const t of periodTasks) {
    statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;
  }

  const statusToneMap: Record<string, string> = {
    CLOSED: "bg-emerald-500",
    IN_PROGRESS: "bg-blue-500",
    PENDING_REVIEW: "bg-amber-500",
    ON_HOLD: "bg-purple-500",
    REOPENED: "bg-red-500",
    TODO: "bg-slate-400",
  };

  const statusLabelMap: Record<string, string> = {
    CLOSED: "Closed",
    IN_PROGRESS: "In Progress",
    PENDING_REVIEW: "Pending Review",
    ON_HOLD: "On Hold",
    REOPENED: "Rework / Reopened",
    TODO: "To Do",
  };

  const statusBreakdown = Object.entries(statusCounts)
    .filter(([_, count]) => count > 0)
    .map(([status, count]) => ({
      status,
      label: statusLabelMap[status] || status,
      count,
      pct: totalTasks > 0 ? Math.round((count / totalTasks) * 1000) / 10 : 0,
      tone: statusToneMap[status] || "bg-slate-500",
    }))
    .sort((a, b) => b.count - a.count);

  // ── 9. Task Activity Trend Generation ─────────────────────────────────────
  const activityTrend: TrendBucket[] = [];

  if (rangeType === "weekly") {
    // 7 days (Mon-Sun)
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const bStart = new Date(d);
      bStart.setHours(0, 0, 0, 0);
      const bEnd = new Date(d);
      bEnd.setHours(23, 59, 59, 999);

      const created = periodTasks.filter((t) => {
        const c = toDate(t.createdAt);
        return c && c >= bStart && c <= bEnd;
      }).length;

      const completed = periodTasks.filter((t) => {
        const c = toDate(t.completedAt);
        return c && c >= bStart && c <= bEnd;
      }).length;

      const overdue = periodTasks.filter((t) => {
        const due = toDate(t.dueAt);
        const comp = toDate(t.completedAt);
        return due && due <= bEnd && (!comp || comp > bEnd) && t.status !== "CLOSED";
      }).length;

      activityTrend.push({
        label: `${days[i]} ${d.getDate()}`,
        created,
        completed,
        overdue,
      });
    }
  } else if (rangeType === "quarterly") {
    // 3 Months
    const startM = startDate.getMonth();
    const year = startDate.getFullYear();
    for (let m = startM; m < startM + 3; m++) {
      const bStart = new Date(year, m, 1, 0, 0, 0, 0);
      const bEnd = new Date(year, m + 1, 0, 23, 59, 59, 999);
      const mLabel = bStart.toLocaleDateString("en-IN", { month: "short" });

      const created = periodTasks.filter((t) => {
        const c = toDate(t.createdAt);
        return c && c >= bStart && c <= bEnd;
      }).length;

      const completed = periodTasks.filter((t) => {
        const c = toDate(t.completedAt);
        return c && c >= bStart && c <= bEnd;
      }).length;

      const overdue = periodTasks.filter((t) => {
        const due = toDate(t.dueAt);
        const comp = toDate(t.completedAt);
        return due && due <= bEnd && (!comp || comp > bEnd) && t.status !== "CLOSED";
      }).length;

      activityTrend.push({
        label: mLabel,
        created,
        completed,
        overdue,
      });
    }
  } else if (rangeType === "yearly") {
    // 12 Months
    const year = startDate.getFullYear();
    for (let m = 0; m < 12; m++) {
      const bStart = new Date(year, m, 1, 0, 0, 0, 0);
      const bEnd = new Date(year, m + 1, 0, 23, 59, 59, 999);
      const mLabel = bStart.toLocaleDateString("en-IN", { month: "short" });

      const created = periodTasks.filter((t) => {
        const c = toDate(t.createdAt);
        return c && c >= bStart && c <= bEnd;
      }).length;

      const completed = periodTasks.filter((t) => {
        const c = toDate(t.completedAt);
        return c && c >= bStart && c <= bEnd;
      }).length;

      const overdue = periodTasks.filter((t) => {
        const due = toDate(t.dueAt);
        const comp = toDate(t.completedAt);
        return due && due <= bEnd && (!comp || comp > bEnd) && t.status !== "CLOSED";
      }).length;

      activityTrend.push({
        label: mLabel,
        created,
        completed,
        overdue,
      });
    }
  } else {
    // Monthly / Custom (Divide into 4-5 interval buckets)
    const totalDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
    const bucketCount = Math.min(5, totalDays);
    const dayStep = Math.max(1, Math.ceil(totalDays / bucketCount));

    for (let i = 0; i < bucketCount; i++) {
      const bStart = new Date(startDate);
      bStart.setDate(bStart.getDate() + i * dayStep);
      bStart.setHours(0, 0, 0, 0);

      const bEnd = new Date(bStart);
      bEnd.setDate(bEnd.getDate() + dayStep - 1);
      if (bEnd.getTime() > endDate.getTime()) bEnd.setTime(endDate.getTime());
      bEnd.setHours(23, 59, 59, 999);

      const created = periodTasks.filter((t) => {
        const c = toDate(t.createdAt);
        return c && c >= bStart && c <= bEnd;
      }).length;

      const completed = periodTasks.filter((t) => {
        const c = toDate(t.completedAt);
        return c && c >= bStart && c <= bEnd;
      }).length;

      const overdue = periodTasks.filter((t) => {
        const due = toDate(t.dueAt);
        const comp = toDate(t.completedAt);
        return due && due <= bEnd && (!comp || comp > bEnd) && t.status !== "CLOSED";
      }).length;

      activityTrend.push({
        label: `${bStart.getDate()}/${bStart.getMonth() + 1} - ${bEnd.getDate()}/${bEnd.getMonth() + 1}`,
        created,
        completed,
        overdue,
      });
    }
  }

  // ── 10. Factual Management Insights ───────────────────────────────────────
  const workInsights: string[] = [];

  if (mostUsedKpi) {
    workInsights.push(
      `Most focus was in "${mostUsedKpi.kpiName}" with ${mostUsedKpi.totalTasks} task${mostUsedKpi.totalTasks === 1 ? "" : "s"} (${mostUsedKpi.usagePct}% of total volume).`
    );
  }

  if (completedTasks > 0 && onTimeRate != null) {
    workInsights.push(
      `${onTimeRate}% of completed tasks (${onTimeCompleted} of ${completedTasks}) were delivered on or before the committed deadline.`
    );
  }

  if (completionRate > 0) {
    workInsights.push(
      `Overall completion rate for this period is ${completionRate}% (${completedTasks}/${totalTasks} closed).`
    );
  }

  if (reworkTasks > 0) {
    workInsights.push(
      `${reworkTasks} task${reworkTasks === 1 ? "" : "s"} required manager rework/rejection (${reworkRate}% quality rework rate).`
    );
  }

  if (carryTasks > 0) {
    workInsights.push(
      `${carryTasks} task${carryTasks === 1 ? "" : "s"} were carried forward across planning intervals (${carryRate}% carry rate).`
    );
  }

  if (plannedHours > 0) {
    workInsights.push(
      `Total planned workload across all qualifying tasks was ${plannedHours} hours (${plannedMinutes} minutes).`
    );
  }

  // ── 11. Dynamic Delivery Quality Explanations ──────────────────────────────
  const qualityExplanations = {
    completion: {
      rate: completionRate,
      formula: `${completedTasks} closed tasks ÷ ${totalTasks} total tasks = ${completionRate}%`,
      description: "Percentage of assigned tasks fully closed within this reporting period.",
    },
    onTime: {
      rate: onTimeRate,
      formula:
        completedTasks > 0
          ? `${onTimeCompleted} on-time closed tasks ÷ ${completedTasks} completed tasks = ${onTimeRate}%`
          : "No completed tasks to evaluate in this period.",
      description: "Adherence to commitments without deadline overruns.",
    },
    rework: {
      rate: reworkRate,
      formula: `${reworkTasks} reworked/reopened tasks ÷ ${totalTasks} total tasks = ${reworkRate}%`,
      description: "Quality rework frequency based on rejection events.",
    },
    carry: {
      rate: carryRate,
      formula: `${carryTasks} carried-forward tasks ÷ ${totalTasks} total tasks = ${carryRate}%`,
      description: "Frequency of tasks deferred or carried across days.",
    },
  };

  return toPlainObject({
    employee: {
      id: empData.id,
      name: empData.name || "Unknown",
      email: empData.email,
      avatarUrl: empData.avatarUrl || null,
      roleTitle,
      departmentName,
      managerName,
      roleId: empData.roleId,
    },
    range: {
      rangeType,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      label,
      subLabel,
      dateParam,
      fromParam,
      toParam,
      prevParams,
      nextParams,
    },
    summaryCards: {
      totalTasks,
      completedTasks,
      completionRate,
      onTimeCompletedTasks: onTimeCompleted,
      onTimeRate,
      activeTasks,
      reworkTasks,
      reworkRate,
      carryTasks,
      carryRate,
      plannedMinutes,
      plannedHours,
    },
    qualityExplanations,
    kpiUsage,
    mostUsedKpi,
    leastUsedKpi,
    statusBreakdown,
    activityTrend,
    workInsights: workInsights.slice(0, 5),
    tasks: periodTasks,
    viewerCanScore: !!(viewerUser && (canScoreCompanyWide(viewerUser) || hasPermission(viewerUser, "scores"))),
  });
}
