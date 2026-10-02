import { adminDb } from "@/lib/firebase/admin";
import { incrementBand } from "@/lib/constants";
import { monthLabel, recentAverage } from "@/lib/scores";
import { behaviourPct, behaviourPctFromMany } from "@/lib/behaviour";
import { fetchKpiTemplatesByRole, batchFetchByIds } from "@/lib/cache";
import { calculateKpiPerformanceAnalytics } from "@/lib/kpiPoints";

export function readiness(avg: number) {
  if (avg >= 75) return { label: "Ready for promotion", tone: "bg-emerald-100 text-emerald-700" };
  if (avg >= 65) return { label: "Developing — on track", tone: "bg-blue-100 text-blue-700" };
  if (avg >= 45) return { label: "Needs improvement", tone: "bg-amber-100 text-amber-700" };
  return { label: "Below expectations", tone: "bg-red-100 text-red-700" };
}

function toNum(val: any): number { return typeof val === "number" ? val : 0; }

function toPlainObject<T>(val: T): T {
  if (val === null || val === undefined) return val;

  if (typeof (val as any).toDate === "function") {
    return (val as any).toDate().toISOString() as any;
  }

  if (val instanceof Date) {
    return val.toISOString() as any;
  }

  if (
    typeof val === "object" &&
    "_seconds" in (val as any) &&
    typeof (val as any)._seconds === "number"
  ) {
    const sec = (val as any)._seconds;
    const nsec = (val as any)._nanoseconds || 0;
    return new Date(sec * 1000 + nsec / 1000000).toISOString() as any;
  }

  if (Array.isArray(val)) {
    return val.map(toPlainObject) as any;
  }

  if (typeof val === "object") {
    const res: Record<string, any> = {};
    for (const key of Object.keys(val)) {
      res[key] = toPlainObject((val as any)[key]);
    }
    return res as any;
  }

  return val;
}

export async function loadEmployeePerformance(employeeId: string) {
  const now = new Date();
  const nowYear = now.getFullYear();
  const nowMonth = now.getMonth() + 1;
  const startOfMonth = new Date(nowYear, now.getMonth(), 1);

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

  const trend: Array<{
    label: string;
    month: string;
    auto: number | null;
    autoScore?: number;
    manager: number | null;
    managerScore?: number;
    isLive?: boolean;
  }> = cards.map((c) => ({
    label: monthLabel(c.year, c.month),
    month: monthLabel(c.year, c.month),
    auto: c.autoTotal != null ? Math.round(c.autoTotal * 10) / 10 : null,
    autoScore: c.autoTotal != null ? Math.round(c.autoTotal * 10) / 10 : undefined,
    manager: c.total != null ? Math.round(c.total * 10) / 10 : null,
    managerScore: c.total != null ? Math.round(c.total * 10) / 10 : undefined,
    isLive: false,
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

  const monthTasksSnap = await adminDb.collection("Task")
    .where("assigneeId", "==", employeeId)
    .where("createdAt", ">=", startOfMonth)
    .get();

  const monthTasks = (monthTasksSnap.docs || [])
    .filter((d) => !d.data().deletedAt)
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        title: data.title,
        status: data.status,
        sizeLabel: data.sizeLabel ?? null,
        estimatedMins: data.estimatedMins ?? null,
        kpiTemplateId: data.kpiTemplateId ?? null,
        urgent: !!data.urgent,
        important: !!data.important,
        carryCount: data.carryCount || 0,
        reworkCount: data.reworkCount || 0,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || 0),
        completedAt: data.completedAt?.toDate ? data.completedAt.toDate() : (data.completedAt ? new Date(data.completedAt) : null),
        dueAt: data.dueAt?.toDate ? data.dueAt.toDate() : (data.dueAt ? new Date(data.dueAt) : null),
      };
    });

  const countByKpi = new Map<string, number>();
  for (const t of monthTasks) {
    if (!t.kpiTemplateId) continue;
    countByKpi.set(t.kpiTemplateId, (countByKpi.get(t.kpiTemplateId) ?? 0) + 1);
  }
  const bucketFillData = kpis.map((k) => ({ id: k.id, name: k.kpiName, count: countByKpi.get(k.id) ?? 0 }));

  // Compute rich KPI Performance Analytics (bucket-level points & individual task points)
  const kpiAnalytics = calculateKpiPerformanceAnalytics(kpis, monthTasks);

  // Add live current-month point to trend if not already finalized in cards
  const hasCurrentCard = cards.some((c) => c.year === nowYear && c.month === nowMonth);
  const hasLiveActivity = monthTasks.length > 0 || (kpiAnalytics && (kpiAnalytics.totalTasks > 0 || kpiAnalytics.totalPointsEarned > 0));

  if (!hasCurrentCard && hasLiveActivity) {
    const totalPossiblePoints = kpiAnalytics.totalPointsMax > 0 ? kpiAnalytics.totalPointsMax : 100;
    const earnedPoints = kpiAnalytics.totalPointsEarned;
    const liveScoreRaw = totalPossiblePoints > 0 ? (earnedPoints / totalPossiblePoints) * 100 : 0;
    const liveScore = Math.max(0, Math.min(100, Math.round(liveScoreRaw * 10) / 10));

    trend.push({
      label: `${monthLabel(nowYear, nowMonth)} • Live`,
      month: monthLabel(nowYear, nowMonth),
      auto: liveScore,
      autoScore: liveScore,
      manager: null,
      managerScore: undefined,
      isLive: true,
    });
  }

  const incrementMetadata = {
    scoringModel: "ANNUAL_INCREMENT" as const,
    maxTotalPct: 20,
    projectedTotalPct: Math.round(incrementTotal * 10) / 10,
    components: [
      {
        key: "kpi",
        label: "Task & KPI Performance",
        maxPct: 5,
        valuePct: kpiComponent,
        formula: "5% × (6-month average score ÷ 100)",
        basis: `Derived from 6-month average score of ${avg.toFixed(0)} / 100`,
      },
      {
        key: "behaviour",
        label: "Behaviour Review",
        maxPct: 5,
        valuePct: behaviourComponent,
        formula: "5% × (Behaviour assessment % ÷ 100)",
        basis: behaviourComponent != null ? `Assessed across 6 behavioural criteria (${behaviourYearPct?.toFixed(0)}%)` : "Pending manager review in Scoring Panel",
      },
      {
        key: "target",
        label: "Target vs Actual",
        maxPct: 10,
        valuePct: targetComponent,
        formula: "10% × (Target achievement % ÷ 100)",
        basis: targetComponent != null ? `Annual target achievement of ${review?.targetAchievedPct}%` : "Pending annual target achievement evaluation",
      },
    ],
  };

  return toPlainObject({
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
    incrementMetadata,
    history,
    bucketData,
    bucketFillData,
    kpiAnalytics,
  });
}
