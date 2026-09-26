import { adminDb } from "@/lib/firebase/admin";
import { fetchAllRoles, fetchAllDepartments, batchFetchByIds } from "@/lib/cache";
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
    totalEstimatedMins: number;
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
};

function toDate(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (val.toDate) return val.toDate();
  const parsed = new Date(val);
  return isNaN(parsed.getTime()) ? null : parsed;
}

const QUAD_TONE: Record<string, string> = {
  "Do First": "bg-red-100 text-red-700",
  Schedule: "bg-blue-100 text-blue-700",
  Delegate: "bg-amber-100 text-amber-700",
  Eliminate: "bg-slate-100 text-slate-500",
};

/**
 * Loads person-wise daily operations report for all employees for a given calendar date.
 */
export async function loadCompanyDailyReport(targetDate: Date = new Date()): Promise<DailyReportSummary> {
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

  // Fetch active employees, roles, departments, and managers
  const [employeesSnap, rolesSnap, departmentsSnap, allEmpsSnap, ritualsSnap] = await Promise.all([
    adminDb.collection("Employee").where("active", "==", true).get(),
    fetchAllRoles(adminDb),
    fetchAllDepartments(adminDb),
    adminDb.collection("Employee").get(),
    adminDb.collection("DailyRitual").where("date", "==", dayStart).get(),
  ]);

  const rolesMap = new Map<string, any>();
  rolesSnap.docs?.forEach((d: any) => rolesMap.set(d.id, d.data()));

  const deptsMap = new Map<string, any>();
  departmentsSnap.docs?.forEach((d: any) => deptsMap.set(d.id, d.data().name));

  const allEmpsMap = new Map<string, any>();
  allEmpsSnap.docs?.forEach((d: any) => allEmpsMap.set(d.id, d.data().name));

  const ritualsByEmp = new Map<string, any>();
  ritualsSnap.docs?.forEach((d: any) => ritualsByEmp.set(d.data().employeeId, d.data()));

  const employees = employeesSnap.docs ? employeesSnap.docs.map((d: any) => ({ id: d.id, ...d.data() })) : [];
  employees.sort((a, b) => a.name.localeCompare(b.name));

  // Chunk employee IDs for targeted task queries
  const empIds = employees.map((e) => e.id);
  const chunkIds = (ids: string[]) => {
    const chunks = [];
    for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30));
    return chunks;
  };

  const tasksMapByEmp = new Map<string, any[]>();
  for (const id of empIds) tasksMapByEmp.set(id, []);

  // Fetch tasks completed today or created today, or open tasks
  if (empIds.length > 0) {
    const chunks = chunkIds(empIds);
    const taskQueries = chunks.map(async (chunk) => {
      return Promise.all([
        // Completed on target date
        adminDb.collection("Task")
          .where("assigneeId", "in", chunk)
          .where("completedAt", ">=", dayStart)
          .where("completedAt", "<=", dayEnd)
          .get(),
        // Created on target date
        adminDb.collection("Task")
          .where("assigneeId", "in", chunk)
          .where("createdAt", ">=", dayStart)
          .where("createdAt", "<=", dayEnd)
          .get(),
        // Currently active open tasks
        adminDb.collection("Task")
          .where("assigneeId", "in", chunk)
          .where("status", "!=", "CLOSED")
          .get(),
      ]);
    });

    const taskSnapResults = await Promise.all(taskQueries);
    const seenTaskIds = new Set<string>();

    for (const [closedSnap, createdSnap, openSnap] of taskSnapResults) {
      const allDocs = [...(closedSnap.docs || []), ...(createdSnap.docs || []), ...(openSnap.docs || [])];
      for (const doc of allDocs) {
        if (seenTaskIds.has(doc.id)) continue;
        seenTaskIds.add(doc.id);
        const data = doc.data();
        if (data.deletedAt) continue;
        const assigneeId = data.assigneeId;
        if (assigneeId && tasksMapByEmp.has(assigneeId)) {
          tasksMapByEmp.get(assigneeId)!.push({ id: doc.id, ...data });
        }
      }
    }
  }

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

  const reports: PersonDailyReport[] = employees.map((emp: any) => {
    const role = emp.roleId ? rolesMap.get(emp.roleId) : null;
    const roleTitle = role?.title || "Team Member";
    const departmentName = role?.departmentId ? (deptsMap.get(role.departmentId) || "General") : "General";
    allDeptsSet.add(departmentName);
    deptCounts[departmentName] = (deptCounts[departmentName] || 0) + 1;

    // Manager
    const mgrIds = emp.reportsToIds || (emp.reportsToId ? [emp.reportsToId] : []);
    const mgrNames = mgrIds.map((id: string) => allEmpsMap.get(id)).filter(Boolean);
    const managerName = mgrNames.length > 0 ? mgrNames.join(", ") : "—";

    // Ritual for this date
    const ritualData = ritualsByEmp.get(emp.id);
    let plannedTasksCount = 0;
    if (ritualData?.plannedTaskIds) {
      try {
        const parsed = JSON.parse(ritualData.plannedTaskIds);
        plannedTasksCount = Array.isArray(parsed) ? parsed.length : 0;
      } catch {
        plannedTasksCount = 0;
      }
    }

    const rawTasks = tasksMapByEmp.get(emp.id) || [];

    // Filter relevant tasks for this date:
    // 1. Completed on this date
    // 2. Created on this date
    // 3. Open tasks due today or overdue
    const dailyTasks: DailyTaskItem[] = [];
    const kpisTouchedSet = new Set<string>();
    let closedCount = 0;
    let onTimeCount = 0;
    let reworkCount = 0;
    let overdueCount = 0;
    let totalEstMins = 0;

    for (const t of rawTasks) {
      const createdAt = toDate(t.createdAt);
      const completedAt = toDate(t.completedAt);
      const dueAt = toDate(t.dueAt);
      const isClosed = t.status === "CLOSED";

      const completedOnDate = completedAt && completedAt >= dayStart && completedAt <= dayEnd;
      const createdOnDate = createdAt && createdAt >= dayStart && createdAt <= dayEnd;
      const isOpen = !isClosed;
      const isDueOnDate = dueAt && dueAt >= dayStart && dueAt <= dayEnd;
      const isOverdue = isOpen && dueAt && dueAt.getTime() < dayStart.getTime();

      // Only include tasks that are relevant to this day's work
      if (!completedOnDate && !createdOnDate && !isDueOnDate && !isOverdue && !isOpen) {
        continue;
      }

      if (t.estimatedMins) totalEstMins += t.estimatedMins;

      const kpiName = t.kpiTemplateId ? kpisMap.get(t.kpiTemplateId) ?? null : null;
      if (kpiName) kpisTouchedSet.add(kpiName);

      // On-time evaluation
      let isOnTime: boolean | null = null;
      if (completedAt && dueAt) {
        isOnTime = completedAt.getTime() <= dueAt.getTime();
      } else if (completedAt && !dueAt) {
        isOnTime = true; // completed without deadline is considered on time
      } else if (!completedAt && dueAt && dueAt.getTime() < now.getTime()) {
        isOnTime = false;
      }

      if (completedOnDate) {
        closedCount++;
        totalClosedCount++;
        if (isOnTime) {
          onTimeCount++;
          onTimeClosedCount++;
        }
      }

      if (isOpen) {
        totalOpenCount++;
      }

      if (isOverdue) {
        overdueCount++;
      }

      if ((t.reworkCount && t.reworkCount > 0) || t.status === "REOPENED") {
        reworkCount += t.reworkCount || 1;
      }

      const quad = priorityQuadrant(t.urgent, t.important);

      dailyTasks.push({
        id: t.id,
        title: t.title || "Untitled Task",
        status: t.status,
        priority: quad,
        priorityTone: QUAD_TONE[quad] ?? "bg-slate-100 text-slate-600",
        kpiName,
        sizeLabel: t.sizeLabel ?? null,
        estimatedMins: t.estimatedMins ?? null,
        dueAt: dueAt ? dueAt.toISOString() : null,
        completedAt: completedAt ? completedAt.toISOString() : null,
        isOnTime,
        reworkCount: t.reworkCount || 0,
        rejectionReason: t.rejectionReason ?? null,
        holdReason: t.holdReason ?? null,
        carryCount: t.carryCount || 0,
      });
    }

    // Determine status & tone
    let status: PersonDailyReport["status"] = "NO_ACTIVITY";
    let statusLabel = "No Activity";
    let statusTone = "bg-slate-100 text-slate-600 border-slate-200";

    const hasAnyAction = dailyTasks.length > 0 || ritualData?.morningPlanned || ritualData?.eveningClosed;

    if (reworkCount > 0 || overdueCount > 0) {
      status = "ATTENTION";
      statusLabel = overdueCount > 0 && reworkCount > 0 ? "Overdue & Rework" : reworkCount > 0 ? "Rework Flagged" : "Overdue Tasks";
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
      statusLabel = "No Activity Today";
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
        inProgressToday: dailyTasks.filter((t) => t.status !== "CLOSED").length,
        overdueCount,
        reworkCount,
        onTimeRate,
        totalEstimatedMins: totalEstMins,
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
  };
}
