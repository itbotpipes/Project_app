import { adminDb } from "@/lib/firebase/admin";
import { fetchAllRoles, fetchAllDepartments } from "@/lib/cache";
import { canScoreCompanyWide, isManagerLike, hasPermission } from "@/lib/auth";
import {
  type DailySummaryTaskItem,
  type EmployeeDailyWorkSummary,
  type TeamDailySummaryMetrics,
  type DepartmentEmployeeSummary,
  type DepartmentTaskItem,
  type DepartmentDailyWorkSummary,
  type CompanyDailyWorkSummariesResult,
  formatDateKey,
  formatDisplayDate,
} from "./dailyWorkSummaryTypes";

export * from "./dailyWorkSummaryTypes";

/**
 * Checks if the user is an Executive (CEO, COO, Managing Director, Director) or Admin.
 * They have full company-wide access to all departments and all individual summaries.
 */
export function isExecutiveOrAdmin(user: any): boolean {
  if (!user) return false;
  const sysRole = (user.systemRole || "").toUpperCase().trim();
  if (
    user.systemRoleObj?.isAdmin === true ||
    sysRole === "ADMIN" ||
    sysRole === "CEO" ||
    sysRole === "COO"
  ) {
    return true;
  }
  if (canScoreCompanyWide(user) || hasPermission(user, "admin")) {
    return true;
  }
  const roleTitle = (
    user.role?.title ||
    user.roleTitle ||
    user.customRoleTitle ||
    ""
  ).toLowerCase().trim();
  if (
    roleTitle === "ceo" ||
    roleTitle === "coo" ||
    roleTitle.startsWith("ceo") ||
    roleTitle.startsWith("coo") ||
    roleTitle.includes("/ md") ||
    roleTitle.includes("/ director") ||
    roleTitle.includes("managing director") ||
    roleTitle.includes("chief operating officer") ||
    roleTitle.includes("chief executive officer")
  ) {
    return true;
  }
  return false;
}

/**
 * Resolves all subordinate employees reporting to managerId (directly or transitively).
 */
export function getSubordinateEmployees(
  managerId: string,
  allEmployees: any[]
): any[] {
  const managedIds = new Set<string>();
  let added = true;

  while (added) {
    added = false;
    for (const emp of allEmployees) {
      if (emp.id === managerId || managedIds.has(emp.id)) continue;
      const mgrIds: string[] = Array.isArray(emp.reportsToIds)
        ? emp.reportsToIds
        : emp.reportsToId
        ? [emp.reportsToId]
        : [];
      if (mgrIds.includes(managerId) || mgrIds.some((id) => managedIds.has(id))) {
        managedIds.add(emp.id);
        added = true;
      }
    }
  }

  return allEmployees.filter((e) => managedIds.has(e.id));
}

/** Converts Firestore Timestamp, Date, string or null into a standard JS Date */
export function parseDate(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val.toDate === "function") {
    const d = val.toDate();
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Calculates the next working day, respecting weekends:
 * - Friday (5) -> Monday (+3 days)
 * - Saturday (6) -> Monday (+2 days)
 * - Sunday (0) -> Monday (+1 day)
 * - Monday - Thursday -> Tomorrow (+1 day)
 */
export function getNextWorkingDay(fromDate: Date): Date {
  const next = new Date(fromDate);
  next.setHours(0, 0, 0, 0);
  const dayOfWeek = next.getDay(); // 0 is Sunday, 5 is Friday, 6 is Saturday

  if (dayOfWeek === 5) {
    // Friday -> next working day is Monday (+3 days)
    next.setDate(next.getDate() + 3);
  } else if (dayOfWeek === 6) {
    // Saturday -> next working day is Monday (+2 days)
    next.setDate(next.getDate() + 2);
  } else if (dayOfWeek === 0) {
    // Sunday -> next working day is Monday (+1 day)
    next.setDate(next.getDate() + 1);
  } else {
    // Monday-Thursday -> next working day is tomorrow (+1 day)
    next.setDate(next.getDate() + 1);
  }
  return next;
}

/** Recursively cleans undefined properties from objects/arrays so Firestore never throws */
function sanitizeFirestoreDoc<T>(obj: T): T {
  if (obj === null || obj === undefined) return null as any;
  if (Array.isArray(obj)) {
    return obj.map(sanitizeFirestoreDoc) as any;
  }
  if (typeof obj === "object" && !(obj instanceof Date)) {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = sanitizeFirestoreDoc(value);
      } else {
        cleaned[key] = null;
      }
    }
    return cleaned;
  }
  return obj;
}

/** Helper to convert task docs to summary task items */
function mapDocToSummaryItem(doc: any, kpiMap?: Map<string, string>): DailySummaryTaskItem {
  const data = doc.data ? doc.data() : doc;
  const id = doc.id || data.id;
  const kpiName = data.kpiTemplateId && kpiMap ? kpiMap.get(data.kpiTemplateId) || null : null;
  const priority = data.urgent && data.important
    ? "Do First"
    : !data.urgent && data.important
    ? "Schedule"
    : data.urgent && !data.important
    ? "Delegate"
    : "Eliminate";

  return {
    id,
    title: data.title || "Untitled Task",
    status: data.status || "NEW",
    priority,
    sizeLabel: data.sizeLabel || null,
    estimatedMins: data.estimatedMins ?? null,
    dueAt: parseDate(data.dueAt)?.toISOString() || null,
    completedAt: parseDate(data.completedAt)?.toISOString() || null,
    holdReason: data.holdReason || null,
    rejectionReason: data.rejectionReason || null,
    carryCount: data.carryCount || 0,
    kpiName,
    projectName: data.projectName || null,
    basePoints: data.basePoints !== undefined && data.basePoints !== null ? Number(data.basePoints) : null,
    qualityBonusPoints: data.qualityBonusPoints !== undefined && data.qualityBonusPoints !== null ? Number(data.qualityBonusPoints) : null,
    totalApprovedPoints: data.totalApprovedPoints !== undefined && data.totalApprovedPoints !== null ? Number(data.totalApprovedPoints) : null,
    managerScore: data.managerScore !== undefined && data.managerScore !== null ? Number(data.managerScore) : null,
  };
}

/**
 * Computes a live or snapshot daily work summary for a specific employee on a given targetDate.
 */
export async function computeEmployeeDailySummary(
  employee: any,
  targetDate: Date,
  options?: {
    performCarryForward?: boolean;
    preloadedTasks?: any[];
    kpiMap?: Map<string, string>;
  }
): Promise<EmployeeDailyWorkSummary> {
  const dayStart = new Date(targetDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(targetDate);
  dayEnd.setHours(23, 59, 59, 999);

  const dateKey = formatDateKey(dayStart);
  const dateLabel = formatDisplayDate(dayStart);
  const summaryDocId = `${employee.id}_${dateKey}`;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const isToday = dayStart.getTime() === todayStart.getTime();

  // 1. Resolve KPI templates
  let kpiMap = options?.kpiMap;
  if (!kpiMap) {
    const kpiSnap = await adminDb.collection("KpiTemplate").get();
    kpiMap = new Map<string, string>();
    kpiSnap.docs?.forEach((d) => kpiMap!.set(d.id, d.data().kpiName));
  }

  // 2. Resolve employee tasks (use preloaded if provided, or single-field query without composite index)
  let rawTasks: any[] = [];
  if (options?.preloadedTasks) {
    rawTasks = options.preloadedTasks;
  } else {
    const snap = await adminDb
      .collection("Task")
      .where("assigneeId", "==", employee.id)
      .get();
    rawTasks = (snap.docs || []).map((d) => ({ id: d.id, ...d.data(), ref: d.ref }));
  }

  const completedTasks: DailySummaryTaskItem[] = [];
  const pendingTasks: DailySummaryTaskItem[] = [];
  const onHoldTasks: DailySummaryTaskItem[] = [];
  const inReviewTasks: DailySummaryTaskItem[] = [];
  const unfinishedTaskDocs: any[] = [];

  let newTasksCount = 0;

  for (const doc of rawTasks) {
    const data = doc.data ? doc.data() : doc;
    if (data.deletedAt) continue; // omit soft-deleted tasks

    const createdAt = parseDate(data.createdAt);
    const completedAt = parseDate(data.completedAt);
    const updatedAt = parseDate(data.updatedAt);
    const status = data.status || "NEW";

    // If the task was created after the target day ended, it didn't exist yet on this date
    if (createdAt && createdAt.getTime() > dayEnd.getTime()) {
      continue;
    }

    const item = mapDocToSummaryItem(doc, kpiMap);
    const isClosed = status === "CLOSED";

    // Completed on target date check:
    const completedOnTargetDate = isClosed && (
      (completedAt && completedAt >= dayStart && completedAt <= dayEnd) ||
      (isToday && (!completedAt || (updatedAt && updatedAt >= dayStart && updatedAt <= dayEnd)))
    );

    if (completedOnTargetDate) {
      completedTasks.push(item);
    } else if (!isClosed) {
      // Task is active / unfinished on this date
      unfinishedTaskDocs.push(doc);

      if (createdAt && createdAt >= dayStart && createdAt <= dayEnd) {
        newTasksCount++;
      }

      if (status === "ON_HOLD") {
        onHoldTasks.push(item);
      } else if (status === "PENDING_REVIEW") {
        inReviewTasks.push(item);
      } else {
        // NEW, ACCEPTED, IN_PROGRESS, REOPENED, CARRIED_FORWARD, TODO
        pendingTasks.push(item);
      }
    }
  }

  // Tomorrow's carry forward: all unfinished tasks (Pending + On Hold + In Review)
  const tomorrowCarryForwardTasks: DailySummaryTaskItem[] = [
    ...pendingTasks,
    ...onHoldTasks,
    ...inReviewTasks,
  ];

  // Total Tasks Planned for the Day = Completed + All Unfinished
  const completedCount = completedTasks.length;
  const pendingCount = pendingTasks.length;
  const onHoldCount = onHoldTasks.length;
  const inReviewCount = inReviewTasks.length;
  const carryForwardCount = tomorrowCarryForwardTasks.length;
  const totalTasks = completedCount + carryForwardCount;

  // Daily Productivity (%) = (Completed Tasks ÷ Total Tasks Planned for the Day) × 100
  let productivityPercentage: number | null = null;
  let productivityLabel = "N/A";
  if (totalTasks > 0) {
    productivityPercentage = Math.round((completedCount / totalTasks) * 100);
    productivityLabel = `${productivityPercentage}%`;
  }

  const nextWorkingDay = getNextWorkingDay(dayStart);
  const nextWorkingDayStr = formatDateKey(nextWorkingDay);

  // Perform safe carry-forward on task documents if requested
  if (options?.performCarryForward && unfinishedTaskDocs.length > 0) {
    const batch = adminDb.batch();
    let hasUpdates = false;
    for (const doc of unfinishedTaskDocs) {
      const docRef = doc.ref || adminDb.collection("Task").doc(doc.id);
      const data = doc.data ? doc.data() : doc;

      // Rule: Tasks created on targetDate (today) cannot be carried forward while targetDate is still ongoing!
      // A task created today is for today; it has never been carried over from a past day.
      const taskCreatedAt = parseDate(data.createdAt);
      if (isToday && taskCreatedAt && taskCreatedAt >= dayStart) {
        continue;
      }

      // Idempotency: only increment carryCount if not already carried from this dateKey
      const lastCarried = data.lastCarriedFromDate;
      const currentCarryCount = data.carryCount || 0;
      const newCarryCount = lastCarried === dateKey ? currentCarryCount : currentCarryCount + 1;

      batch.update(docRef, {
        carryForwardDate: nextWorkingDay,
        carryCount: newCarryCount,
        lastCarriedFromDate: dateKey,
        updatedAt: new Date(),
      });
      hasUpdates = true;
    }
    if (hasUpdates) {
      await batch.commit();
    }
  }

  // Calculate Quality-Based Reward Points earned today
  let basePointsEarned = 0;
  let qualityBonusPointsEarned = 0;
  let totalApprovedPointsEarned = 0;
  for (const t of completedTasks) {
    if (t.basePoints) basePointsEarned += t.basePoints;
    if (t.qualityBonusPoints) qualityBonusPointsEarned += t.qualityBonusPoints;
    if (t.totalApprovedPoints) totalApprovedPointsEarned += t.totalApprovedPoints;
  }

  const summaryRecord: EmployeeDailyWorkSummary = {
    id: summaryDocId,
    employeeId: employee.id,
    employeeName: employee.name || "Employee",
    employeeEmail: employee.email || "",
    avatarUrl: employee.avatarUrl || null,
    roleTitle: employee.roleTitle || employee.role?.title || "Team Member",
    departmentName: employee.departmentName || employee.department?.name || "General",
    date: dateKey,
    dateLabel,
    totalTasks,
    completedCount,
    pendingCount,
    onHoldCount,
    inReviewCount,
    carryForwardCount,
    newTasksCount,
    productivityPercentage,
    productivityLabel,
    basePointsEarned: Math.round(basePointsEarned * 10) / 10,
    qualityBonusPointsEarned: Math.round(qualityBonusPointsEarned * 10) / 10,
    totalApprovedPointsEarned: Math.round(totalApprovedPointsEarned * 10) / 10,
    completedTasks,
    pendingTasks,
    onHoldTasks,
    inReviewTasks,
    tomorrowCarryForwardTasks,
    carriedForwardToDate: nextWorkingDayStr,
    isAutoGenerated: !!options?.performCarryForward,
    updatedAt: new Date().toISOString(),
  };

  // Persist / snapshot the summary in Firestore permanently
  await adminDb
    .collection("DailyWorkSummary")
    .doc(summaryDocId)
    .set(
      sanitizeFirestoreDoc({
        ...summaryRecord,
        createdAt: new Date().toISOString(),
      }),
      { merge: true }
    );

  return summaryRecord;
}

/**
 * Loads or generates the daily work summary for a specific employee.
 * If a historical snapshot already exists for a past date with valid tasks, returns the snapshot.
 * If viewing today or if no record exists, generates and stores it.
 */
export async function getEmployeeDailyWorkSummary(
  employee: any,
  targetDate: Date,
  forceRegenerate: boolean = false
): Promise<EmployeeDailyWorkSummary> {
  const dayStart = new Date(targetDate);
  dayStart.setHours(0, 0, 0, 0);
  const dateKey = formatDateKey(dayStart);
  const summaryDocId = `${employee.id}_${dateKey}`;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const isToday = dayStart.getTime() === todayStart.getTime();

  if (!forceRegenerate && !isToday) {
    const existingSnap = await adminDb.collection("DailyWorkSummary").doc(summaryDocId).get();
    if (existingSnap.exists) {
      const data = existingSnap.data() as any;
      if (data && (data.totalTasks > 0 || data.completedCount > 0)) {
        return {
          ...data,
          id: existingSnap.id,
        };
      }
    }
  }

  // Fetch employee's tasks and KPI template with single-field queries (no composite index needed)
  const [tasksSnap, kpiSnap] = await Promise.all([
    adminDb.collection("Task").where("assigneeId", "==", employee.id).get(),
    adminDb.collection("KpiTemplate").get(),
  ]);

  const kpiMap = new Map<string, string>();
  kpiSnap.docs?.forEach((d) => kpiMap.set(d.id, d.data().kpiName));
  const preloadedTasks = (tasksSnap.docs || []).map((d) => ({ id: d.id, ...d.data(), ref: d.ref }));

  return computeEmployeeDailySummary(employee, targetDate, {
    performCarryForward: false,
    preloadedTasks,
    kpiMap,
  });
}

/**
 * Runs the End-of-Day Summary and Carry-Forward process across all active employees or a specific employee.
 * Completely idempotent and safe to retry.
 */
export async function runEndOfDayProcess(
  targetDate: Date = new Date(),
  targetEmployeeId?: string
): Promise<{
  processedCount: number;
  dateKey: string;
  nextWorkingDay: string;
  summaries: EmployeeDailyWorkSummary[];
}> {
  const dayStart = new Date(targetDate);
  dayStart.setHours(0, 0, 0, 0);
  const dateKey = formatDateKey(dayStart);
  const nextWorkingDay = getNextWorkingDay(dayStart);
  const nextWorkingDayStr = formatDateKey(nextWorkingDay);

  // Fetch employees, roles, departments, tasks, and KPI templates in parallel
  const [allEmpsSnap, rolesSnap, departmentsSnap, allTasksSnap, kpiSnap] = await Promise.all([
    adminDb.collection("Employee").get(),
    fetchAllRoles(adminDb),
    fetchAllDepartments(adminDb),
    adminDb.collection("Task").get(),
    adminDb.collection("KpiTemplate").get(),
  ]);

  const rolesMap = new Map<string, any>();
  rolesSnap.docs?.forEach((d: any) => rolesMap.set(d.id, d.data()));

  const deptsMap = new Map<string, any>();
  departmentsSnap.docs?.forEach((d: any) => deptsMap.set(d.id, { id: d.id, name: d.data().name || "General" }));

  const kpiMap = new Map<string, string>();
  kpiSnap.docs?.forEach((d: any) => kpiMap.set(d.id, d.data().kpiName));

  const tasksByAssignee = new Map<string, any[]>();
  allTasksSnap.docs?.forEach((doc: any) => {
    const data = doc.data();
    if (data.deletedAt) return;
    const assigneeId = data.assigneeId;
    if (!assigneeId) return;
    if (!tasksByAssignee.has(assigneeId)) {
      tasksByAssignee.set(assigneeId, []);
    }
    tasksByAssignee.get(assigneeId)!.push({ id: doc.id, ...data, ref: doc.ref });
  });

  let targetEmps: any[] = [];
  allEmpsSnap.docs?.forEach((d) => {
    const data = d.data();
    if (data.active !== false) {
      const role = data.roleId ? rolesMap.get(data.roleId) : null;
      const roleTitle = role?.title || data.roleTitle || "Team Member";
      const resolvedDeptId = data.departmentId || role?.departmentId || null;
      const deptObj = resolvedDeptId ? deptsMap.get(resolvedDeptId) : null;
      const departmentName = deptObj?.name || data.departmentName || "General";
      const departmentId = resolvedDeptId || deptObj?.id || "dept-general";

      targetEmps.push({
        id: d.id,
        ...data,
        name: data.name || "Employee",
        roleTitle,
        departmentId,
        departmentName,
      });
    }
  });

  if (targetEmployeeId) {
    targetEmps = targetEmps.filter((e) => e.id === targetEmployeeId);
  }

  const summaries: EmployeeDailyWorkSummary[] = [];

  for (const emp of targetEmps) {
    const empTasks = tasksByAssignee.get(emp.id) || [];
    const summary = await computeEmployeeDailySummary(emp, dayStart, {
      performCarryForward: true,
      preloadedTasks: empTasks,
      kpiMap,
    });
    summaries.push(summary);
  }

  return {
    processedCount: summaries.length,
    dateKey,
    nextWorkingDay: nextWorkingDayStr,
    summaries,
  };
}

/**
 * Loads company or team-wide daily work summaries for permitted employees for the target date.
 */
export async function loadCompanyDailyWorkSummaries(
  targetDate: Date = new Date(),
  viewerUser: any,
  requestedEmployeeId?: string
): Promise<CompanyDailyWorkSummariesResult> {
  const dayStart = new Date(targetDate);
  dayStart.setHours(0, 0, 0, 0);
  const dateValue = formatDateKey(dayStart);
  const dateLabel = formatDisplayDate(dayStart);

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const isToday = dayStart.getTime() === todayStart.getTime();

  // 1. Fetch all required company collections in parallel
  const [rolesSnap, departmentsSnap, allEmpsSnap, allTasksSnap, kpiSnap] = await Promise.all([
    fetchAllRoles(adminDb),
    fetchAllDepartments(adminDb),
    adminDb.collection("Employee").get(),
    adminDb.collection("Task").get(),
    adminDb.collection("KpiTemplate").get(),
  ]);

  const rolesMap = new Map<string, any>();
  rolesSnap.docs?.forEach((d: any) => rolesMap.set(d.id, d.data()));

  const deptsMap = new Map<string, any>();
  departmentsSnap.docs?.forEach((d: any) => deptsMap.set(d.id, { id: d.id, name: d.data().name || "General" }));

  const kpiMap = new Map<string, string>();
  kpiSnap.docs?.forEach((d: any) => kpiMap.set(d.id, d.data().kpiName));

  // Index active tasks by assigneeId
  const tasksByAssignee = new Map<string, any[]>();
  allTasksSnap.docs?.forEach((doc: any) => {
    const data = doc.data();
    if (data.deletedAt) return; // ignore soft-deleted
    const assigneeId = data.assigneeId;
    if (!assigneeId) return;
    if (!tasksByAssignee.has(assigneeId)) {
      tasksByAssignee.set(assigneeId, []);
    }
    tasksByAssignee.get(assigneeId)!.push({ id: doc.id, ...data, ref: doc.ref });
  });

  // Resolve all active employees with direct + role-fallback department resolution
  const allActiveEmps: any[] = [];
  allEmpsSnap.docs?.forEach((d) => {
    const data = d.data();
    if (data.active !== false) {
      const role = data.roleId ? rolesMap.get(data.roleId) : null;
      const roleTitle = role?.title || data.roleTitle || "Team Member";
      const resolvedDeptId = data.departmentId || role?.departmentId || null;
      const deptObj = resolvedDeptId ? deptsMap.get(resolvedDeptId) : null;
      const departmentName = deptObj?.name || data.departmentName || "General";
      const departmentId = resolvedDeptId || deptObj?.id || "dept-general";

      allActiveEmps.push({
        id: d.id,
        ...data,
        name: data.name || "Employee",
        roleTitle,
        departmentId,
        departmentName,
      });
    }
  });

  allActiveEmps.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  // Find viewer's department name early
  let userDepartmentName: string | undefined = undefined;
  if (viewerUser) {
    const found = allActiveEmps.find((e) => e.id === viewerUser.id);
    if (found) userDepartmentName = found.departmentName;
  }

  let viewScope: "COMPANY" | "TEAM" | "SELF" = "COMPANY";
  let permittedEmployees: any[] = [];
  const permittedDeptNames = new Set<string>();

  const isExec = !viewerUser ? true : isExecutiveOrAdmin(viewerUser);

  if (isExec) {
    // 1. CEO, COO, and ADMIN: full access to all company departments and all employees
    viewScope = "COMPANY";
    permittedEmployees = allActiveEmps;
  } else {
    // 2. Managers: can see who reports to them (direct or indirect reports) + themselves
    const subordinates = getSubordinateEmployees(viewerUser.id, allActiveEmps);
    const isMgr = isManagerLike(viewerUser.systemRole, viewerUser.systemRoleObj) || subordinates.length > 0;

    if (isMgr) {
      viewScope = "TEAM";
      const selfEmp = allActiveEmps.find((e) => e.id === viewerUser.id) || viewerUser;
      const combined = [selfEmp, ...subordinates];
      const seen = new Set<string>();
      permittedEmployees = combined.filter((e) => {
        if (seen.has(e.id)) return false;
        seen.add(e.id);
        return true;
      });

      // Manager department scope: their own department + all departments of reporting members
      if (userDepartmentName) permittedDeptNames.add(userDepartmentName);
      permittedEmployees.forEach((e) => {
        if (e.departmentName) permittedDeptNames.add(e.departmentName);
      });
    } else {
      // 3. Regular Employees: can ONLY see their own individual summary & their own department
      viewScope = "SELF";
      const selfEmp = allActiveEmps.find((e) => e.id === viewerUser.id);
      permittedEmployees = selfEmp ? [selfEmp] : [viewerUser];

      if (userDepartmentName) permittedDeptNames.add(userDepartmentName);
    }
  }

  // 2. Load or Compute Daily Work Summary for all active employees using preloaded tasks
  const allSummariesMap = new Map<string, EmployeeDailyWorkSummary>();
  const summaryPromises = allActiveEmps.map(async (emp) => {
    try {
      const empTasks = tasksByAssignee.get(emp.id) || [];
      const summary = await computeEmployeeDailySummary(emp, dayStart, {
        performCarryForward: false,
        preloadedTasks: empTasks,
        kpiMap,
      });
      return { empId: emp.id, summary };
    } catch (err) {
      console.error(`Failed to load daily work summary for ${emp.name}:`, err);
      return null;
    }
  });

  const loadedResults = await Promise.all(summaryPromises);
  loadedResults.forEach((item) => {
    if (item && item.summary) allSummariesMap.set(item.empId, item.summary);
  });

  // Filter summaries for permitted individual view
  const summaries: EmployeeDailyWorkSummary[] = [];
  for (const emp of permittedEmployees) {
    const s = allSummariesMap.get(emp.id);
    if (s) summaries.push(s);
  }

  // 3. Build Department-Wise Daily Work Summaries
  // Group all active employees by department and aggregate metrics & task lists
  const deptMap = new Map<string, { id: string; name: string; emps: any[] }>();
  allActiveEmps.forEach((emp) => {
    const dName = emp.departmentName || "General";
    const dId = emp.departmentId || dName;
    if (!deptMap.has(dName)) {
      deptMap.set(dName, { id: dId, name: dName, emps: [] });
    }
    deptMap.get(dName)!.emps.push(emp);
  });

  const departmentSummaries: DepartmentDailyWorkSummary[] = [];

  for (const [deptName, deptInfo] of deptMap.entries()) {
    const deptMembers: DepartmentEmployeeSummary[] = [];
    const deptCompletedTasks: DepartmentTaskItem[] = [];
    const deptPendingTasks: DepartmentTaskItem[] = [];
    const deptOnHoldTasks: DepartmentTaskItem[] = [];
    const deptInReviewTasks: DepartmentTaskItem[] = [];
    const deptTomorrowCarryForwardTasks: DepartmentTaskItem[] = [];

    let totalTasks = 0;
    let completedCount = 0;
    let pendingCount = 0;
    let onHoldCount = 0;
    let inReviewCount = 0;
    let carryForwardCount = 0;

    for (const emp of deptInfo.emps) {
      const s = allSummariesMap.get(emp.id);
      if (!s) continue;

      deptMembers.push({
        employeeId: emp.id,
        employeeName: emp.name,
        employeeEmail: emp.email,
        avatarUrl: emp.avatarUrl || null,
        roleTitle: emp.roleTitle,
        totalTasks: s.totalTasks,
        completedCount: s.completedCount,
        pendingCount: s.pendingCount,
        onHoldCount: s.onHoldCount,
        inReviewCount: s.inReviewCount,
        carryForwardCount: s.carryForwardCount,
        productivityPercentage: s.productivityPercentage,
        productivityLabel: s.productivityLabel,
        completedTasks: s.completedTasks,
        pendingTasks: s.pendingTasks,
        onHoldTasks: s.onHoldTasks,
        inReviewTasks: s.inReviewTasks,
        tomorrowCarryForwardTasks: s.tomorrowCarryForwardTasks,
      });

      totalTasks += s.totalTasks;
      completedCount += s.completedCount;
      pendingCount += s.pendingCount;
      onHoldCount += s.onHoldCount;
      inReviewCount += s.inReviewCount;
      carryForwardCount += s.carryForwardCount;

      s.completedTasks.forEach((t) =>
        deptCompletedTasks.push({
          ...t,
          assigneeId: emp.id,
          assigneeName: emp.name,
          assigneeRole: emp.roleTitle,
        })
      );
      s.pendingTasks.forEach((t) =>
        deptPendingTasks.push({
          ...t,
          assigneeId: emp.id,
          assigneeName: emp.name,
          assigneeRole: emp.roleTitle,
        })
      );
      s.onHoldTasks.forEach((t) =>
        deptOnHoldTasks.push({
          ...t,
          assigneeId: emp.id,
          assigneeName: emp.name,
          assigneeRole: emp.roleTitle,
        })
      );
      s.inReviewTasks.forEach((t) =>
        deptInReviewTasks.push({
          ...t,
          assigneeId: emp.id,
          assigneeName: emp.name,
          assigneeRole: emp.roleTitle,
        })
      );
      s.tomorrowCarryForwardTasks.forEach((t) =>
        deptTomorrowCarryForwardTasks.push({
          ...t,
          assigneeId: emp.id,
          assigneeName: emp.name,
          assigneeRole: emp.roleTitle,
        })
      );
    }

    // Department Task Completion Productivity (%) = (Completed ÷ Total Planned) × 100
    let productivityPercentage: number | null = null;
    let productivityLabel = "N/A";
    if (totalTasks > 0) {
      productivityPercentage = Math.round((completedCount / totalTasks) * 100);
      productivityLabel = `${productivityPercentage}%`;
    }

    departmentSummaries.push({
      departmentId: deptInfo.id,
      departmentName: deptName,
      date: dateValue,
      dateLabel,
      totalEmployees: deptInfo.emps.length,
      reportingEmployeesCount: deptMembers.length,
      totalTasks,
      completedCount,
      pendingCount,
      onHoldCount,
      inReviewCount,
      carryForwardCount,
      productivityPercentage,
      productivityLabel,
      members: deptMembers,
      completedTasks: deptCompletedTasks,
      pendingTasks: deptPendingTasks,
      onHoldTasks: deptOnHoldTasks,
      inReviewTasks: deptInReviewTasks,
      tomorrowCarryForwardTasks: deptTomorrowCarryForwardTasks,
    });
  }

  // Filter departmentSummaries according to role permissions:
  // - CEO/COO/Admin see all company departments
  // - Managers see their own department + reporting members' departments
  // - Regular employees see ONLY their own department
  let scopedDepartmentSummaries = departmentSummaries;
  if (!isExec) {
    scopedDepartmentSummaries = departmentSummaries.filter((d) =>
      permittedDeptNames.has(d.departmentName)
    );
    // Discrepancy fallback: ensure at least user's department is present if active
    if (scopedDepartmentSummaries.length === 0 && userDepartmentName) {
      scopedDepartmentSummaries = departmentSummaries.filter(
        (d) => d.departmentName.toLowerCase() === userDepartmentName!.toLowerCase()
      );
    }
  }

  // Sort departments: put user's own department first, then alphabetical
  scopedDepartmentSummaries.sort((a, b) => {
    if (userDepartmentName && a.departmentName === userDepartmentName) return -1;
    if (userDepartmentName && b.departmentName === userDepartmentName) return 1;
    return a.departmentName.localeCompare(b.departmentName);
  });

  // 4. Compute Team Aggregate Metrics
  let totalPlannedTasks = 0;
  let totalCompletedTasks = 0;
  let totalPendingTasks = 0;
  let totalOnHoldTasks = 0;
  let totalInReviewTasks = 0;
  let totalCarryForwardTasks = 0;
  let productivitySum = 0;
  let productiveEmpsCount = 0;

  for (const s of summaries) {
    totalPlannedTasks += s.totalTasks;
    totalCompletedTasks += s.completedCount;
    totalPendingTasks += s.pendingCount;
    totalOnHoldTasks += s.onHoldCount;
    totalInReviewTasks += s.inReviewCount;
    totalCarryForwardTasks += s.carryForwardCount;

    if (s.productivityPercentage !== null) {
      productivitySum += s.productivityPercentage;
      productiveEmpsCount++;
    }
  }

  const averageProductivityPercentage =
    totalPlannedTasks > 0
      ? Math.round((totalCompletedTasks / totalPlannedTasks) * 100)
      : productiveEmpsCount > 0
      ? Math.round(productivitySum / productiveEmpsCount)
      : null;

  const averageProductivityLabel =
    averageProductivityPercentage !== null ? `${averageProductivityPercentage}%` : "N/A";

  const teamMetrics: TeamDailySummaryMetrics = {
    totalEmployees: permittedEmployees.length,
    reportedEmployeesCount: summaries.length,
    totalPlannedTasks,
    totalCompletedTasks,
    totalPendingTasks,
    totalOnHoldTasks,
    totalInReviewTasks,
    totalCarryForwardTasks,
    averageProductivityPercentage,
    averageProductivityLabel,
  };

  // 5. Determine which employee's detailed summary to highlight:
  let selectedSummary: EmployeeDailyWorkSummary | null = null;
  if (requestedEmployeeId) {
    selectedSummary = summaries.find((s) => s.employeeId === requestedEmployeeId) || null;
  }
  if (!selectedSummary) {
    if (viewerUser) {
      selectedSummary = summaries.find((s) => s.employeeId === viewerUser.id) || null;
    }
    if (!selectedSummary && summaries.length > 0) {
      selectedSummary = summaries[0];
    }
  }

  const employeesList = permittedEmployees.map((e) => ({
    id: e.id,
    name: e.name,
    roleTitle: e.roleTitle,
    departmentName: e.departmentName,
  }));

  return {
    dateValue,
    dateLabel,
    isToday,
    viewScope,
    userDepartmentName,
    teamMetrics,
    summaries,
    selectedSummary,
    employeesList,
    departmentSummaries: scopedDepartmentSummaries,
  };
}
