import { adminDb } from "@/lib/firebase/admin";
import { incrementBand } from "@/lib/constants";
import { monthLabel, recentAverage } from "@/lib/scores";
import { mondayOf, monthStartOf } from "@/lib/date";
import { behaviourPct, behaviourPctFromMany } from "@/lib/behaviour";
import { fetchKpiTemplatesByRole, batchFetchByIds } from "@/lib/cache";
import { calculateKpiPerformanceAnalytics, calculateIndividualTaskPoints } from "@/lib/kpiPoints";

export function readiness(avg: number) {
  if (avg >= 75) return { label: "Ready for promotion", tone: "bg-emerald-100 text-emerald-700" };
  if (avg >= 65) return { label: "Developing — on track", tone: "bg-blue-100 text-blue-700" };
  if (avg >= 45) return { label: "Needs improvement", tone: "bg-amber-100 text-amber-700" };
  return { label: "Below expectations", tone: "bg-red-100 text-red-700" };
}

function toNum(val: any): number { return typeof val === "number" ? val : 0; }

function toDate(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (val.toDate) return val.toDate();
  const parsed = new Date(val);
  return isNaN(parsed.getTime()) ? null : parsed;
}

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
  const startOfMonth = monthStartOf(now);
  const weekStart = mondayOf(now);
  const minQueryDate = new Date(Math.min(startOfMonth.getTime(), weekStart.getTime()) - 30 * 86400000);

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
  const kpiMap = new Map<string, any>();
  for (const k of kpis) {
    kraMap.set(k.kraName, (kraMap.get(k.kraName) ?? 0) + k.weightage);
    kpiMap.set(k.id, k);
  }
  const bucketData = [...kraMap.entries()].map(([name, value]) => ({ name, value }));

  // Query recent tasks for employee
  const [createdTasksSnap, completedTasksSnap] = await Promise.all([
    adminDb.collection("Task")
      .where("assigneeId", "==", employeeId)
      .where("createdAt", ">=", minQueryDate)
      .get(),
    adminDb.collection("Task")
      .where("assigneeId", "==", employeeId)
      .where("completedAt", ">=", minQueryDate)
      .get(),
  ]);

  const rawDocsMap = new Map<string, any>();
  for (const d of createdTasksSnap.docs || []) {
    if (!d.data().deletedAt) rawDocsMap.set(d.id, { id: d.id, ...d.data() });
  }
  for (const d of completedTasksSnap.docs || []) {
    if (!d.data().deletedAt) rawDocsMap.set(d.id, { id: d.id, ...d.data() });
  }

  const allRawTasks = Array.from(rawDocsMap.values()).map((data) => {
    const createdAt = toDate(data.createdAt);
    const completedAt = toDate(data.completedAt);
    const dueAt = toDate(data.dueAt);
    const parentKpi = data.kpiTemplateId ? kpiMap.get(data.kpiTemplateId) : null;
    const kpiWeightage = parentKpi?.weightage ?? 20;
    const kpiName = parentKpi?.kpiName ?? "General / Unassigned";
    const kraName = parentKpi?.kraName ?? null;

    let isOnTime: boolean | null = null;
    if (dueAt && completedAt) {
      isOnTime = completedAt.getTime() <= dueAt.getTime();
    } else if (completedAt && !dueAt) {
      isOnTime = true;
    }

    const pointsCalc = calculateIndividualTaskPoints(
      {
        id: data.id,
        title: data.title,
        status: data.status,
        sizeLabel: data.sizeLabel ?? null,
        estimatedMins: data.estimatedMins ?? null,
        kpiTemplateId: data.kpiTemplateId ?? null,
        urgent: !!data.urgent,
        important: !!data.important,
        carryCount: data.carryCount || 0,
        reworkCount: data.reworkCount || 0,
        createdAt,
        completedAt,
        dueAt,
      },
      kpiWeightage,
      5.0,
      kpiName
    );

    return {
      id: data.id,
      title: data.title || "Untitled Task",
      status: data.status,
      sizeLabel: data.sizeLabel ?? null,
      estimatedMins: data.estimatedMins ?? null,
      kpiTemplateId: data.kpiTemplateId ?? null,
      kpiName,
      kraName,
      urgent: !!data.urgent,
      important: !!data.important,
      carryCount: data.carryCount || 0,
      reworkCount: data.reworkCount || 0,
      createdAt,
      completedAt,
      dueAt,
      isOnTime,
      earnedPoints: Math.round(pointsCalc.earnedPoints * 10) / 10,
      maxPoints: Math.round(pointsCalc.maxPoints * 10) / 10,
      pointsResult: pointsCalc,
    };
  });

  // Filter tasks for current month
  const monthTasks = allRawTasks.filter((t) => {
    const createdInMonth = t.createdAt && t.createdAt >= startOfMonth;
    const completedInMonth = t.completedAt && t.completedAt >= startOfMonth;
    return createdInMonth || completedInMonth;
  });

  // Filter tasks for current week
  const weekTasks = allRawTasks.filter((t) => {
    const createdInWeek = t.createdAt && t.createdAt >= weekStart;
    const completedInWeek = t.completedAt && t.completedAt >= weekStart;
    return createdInWeek || completedInWeek;
  });

  const countByKpi = new Map<string, number>();
  for (const t of monthTasks) {
    if (!t.kpiTemplateId) continue;
    countByKpi.set(t.kpiTemplateId, (countByKpi.get(t.kpiTemplateId) ?? 0) + 1);
  }
  const bucketFillData = kpis.map((k) => ({ id: k.id, name: k.kpiName, count: countByKpi.get(k.id) ?? 0 }));

  // Compute rich KPI Performance Analytics for month & week
  const kpiAnalytics = calculateKpiPerformanceAnalytics(kpis, monthTasks);
  const weeklyKpiAnalytics = calculateKpiPerformanceAnalytics(kpis, weekTasks);

  // Completed tasks lists
  const completedTasksThisMonth = monthTasks
    .filter((t) => t.status === "CLOSED" && t.completedAt && t.completedAt >= startOfMonth)
    .sort((a, b) => ((b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0)));

  const completedTasksThisWeek = weekTasks
    .filter((t) => t.status === "CLOSED" && t.completedAt && t.completedAt >= weekStart)
    .sort((a, b) => ((b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0)));

  const allCompletedTasks = allRawTasks
    .filter((t) => t.status === "CLOSED" && t.completedAt)
    .sort((a, b) => ((b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0)));

  // Weekly Stats Summary
  const weekClosedCount = completedTasksThisWeek.length;
  const weekTotalTasks = weekTasks.length;
  const weekOnTimeCount = completedTasksThisWeek.filter((t) => t.isOnTime).length;
  const weekOnTimeRate = weekClosedCount > 0 ? Math.round((weekOnTimeCount / weekClosedCount) * 100) : 0;
  const weekActiveDays = weeklyKpiAnalytics?.activeDaysTotal ?? 0;
  const weekReworkCount = weeklyKpiAnalytics?.buckets.reduce((sum, b) => sum + b.reworkCount, 0) ?? 0;
  const weekBucketsCovered = new Set(weekTasks.filter((t) => t.kpiTemplateId).map((t) => t.kpiTemplateId)).size;
  const weekBucketsTotal = kpis.length;
  const weekCoverageRate = weekBucketsTotal > 0 ? Math.min(1, weekBucketsCovered / weekBucketsTotal) : 0;
  const weekVolumeScore = Math.min(1, weekClosedCount / 8);
  const weeklyStarIndex = Math.round(weekOnTimeRate * 0.5 + weekVolumeScore * 100 * 0.3 + weekCoverageRate * 100 * 0.2);

  const weeklyLiveMeta = weeklyKpiAnalytics?.liveScoreMetadata;
  const weeklyEarnedPoints = weeklyLiveMeta?.earnedPoints ?? weeklyKpiAnalytics?.totalPointsEarned ?? 0;
  const weeklyPossiblePoints = weeklyLiveMeta?.possiblePoints ?? ((weeklyKpiAnalytics?.totalPointsMax && weeklyKpiAnalytics.totalPointsMax > 0) ? weeklyKpiAnalytics.totalPointsMax : 100);
  const weeklyLiveScore = weeklyLiveMeta?.scorePct ?? (weeklyPossiblePoints > 0 ? Math.max(0, Math.min(100, Math.round((weeklyEarnedPoints / weeklyPossiblePoints) * 1000) / 10)) : 0);

  const weeklyStats = {
    closedCount: weekClosedCount,
    totalTasks: weekTotalTasks,
    onTimeRate: weekOnTimeRate,
    activeDays: weekActiveDays,
    reworkCount: weekReworkCount,
    bucketsCovered: weekBucketsCovered,
    bucketsTotal: weekBucketsTotal,
    weeklyIndex: weeklyStarIndex,
    earnedPoints: weeklyEarnedPoints,
    possiblePoints: weeklyPossiblePoints,
    liveScore: weeklyLiveScore,
  };

  // Monthly Stats Summary
  const monthClosedCount = completedTasksThisMonth.length;
  const monthTotalTasks = monthTasks.length;
  const monthOnTimeCount = completedTasksThisMonth.filter((t) => t.isOnTime).length;
  const monthOnTimeRate = monthClosedCount > 0 ? Math.round((monthOnTimeCount / monthClosedCount) * 100) : 0;
  const monthActiveDays = kpiAnalytics?.activeDaysTotal ?? 0;
  const monthReworkCount = kpiAnalytics?.buckets.reduce((sum, b) => sum + b.reworkCount, 0) ?? 0;
  const monthLiveMeta = kpiAnalytics?.liveScoreMetadata;
  const monthEarnedPoints = monthLiveMeta?.earnedPoints ?? kpiAnalytics?.totalPointsEarned ?? 0;
  const monthPossiblePoints = monthLiveMeta?.possiblePoints ?? ((kpiAnalytics?.totalPointsMax && kpiAnalytics.totalPointsMax > 0) ? kpiAnalytics.totalPointsMax : 100);
  const monthLiveScore = monthLiveMeta?.scorePct ?? (monthPossiblePoints > 0 ? Math.max(0, Math.min(100, Math.round((monthEarnedPoints / monthPossiblePoints) * 1000) / 10)) : 0);

  const monthlyStats = {
    closedCount: monthClosedCount,
    totalTasks: monthTotalTasks,
    onTimeRate: monthOnTimeRate,
    activeDays: monthActiveDays,
    reworkCount: monthReworkCount,
    earnedPoints: monthEarnedPoints,
    possiblePoints: monthPossiblePoints,
    liveScore: monthLiveScore,
  };

  // Add live current-month point to trend if not already finalized in cards
  const hasCurrentCard = cards.some((c) => c.year === nowYear && c.month === nowMonth);
  const hasLiveActivity = monthTasks.length > 0 || (kpiAnalytics && (kpiAnalytics.totalTasks > 0 || kpiAnalytics.totalPointsEarned > 0));

  if (!hasCurrentCard && hasLiveActivity) {
    trend.push({
      label: `${monthLabel(nowYear, nowMonth)} • Live`,
      month: monthLabel(nowYear, nowMonth),
      auto: monthLiveScore,
      autoScore: monthLiveScore,
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
    weeklyKpiAnalytics,
    weeklyStats,
    monthlyStats,
    completedTasks: {
      thisWeek: completedTasksThisWeek,
      thisMonth: completedTasksThisMonth,
      all: allCompletedTasks,
    },
  });
}
