import { adminDb } from "@/lib/firebase/admin";
import { incrementBand } from "@/lib/constants";
import { monthLabel, recentAverage } from "@/lib/scores";
import { behaviourPct, behaviourPctFromMany } from "@/lib/behaviour";
import { fetchKpiTemplatesByRole, batchFetchByIds } from "@/lib/cache";

export function readiness(avg: number) {
  if (avg >= 75) return { label: "Ready for promotion", tone: "bg-emerald-100 text-emerald-700" };
  if (avg >= 65) return { label: "Developing — on track", tone: "bg-blue-100 text-blue-700" };
  if (avg >= 45) return { label: "Needs improvement", tone: "bg-amber-100 text-amber-700" };
  return { label: "Below expectations", tone: "bg-red-100 text-red-700" };
}

function toNum(val: any): number { return typeof val === "number" ? val : 0; }

export async function loadEmployeePerformance(employeeId: string) {
  const nowYear = new Date().getFullYear();
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const [cardsSnap, reviewSnap, behaviourSnap, employeeDoc] = await Promise.all([
    adminDb.collection("MonthlyScorecard").where("employeeId", "==", employeeId).get(),
    adminDb.collection("YearlyReview").where("employeeId", "==", employeeId).where("year", "==", nowYear).limit(1).get(),
    adminDb.collection("BehaviourReview").where("employeeId", "==", employeeId).get(),
    adminDb.collection("Employee").doc(employeeId).get(),
  ]);

  const cards = cardsSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as any)
    .sort((a, b) => (a.year - b.year) || (a.month - b.month));
  const review = !reviewSnap.empty ? reviewSnap.docs[0].data() : null;
  const behaviourAll = behaviourSnap.docs
    .map((d) => d.data() as any)
    .sort((a, b) => (b.year - a.year) || (b.month - a.month));

  const trend = cards.map((c) => ({
    label: monthLabel(c.year, c.month),
    auto: c.autoTotal || null,
    manager: c.total,
  }));
  const latestFinal = cards[cards.length - 1];
  const avg = recentAverage(cards);
  const band = incrementBand(avg);
  const ready = readiness(avg);

  const behaviourThisYear = behaviourAll.filter((b) => b.year === nowYear);
  const behaviourYearPct = behaviourPctFromMany(behaviourThisYear);
  const behaviourByMonth = new Map(behaviourAll.map((b) => [`${b.year}-${b.month}`, b]));

  const kpiComponent = Math.round((Math.min(100, avg) / 100) * 5 * 10) / 10;
  const behaviourComponent = behaviourYearPct != null ? Math.round((behaviourYearPct / 100) * 5 * 10) / 10 : null;
  const targetComponent = review?.targetAchievedPct != null ? Math.round((review.targetAchievedPct / 100) * 10 * 10) / 10 : null;
  const incrementTotal = kpiComponent + (behaviourComponent ?? 0) + (targetComponent ?? 0);

  const history = [...cards].reverse().map((c) => {
    const bh = behaviourByMonth.get(`${c.year}-${c.month}`);
    return {
      key: `${c.year}-${c.month}`,
      label: monthLabel(c.year, c.month),
      auto: toNum(c.autoTotal),
      total: toNum(c.total),
      behaviour: bh ? behaviourPct(bh) / 10 : null,
    };
  });

  const employee = employeeDoc.exists ? { id: employeeDoc.id, ...employeeDoc.data() } as any : null;
  
  // Batch fetch role using cached data
  const roleIds = employee?.roleId ? [employee.roleId] : [];
  const rolesMap = await batchFetchByIds('Role', roleIds, adminDb);
  const roleData = employee?.roleId ? (rolesMap.get(employee.roleId) as any) : null;
  const employeeWithRole = employee ? { ...employee, role: roleData } : null;

  // Use cached KPI templates
  const kpiTemplatesSnap = employee?.roleId
    ? await fetchKpiTemplatesByRole(employee.roleId, adminDb)
    : { docs: [] } as any;
  const kpis = kpiTemplatesSnap.docs ? kpiTemplatesSnap.docs
    .sort((a: any, b: any) => (a.data().orderIndex ?? 0) - (b.data().orderIndex ?? 0))
    .map((d: any) => ({ id: d.id, ...d.data() })) as any[]
    : [];

  const kraMap = new Map<string, number>();
  for (const k of kpis) kraMap.set(k.kraName, (kraMap.get(k.kraName) ?? 0) + k.weightage);
  const bucketData = [...kraMap.entries()].map(([name, value]) => ({ name, value }));

  const allTasksSnap = await adminDb.collection("Task").where("assigneeId", "==", employeeId).get();
  const countByKpi = new Map<string, number>();
  for (const doc of allTasksSnap.docs) {
    const createdAt = doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : new Date(doc.data().createdAt ?? 0);
    if (createdAt < startOfMonth) continue;
    const kpiId = doc.data().kpiTemplateId;
    if (!kpiId) continue;
    countByKpi.set(kpiId, (countByKpi.get(kpiId) ?? 0) + 1);
  }
  const bucketFillData = kpis.map((k) => ({ id: k.id, name: k.kpiName, count: countByKpi.get(k.id) ?? 0 }));

  return {
    employee: employeeWithRole,
    trend,
    latestFinal,
    avg,
    band,
    ready,
    nowYear,
    kpiComponent,
    behaviourComponent,
    targetComponent,
    incrementTotal,
    history,
    bucketData,
    bucketFillData,
  };
}
