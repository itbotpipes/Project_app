import { adminDb } from "@/lib/firebase/admin";
import { fetchAllRoles, fetchAllDepartments } from "@/lib/cache";
import { priorityQuadrant } from "@/lib/constants";
import { canScoreCompanyWide, isManagerLike, hasPermission } from "@/lib/auth";
import {
  type DailyTaskItem,
  type PersonDailyReport,
  type DailyReportSummary,
  type TaskDailyState,
  getTaskDailyState,
  toDate,
  QUAD_TONE,
} from "./dailyReportState";

export type { DailyTaskItem, PersonDailyReport, DailyReportSummary, TaskDailyState };
export { getTaskDailyState, toDate };

/**
 * Loads person-wise daily operations report for permitted employees for a given calendar date.
 * Completely date-isolated and point-in-time accurate.
 */
export async function loadCompanyDailyReport(
  targetDate: Date = new Date(),
  viewerUser?: any
): Promise<DailyReportSummary> {
  const dayStart = new Date(targetDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setHours(23, 59, 59, 999);

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const isToday = dayStart.getTime() === todayStart.getTime();

  const dateValue = `${dayStart.getFullYear()}-${String(dayStart.getMonth() + 1).padStart(2, "0")}-${String(dayStart.getDate()).padStart(2, "0")}`;
  const dateLabel = dayStart.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  // ── 1. Determine Permission Scope & Fetch Permitted Employees ──────────────
  let viewScope: "COMPANY" | "TEAM" | "SELF" = "COMPANY";
  let employees: any[] = [];

  const [rolesSnap, departmentsSnap, allEmpsSnap] = await Promise.all([
    fetchAllRoles(adminDb),
    fetchAllDepartments(adminDb),
    adminDb.collection("Employee").get(),
  ]);

  const allEmpsMap = new Map<string, any>();
  const allActiveEmps: any[] = [];
  allEmpsSnap.docs?.forEach((d: any) => {
    const data = { id: d.id, ...d.data() };
    allEmpsMap.set(d.id, data);
    if (data.active) allActiveEmps.push(data);
  });

  if (!viewerUser) {
    employees = allActiveEmps;
  } else {
    const canCompany = canScoreCompanyWide(viewerUser) || hasPermission(viewerUser, "scores") || hasPermission(viewerUser, "admin");
    const isMgr = isManagerLike(viewerUser.systemRole, viewerUser.systemRoleObj) || hasPermission(viewerUser, "team");

    if (canCompany) {
      viewScope = "COMPANY";
      employees = allActiveEmps;
    } else if (isMgr) {
      viewScope = "TEAM";
      const reportEmps = allActiveEmps.filter((e) => {
        const mgrIds = Array.isArray(e.reportsToIds) ? e.reportsToIds : e.reportsToId ? [e.reportsToId] : [];
        return mgrIds.includes(viewerUser.id) || e.id === viewerUser.id;
      });
      employees = reportEmps.length > 0 ? reportEmps : (allEmpsMap.get(viewerUser.id) ? [allEmpsMap.get(viewerUser.id)] : []);
    } else {
      viewScope = "SELF";
      const selfEmp = allEmpsMap.get(viewerUser.id);
      employees = selfEmp ? [selfEmp] : [];
    }
  }

  employees.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  const rolesMap = new Map<string, any>();
  rolesSnap.docs?.forEach((d: any) => rolesMap.set(d.id, d.data()));

  const deptsMap = new Map<string, any>();
  departmentsSnap.docs?.forEach((d: any) => deptsMap.set(d.id, d.data().name));

  // ── 2. Fetch Rituals for the Target Date ──────────────────────────────────
  const ritualsSnap = await adminDb.collection("DailyRitual").where("date", "==", dayStart).get();
  const ritualsByEmp = new Map<string, any>();
  ritualsSnap.docs?.forEach((d: any) => ritualsByEmp.set(d.data().employeeId, d.data()));

  // ── 3. Fetch Tasks Relevant to Permitted Employees on Target Date ─────────
  const empIds = employees.map((e) => e.id);
  const chunkIds = (ids: string[]) => {
    const chunks = [];
    for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30));
    return chunks;
  };

  const tasksMapByEmp = new Map<string, any[]>();
  for (const id of empIds) tasksMapByEmp.set(id, []);

  const allRelevantTaskIds = new Set<string>();
  const tasksById = new Map<string, any>();

  if (empIds.length > 0) {
    const chunks = chunkIds(empIds);
    const taskQueries = chunks.map(async (chunk) => {
      const queries = [
        // Tasks completed on target date
        adminDb.collection("Task")
          .where("assigneeId", "in", chunk)
          .where("completedAt", ">=", dayStart)
          .where("completedAt", "<=", dayEnd)
          .get(),
        // Tasks created on target date
        adminDb.collection("Task")
          .where("assigneeId", "in", chunk)
          .where("createdAt", ">=", dayStart)
          .where("createdAt", "<=", dayEnd)
          .get(),
        // Tasks due on target date
        adminDb.collection("Task")
          .where("assigneeId", "in", chunk)
          .where("dueAt", ">=", dayStart)
          .where("dueAt", "<=", dayEnd)
          .get(),
      ];

      // For today, also fetch open tasks
      if (isToday) {
        queries.push(
          adminDb.collection("Task")
            .where("assigneeId", "in", chunk)
            .where("status", "!=", "CLOSED")
            .get()
        );
      } else {
        // For past dates, query tasks due before dayStart that were completed after dayStart or still open
        queries.push(
          adminDb.collection("Task")
            .where("assigneeId", "in", chunk)
            .where("dueAt", "<", dayStart)
            .get()
        );
      }

      return Promise.all(queries);
    });

    const taskSnapResults = await Promise.all(taskQueries);

    for (const snapGroup of taskSnapResults) {
      for (const snap of snapGroup) {
        for (const doc of snap.docs || []) {
          const data = doc.data();
          allRelevantTaskIds.add(doc.id);
          tasksById.set(doc.id, { id: doc.id, ...data });
        }
      }
    }
  }

  // ── 4. Fetch AuditLogs on Target Date (to capture comments, moves, reworks, carries)
  const auditLogsSnap = await adminDb.collection("AuditLog")
    .where("createdAt", ">=", dayStart)
    .where("createdAt", "<=", dayEnd)
    .get();

  const extraTaskIdsToFetch = new Set<string>();
  const logsByTaskId = new Map<string, any[]>();

  for (const doc of auditLogsSnap.docs || []) {
    const l = doc.data();
    if (l.entity === "Task" && l.entityId) {
      if (!logsByTaskId.has(l.entityId)) logsByTaskId.set(l.entityId, []);
      logsByTaskId.get(l.entityId)!.push(l);

      if (!tasksById.has(l.entityId)) {
        extraTaskIdsToFetch.add(l.entityId);
      }
    }
  }

  // Fetch any missing tasks referenced in AuditLogs
  if (extraTaskIdsToFetch.size > 0) {
    const extraIds = Array.from(extraTaskIdsToFetch);
    const extraChunks = chunkIds(extraIds);
    await Promise.all(
      extraChunks.map(async (c) => {
        const snap = await adminDb.collection("Task").where("__name__", "in", c).get();
        snap.docs?.forEach((d) => {
          tasksById.set(d.id, { id: d.id, ...d.data() });
          allRelevantTaskIds.add(d.id);
        });
      })
    );
  }

  // ── 5. Fetch Historical Audit Logs for Status Reconstruction Up to dayEnd ─
  const relevantTaskIdsList = Array.from(allRelevantTaskIds);
  if (relevantTaskIdsList.length > 0) {
    const taskChunks = chunkIds(relevantTaskIdsList);
    const historySnaps = await Promise.all(
      taskChunks.map((c) =>
        adminDb.collection("AuditLog")
          .where("entity", "==", "Task")
          .where("entityId", "in", c)
          .get()
      )
    );

    for (const snap of historySnaps) {
      for (const doc of snap.docs || []) {
        const logData = doc.data();
        const taskId = logData.entityId;
        if (taskId) {
          if (!logsByTaskId.has(taskId)) logsByTaskId.set(taskId, []);
          const existing = logsByTaskId.get(taskId)!;
          if (!existing.some((e) => e.id === doc.id || (e.createdAt?.seconds === logData.createdAt?.seconds && e.action === logData.action))) {
            existing.push({ id: doc.id, ...logData });
          }
        }
      }
    }
  }

  // ── 6. Fetch Checklist Items for Relevant Tasks ───────────────────────────
  const checklistByTaskId = new Map<string, any[]>();
  if (relevantTaskIdsList.length > 0) {
    const taskChunks = chunkIds(relevantTaskIdsList);
    const checkSnaps = await Promise.all(
      taskChunks.map((c) =>
        adminDb.collection("ChecklistItem").where("taskId", "in", c).get()
      )
    );

    for (const snap of checkSnaps) {
      for (const doc of snap.docs || []) {
        const data = doc.data();
        const taskId = data.taskId;
        if (taskId) {
          if (!checklistByTaskId.has(taskId)) checklistByTaskId.set(taskId, []);
          checklistByTaskId.get(taskId)!.push(data);
        }
      }
    }
  }

  // Distribute tasks to employees
  tasksById.forEach((task) => {
    const assigneeId = task.assigneeId;
    if (assigneeId && tasksMapByEmp.has(assigneeId)) {
      tasksMapByEmp.get(assigneeId)!.push(task);
    }
  });

  // Preload KPI names
  const allKpisSnap = await adminDb.collection("KpiTemplate").get();
  const kpisMap = new Map<string, string>();
  allKpisSnap.docs?.forEach((d: any) => kpisMap.set(d.id, d.data().kpiName));

  let totalClosedCount = 0;
  let totalOpenCount = 0;
  let onTimeClosedCount = 0;
  let attentionTotal = 0;
  let noActivityTotal = 0;
  const deptCounts: Record<string, number> = {};
  const allDeptsSet = new Set<string>();

  // ── 7. Reconstruct Daily State for Each Employee ───────────────────────────
  const reports: PersonDailyReport[] = employees.map((emp: any) => {
    const role = emp.roleId ? rolesMap.get(emp.roleId) : null;
    const roleTitle = role?.title || "Team Member";
    const departmentName = role?.departmentId ? deptsMap.get(role.departmentId) || "General" : "General";
    allDeptsSet.add(departmentName);
    deptCounts[departmentName] = (deptCounts[departmentName] || 0) + 1;

    // Manager
    const mgrIds = Array.isArray(emp.reportsToIds) ? emp.reportsToIds : emp.reportsToId ? [emp.reportsToId] : [];
    const mgrNames = mgrIds.map((id: string) => allEmpsMap.get(id)?.name).filter(Boolean);
    const managerName = mgrNames.length > 0 ? mgrNames.join(", ") : "—";

    // Ritual for this date
    const ritualData = ritualsByEmp.get(emp.id) || null;
    let plannedTasksCount = 0;
    if (ritualData?.plannedTaskIds) {
      try {
        const parsed =
          typeof ritualData.plannedTaskIds === "string"
            ? JSON.parse(ritualData.plannedTaskIds)
            : ritualData.plannedTaskIds;
        plannedTasksCount = Array.isArray(parsed) ? parsed.length : 0;
      } catch {
        plannedTasksCount = 0;
      }
    }

    const rawTasks = tasksMapByEmp.get(emp.id) || [];
    const dailyTasks: DailyTaskItem[] = [];
    const kpisTouchedSet = new Set<string>();
    let closedCount = 0;
    let inProgressCount = 0;
    let onTimeCount = 0;
    let reworkCount = 0;
    let overdueCount = 0;
    let totalPlannedMins = 0;

    for (const t of rawTasks) {
      const taskLogs = logsByTaskId.get(t.id) || [];
      const taskChecklists = checklistByTaskId.get(t.id) || [];

      const dailyState = getTaskDailyState(
        t,
        taskLogs,
        taskChecklists,
        ritualData,
        dayStart,
        dayEnd,
        isToday,
        now
      );

      if (!dailyState.relevantForDay) {
        continue;
      }

      const dueAt = toDate(t.dueAt);
      const completedAt = toDate(t.completedAt);
      const kpiName = t.kpiTemplateId ? kpisMap.get(t.kpiTemplateId) ?? null : null;

      if (kpiName && (dailyState.wasActiveThatDay || dailyState.completedThatDay || dailyState.plannedThatDay)) {
        kpisTouchedSet.add(kpiName);
      }

      if (t.estimatedMins && (dailyState.wasActiveThatDay || dailyState.dueThatDay || dailyState.plannedThatDay)) {
        totalPlannedMins += t.estimatedMins;
      }

      if (dailyState.completedThatDay) {
        closedCount++;
        totalClosedCount++;
        if (dailyState.isOnTime === true) {
          onTimeCount++;
          onTimeClosedCount++;
        }
      }

      if (dailyState.statusAtEndOfDay !== "CLOSED") {
        inProgressCount++;
        totalOpenCount++;
      }

      if (dailyState.overdueThatDay) {
        overdueCount++;
      }

      if (dailyState.reworkedThatDay) {
        reworkCount++;
      }

      const quad = priorityQuadrant(t.urgent, t.important);

      dailyTasks.push({
        id: t.id,
        title: t.title || "Untitled Task",
        status: dailyState.statusAtEndOfDay || t.status,
        priority: quad,
        priorityTone: QUAD_TONE[quad] ?? "bg-slate-100 text-slate-600",
        kpiName,
        sizeLabel: t.sizeLabel ?? null,
        estimatedMins: t.estimatedMins ?? null,
        dueAt: dueAt ? dueAt.toISOString() : null,
        completedAt: completedAt ? completedAt.toISOString() : null,
        isOnTime: dailyState.isOnTime,
        reworkCount: dailyState.reworkedThatDay ? 1 : 0,
        rejectionReason: dailyState.rejectionReason,
        holdReason: dailyState.holdReason,
        carryCount: dailyState.carriedThatDay ? 1 : 0,
        wasActiveThatDay: dailyState.wasActiveThatDay,
        createdThatDay: dailyState.createdThatDay,
        completedThatDay: dailyState.completedThatDay,
        dueThatDay: dailyState.dueThatDay,
        overdueThatDay: dailyState.overdueThatDay,
      });
    }

    // Determine status & tone
    let status: PersonDailyReport["status"] = "NO_ACTIVITY";
    let statusLabel = "No Activity";
    let statusTone = "bg-slate-100 text-slate-600 border-slate-200";

    const hasAnyAction =
      dailyTasks.some((t) => t.wasActiveThatDay || t.completedThatDay || t.createdThatDay) ||
      ritualData?.morningPlanned ||
      ritualData?.eveningClosed;

    if (reworkCount > 0 || overdueCount > 0) {
      status = "ATTENTION";
      statusLabel =
        overdueCount > 0 && reworkCount > 0
          ? "Overdue & Rework"
          : reworkCount > 0
          ? "Rework Flagged"
          : "Overdue Tasks";
      statusTone = "bg-red-50 text-red-700 border-red-200";
      attentionTotal++;
    } else if (closedCount > 0) {
      status = "ON_TRACK";
      statusLabel = `${closedCount} Closed`;
      statusTone = "bg-emerald-50 text-emerald-700 border-emerald-200";
    } else if (hasAnyAction) {
      status = "IN_PROGRESS";
      statusLabel = "Active In Progress";
      statusTone = "bg-blue-50 text-blue-700 border-blue-200";
    } else {
      status = "NO_ACTIVITY";
      statusLabel = isToday ? "No Activity Today" : "No Activity on Date";
      statusTone = "bg-slate-100 text-slate-500 border-slate-200";
      noActivityTotal++;
    }

    const onTimeRate = closedCount > 0 ? Math.round((onTimeCount / closedCount) * 100) : null;

    return {
      employee: {
        id: emp.id,
        name: emp.name || "Unknown",
        email: emp.email,
        avatarUrl: emp.avatarUrl || null,
        roleTitle,
        departmentName,
        managerName,
      },
      ritual: {
        morningPlanned: !!ritualData?.morningPlanned,
        eveningClosed: !!ritualData?.eveningClosed,
        reflection: ritualData?.reflection ?? null,
        plannedTasksCount,
      },
      metrics: {
        closedToday: closedCount,
        inProgressToday: inProgressCount,
        overdueCount,
        reworkCount,
        onTimeRate,
        plannedMinutes: totalPlannedMins,
        totalEstimatedMins: totalPlannedMins,
        kpisTouched: Array.from(kpisTouchedSet),
      },
      status,
      statusLabel,
      statusTone,
      tasks: dailyTasks,
    };
  });

  const reportedEmployeesCount = reports.filter((r) => r.status !== "NO_ACTIVITY").length;
  const overallOnTimeRate = totalClosedCount > 0 ? Math.round((onTimeClosedCount / totalClosedCount) * 100) : 100;

  return {
    dateValue,
    dateLabel,
    isToday,
    totalEmployees: employees.length,
    reportedEmployeesCount,
    totalClosedToday: totalClosedCount,
    totalOpenToday: totalOpenCount,
    overallOnTimeRate,
    attentionCount: attentionTotal,
    noActivityCount: noActivityTotal,
    departmentCounts: deptCounts,
    departments: Array.from(allDeptsSet).sort(),
    reports,
    viewScope,
  };
}
