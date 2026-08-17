import { adminDb } from "@/lib/firebase/admin";
import { mondayOf } from "@/lib/date";
import { computeAdherence, type AdherenceResult } from "@/lib/adherence";
import { fetchKpiTemplatesByRole } from "@/lib/cache";

export type KpiFocus = { id: string; name: string; count: number; weightage: number };

export type DailyTaskAnalysis = {
  onTimeToday: number;
  lateToday: number;
  closedToday: number;
  weekOnTimeRate: number | null;
  weekClosed: number;
  adherence: AdherenceResult | null;
  reworkToday: number;
  reworkWeek: number;
  openRework: number;
  urgentImportantOpen: number;
  urgentImportantDueToday: number;
  kpiBuckets: KpiFocus[];
  mostWorked: KpiFocus | null;
  leastWorked: KpiFocus | null;
};

function toDate(val: any): Date | null {
  if (!val) return null;
  if (val.toDate) return val.toDate();
  return new Date(val);
}

/**
 * Load daily task analysis for a given employee.
 *
 * @param employeeId - The employee's Firestore ID
 * @param roleId - The employee's roleId (passed in to avoid re-fetching the Employee doc)
 *
 * Uses a date-bounded Task query (month start) instead of full task history.
 * For multi-status stats (openRework, urgentImportant) we also fetch the
 * open task slice so we don't need the full history.
 */
export async function loadDailyTaskAnalysis(
  employeeId: string,
  roleId?: string
): Promise<DailyTaskAnalysis> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);
  const weekStart = mondayOf();
  // Month start covers today, this week, and this month stats
  const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);

  // Two targeted queries instead of the full task history:
  //  1. Tasks from this month onward (for completed/rework/KPI stats)
  //  2. Currently open tasks (for openRework, urgent+important open)
  // Previously: ONE query for ALL tasks, then JS filtering across entire history.
  const [monthTasksSnap, openTasksSnap, ritualSnap, kpiTemplatesSnap] = await Promise.all([
    adminDb.collection("Task")
      .where("assigneeId", "==", employeeId)
      .where("createdAt", ">=", monthStart)
      .get(),
    adminDb.collection("Task")
      .where("assigneeId", "==", employeeId)
      .where("status", "!=", "CLOSED")
      .get(),
    adminDb.collection("DailyRitual")
      .where("employeeId", "==", employeeId)
      .where("date", "==", todayStart)
      .limit(1)
      .get(),
    // Use roleId from parameter to avoid re-fetching the Employee doc
    roleId
      ? fetchKpiTemplatesByRole(roleId, adminDb)
      : Promise.resolve({ docs: [] } as any),
  ]);

  const monthTasks = monthTasksSnap.docs || [];
  const openTasks = openTasksSnap.docs || [];

  // ── Closed-today and closed-this-week stats ───────────────────────────────
  const closedTodayTasks = monthTasks
    .filter(d => {
      const c = toDate(d.data().completedAt);
      return d.data().status === "CLOSED" && c && c >= todayStart && c < todayEnd;
    })
    .map(d => ({ id: d.id, dueAt: toDate(d.data().dueAt), completedAt: toDate(d.data().completedAt) }));

  const closedWeekTasks = monthTasks
    .filter(d => {
      const c = toDate(d.data().completedAt);
      return d.data().status === "CLOSED" && c && c >= weekStart;
    })
    .map(d => ({ dueAt: toDate(d.data().dueAt), completedAt: toDate(d.data().completedAt) }));

  const onTimeToday = closedTodayTasks.filter(t => !t.dueAt || (t.completedAt && t.completedAt <= t.dueAt!)).length;
  const lateToday = closedTodayTasks.length - onTimeToday;
  const onTimeWeek = closedWeekTasks.filter(t => !t.dueAt || (t.completedAt && t.completedAt <= t.dueAt!)).length;
  const weekOnTimeRate = closedWeekTasks.length ? Math.round((onTimeWeek / closedWeekTasks.length) * 100) : null;

  // ── Adherence ─────────────────────────────────────────────────────────────
  const closedTodayIds = closedTodayTasks.map(t => t.id);
  const ritual = !ritualSnap.empty ? ritualSnap.docs[0].data() : null;
  const adherence = computeAdherence(ritual?.plannedTaskIds ?? null, closedTodayIds);

  // ── Rework stats ──────────────────────────────────────────────────────────
  const reworkTodayCount = monthTasks.filter(d => {
    const r = toDate(d.data().rejectedAt);
    return r && r >= todayStart && r < todayEnd;
  }).length;
  const reworkWeekCount = monthTasks.filter(d => {
    const r = toDate(d.data().rejectedAt);
    return r && r >= weekStart;
  }).length;

  // ── Open task stats (from openTasksSnap, not full history) ───────────────
  const openReworkCount = openTasks.filter(d => d.data().status === "REOPENED" && !d.data().deletedAt).length;
  const uiOpenCount = openTasks.filter(d => d.data().urgent && d.data().important && !d.data().deletedAt).length;
  const uiDueTodayCount = openTasks.filter(d => {
    const due = toDate(d.data().dueAt);
    return d.data().urgent && d.data().important && !d.data().deletedAt && due && due >= todayStart && due < todayEnd;
  }).length;

  // ── KPI bucket stats ──────────────────────────────────────────────────────
  const kpiOptions = kpiTemplatesSnap.docs
    ? kpiTemplatesSnap.docs
        .sort((a: any, b: any) => (a.data().orderIndex ?? 0) - (b.data().orderIndex ?? 0))
        .map((d: any) => ({ id: d.id, ...d.data() })) as any[]
    : [];

  const weekTasksFiltered = monthTasks.filter(d => {
    const c = toDate(d.data().createdAt);
    return c && c >= weekStart && !d.data().deletedAt;
  });

  const countByKpi = new Map<string, number>();
  for (const doc of weekTasksFiltered) {
    const kpiId = doc.data().kpiTemplateId;
    if (!kpiId) continue;
    countByKpi.set(kpiId, (countByKpi.get(kpiId) ?? 0) + 1);
  }
  const kpiBuckets: KpiFocus[] = kpiOptions.map(k => ({
    id: k.id,
    name: k.kpiName,
    count: countByKpi.get(k.id) ?? 0,
    weightage: k.weightage,
  }));
  const weighted = kpiBuckets.filter(b => b.weightage > 0);
  const mostWorked = weighted.length ? weighted.reduce((a, b) => (b.count > a.count ? b : a)) : null;
  const leastWorkedRaw = weighted.length > 1 ? weighted.reduce((a, b) => (b.count < a.count ? b : a)) : null;
  const leastWorked = leastWorkedRaw && mostWorked && leastWorkedRaw.count < mostWorked.count ? leastWorkedRaw : null;

  return {
    onTimeToday,
    lateToday,
    closedToday: closedTodayTasks.length,
    weekOnTimeRate,
    weekClosed: closedWeekTasks.length,
    adherence,
    reworkToday: reworkTodayCount,
    reworkWeek: reworkWeekCount,
    openRework: openReworkCount,
    urgentImportantOpen: uiOpenCount,
    urgentImportantDueToday: uiDueTodayCount,
    kpiBuckets,
    mostWorked,
    leastWorked,
  };
}
