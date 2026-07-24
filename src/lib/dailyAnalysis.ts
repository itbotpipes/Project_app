import { adminDb } from "@/lib/firebase/admin";
import { mondayOf } from "@/lib/date";
import { computeAdherence, type AdherenceResult } from "@/lib/adherence";

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

export async function loadDailyTaskAnalysis(employeeId: string): Promise<DailyTaskAnalysis> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);
  const weekStart = mondayOf();

  const [
    employeeDoc,
    closedTodaySnap,
    closedWeekSnap,
    ritualSnap,
    reworkTodaySnap,
    reworkWeekSnap,
    openReworkSnap,
    uiOpenSnap,
    uiDueTodaySnap,
    weekTasksSnap,
  ] = await Promise.all([
    adminDb.collection("Employee").doc(employeeId).get(),
    adminDb.collection("Task").where("assigneeId", "==", employeeId).where("status", "==", "CLOSED").get(),
    adminDb.collection("Task").where("assigneeId", "==", employeeId).where("status", "==", "CLOSED").get(),
    adminDb.collection("DailyRitual").where("employeeId", "==", employeeId).where("date", "==", todayStart).limit(1).get(),
    adminDb.collection("Task").where("assigneeId", "==", employeeId).get(),
    adminDb.collection("Task").where("assigneeId", "==", employeeId).get(),
    adminDb.collection("Task").where("assigneeId", "==", employeeId).get(),
    adminDb.collection("Task").where("assigneeId", "==", employeeId).where("urgent", "==", true).where("important", "==", true).get(),
    adminDb.collection("Task").where("assigneeId", "==", employeeId).where("urgent", "==", true).where("important", "==", true).get(),
    adminDb.collection("Task").where("assigneeId", "==", employeeId).get(),
  ]);

  // Filter in JS to avoid requiring Firebase composite indexes
  const closedAllSnap = closedTodaySnap; // reuse the full closed snap
  const closedTodayTasks = closedTodaySnap.docs
    .filter(d => { const c = toDate(d.data().completedAt); return c && c >= todayStart && c < todayEnd; })
    .map(d => ({ id: d.id, dueAt: toDate(d.data().dueAt), completedAt: toDate(d.data().completedAt) }));
  const closedWeekTasks = closedWeekSnap.docs
    .filter(d => { const c = toDate(d.data().completedAt); return c && c >= weekStart; })
    .map(d => ({ dueAt: toDate(d.data().dueAt), completedAt: toDate(d.data().completedAt) }));

  const onTimeToday = closedTodayTasks.filter((t) => !t.dueAt || (t.completedAt && t.completedAt <= t.dueAt!)).length;
  const lateToday = closedTodayTasks.length - onTimeToday;
  const onTimeWeek = closedWeekTasks.filter((t) => !t.dueAt || (t.completedAt && t.completedAt <= t.dueAt!)).length;
  const weekOnTimeRate = closedWeekTasks.length ? Math.round((onTimeWeek / closedWeekTasks.length) * 100) : null;

  const closedTodayIds = closedTodayTasks.map((t) => t.id);
  const ritual = !ritualSnap.empty ? ritualSnap.docs[0].data() : null;
  const adherence = computeAdherence(ritual?.plannedTaskIds ?? null, closedTodayIds);

  const employee = employeeDoc.exists ? employeeDoc.data() : null;
  const kpiOptions = employee?.roleId
    ? (await adminDb.collection("KpiTemplate").where("roleId", "==", employee.roleId).get()).docs
        .sort((a, b) => (a.data().orderIndex ?? 0) - (b.data().orderIndex ?? 0))
        .map((d) => ({ id: d.id, ...d.data() })) as any[]
    : [];

  // Filter week tasks in JS
  const weekTasksFiltered = weekTasksSnap.docs.filter(d => {
    const c = toDate(d.data().createdAt);
    return c && c >= weekStart && !d.data().deletedAt;
  });
  // Rejection filtering in JS
  const reworkTodayCount = reworkTodaySnap.docs.filter(d => { const r = toDate(d.data().rejectedAt); return r && r >= todayStart && r < todayEnd; }).length;
  const reworkWeekCount = reworkWeekSnap.docs.filter(d => { const r = toDate(d.data().rejectedAt); return r && r >= weekStart; }).length;
  // openRework: REOPENED and not deleted
  const openReworkCount = openReworkSnap.docs.filter(d => d.data().status === "REOPENED" && !d.data().deletedAt).length;
  // urgent+important open, not deleted
  const uiOpenCount = uiOpenSnap.docs.filter(d => d.data().status !== "CLOSED" && !d.data().deletedAt).length;
  // urgent+important due today
  const uiDueTodayCount = uiDueTodaySnap.docs.filter(d => {
    const due = toDate(d.data().dueAt);
    return d.data().status !== "CLOSED" && due && due >= todayStart && due < todayEnd;
  }).length;

  const countByKpi = new Map<string, number>();
  for (const doc of weekTasksFiltered) {
    const kpiId = doc.data().kpiTemplateId;
    if (!kpiId) continue;
    countByKpi.set(kpiId, (countByKpi.get(kpiId) ?? 0) + 1);
  }
  const kpiBuckets: KpiFocus[] = kpiOptions.map((k) => ({
    id: k.id,
    name: k.kpiName,
    count: countByKpi.get(k.id) ?? 0,
    weightage: k.weightage,
  }));
  const weighted = kpiBuckets.filter((b) => b.weightage > 0);
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
