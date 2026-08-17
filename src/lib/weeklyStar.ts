import { adminDb } from "@/lib/firebase/admin";
import { mondayOf } from "@/lib/date";
import { fetchAllRoles, batchFetchByIds } from "@/lib/cache";

export type WeeklyStarRow = {
  id: string;
  name: string;
  roleTitle: string;
  avatarUrl: string | null;
  closed: number;
  onTimeRate: number;
  bucketsCovered: number;
  bucketsTotal: number;
  index: number;
};

function toDate(val: any): Date | null {
  if (!val) return null;
  if (val.toDate) return val.toDate();
  return new Date(val);
}

export async function computeWeeklyStars(): Promise<WeeklyStarRow[]> {
  const weekStart = mondayOf();

  const [employeesSnap, closedTasksSnap, kpiTemplatesSnap] = await Promise.all([
    adminDb.collection("Employee").where("active", "==", true).get(),
    // Date-bounded: only tasks completed this week.
    // Previously: .where("status","==","CLOSED").get() fetched ALL closed tasks ever.
    // With a 50-person team and 2 years of history that's 50,000+ documents.
    adminDb.collection("Task")
      .where("status", "==", "CLOSED")
      .where("completedAt", ">=", weekStart)
      .get(),
    adminDb.collection("KpiTemplate").get(),
  ]);


  // Firestore already filtered completedAt >= weekStart, so all docs in this snap are this week.
  const filteredClosedTasks = closedTasksSnap.docs ?? [];


  // Only count KPIs that have weightage > 0
  const weightedKpis = kpiTemplatesSnap.docs ? kpiTemplatesSnap.docs.filter((d) => (d.data().weightage ?? 0) > 0) : [];

  // Resolve roles for each employee using batched cached fetch
  const roleIds = [...new Set(employeesSnap.docs ? employeesSnap.docs.map((d) => d.data().roleId).filter(Boolean) : [])];
  const rolesMap = await batchFetchByIds('Role', roleIds, adminDb);

  const kpiCountByRole = new Map<string, number>();
  for (const k of weightedKpis) {
    const roleId = k.data().roleId;
    kpiCountByRole.set(roleId, (kpiCountByRole.get(roleId) ?? 0) + 1);
  }

  const byEmp = new Map<string, any[]>();
  for (const doc of filteredClosedTasks) {
    const t = doc.data();
    const arr = byEmp.get(t.assigneeId) ?? [];
    arr.push(t);
    byEmp.set(t.assigneeId, arr);
  }

  const rows: WeeklyStarRow[] = employeesSnap.docs ? employeesSnap.docs.map((e) => {
    const emp = e.data();
    const role = rolesMap.get(emp.roleId) as any;
    const tasks = byEmp.get(e.id) ?? [];
    const closed = tasks.length;
    const onTime = tasks.filter((t) => {
      const due = toDate(t.dueAt);
      const completedAt = toDate(t.completedAt);
      return !due || (completedAt && completedAt <= due);
    }).length;
    const onTimeRate = closed ? Math.round((onTime / closed) * 100) : 0;
    const bucketsCovered = new Set(tasks.filter((t) => t.kpiTemplateId).map((t) => t.kpiTemplateId)).size;
    const bucketsTotal = kpiCountByRole.get(emp.roleId) ?? 0;
    const coverage = bucketsTotal ? Math.min(1, bucketsCovered / bucketsTotal) : 0;
    const volumeScore = Math.min(1, closed / 8);
    const index = Math.round(onTimeRate * 0.5 + volumeScore * 100 * 0.3 + coverage * 100 * 0.2);

    return {
      id: e.id,
      name: emp.name,
      roleTitle: role?.title ?? "",
      avatarUrl: emp.avatarUrl ?? null,
      closed,
      onTimeRate,
      bucketsCovered,
      bucketsTotal,
      index,
    };
  }) : [];

  return rows.filter((r) => r.closed > 0).sort((a, b) => b.index - a.index);
}
