// KPI and Task-Level Performance Points Calculation Engine
// Provides objective scoring and analytics for both individual tasks and KPI buckets.

export type TaskSize = "XS" | "S" | "M" | "L" | "XL" | string | null;

// Multipliers for task size / effort relative to nominal Medium task
export const SIZE_EFFORT_MULTIPLIERS: Record<string, number> = {
  xs: 0.5,
  s: 0.75,
  m: 1.0,
  l: 1.5,
  xl: 2.0,
};

export function getSizeMultiplier(sizeLabel: TaskSize, estimatedMins?: number | null): number {
  if (estimatedMins && estimatedMins > 0) {
    // 60 mins = 1.0 multiplier, clamped between 0.3 and 3.0
    return Math.max(0.3, Math.min(3.0, Math.round((estimatedMins / 60) * 10) / 10));
  }
  if (!sizeLabel) return 1.0;
  const key = String(sizeLabel).toLowerCase();
  return SIZE_EFFORT_MULTIPLIERS[key] ?? 1.0;
}

export type TaskForPoints = {
  id: string;
  title?: string;
  status: string;
  sizeLabel?: string | null;
  estimatedMins?: number | null;
  kpiTemplateId?: string | null;
  urgent?: boolean;
  important?: boolean;
  carryCount?: number;
  reworkCount?: number;
  createdAt?: Date | string | null;
  completedAt?: Date | string | null;
  dueAt?: Date | string | null;
  checklistTotal?: number;
  checklistDone?: number;
};

export type IndividualTaskPointsResult = {
  kpiName: string;
  weightage: number;
  maxPoints: number;
  earnedPoints: number;
  completionRate: number; // 0..1
  timelinessRate: number; // 0..1
  qualityRate: number; // 0..1
  isOnTime: boolean | null;
  statusLabel: string;
  breakdown: {
    baseAllocation: number;
    completionPoints: number;
    timelinessAdjustment: number;
    reworkPenalty: number;
    carryPenalty: number;
    checklistAdjustment: number;
  };
};

function toDate(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (val.toDate) return val.toDate();
  const parsed = new Date(val);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Calculates the KPI points for an individual task.
 * @param task The task data.
 * @param kpiWeightage The weightage (points out of 100) of the parent KPI template.
 * @param totalBucketEffort The sum of size multipliers for all tasks in this KPI bucket (optional, defaults to 5.0 nominal).
 * @param kpiName The name of the KPI bucket.
 */
export function calculateIndividualTaskPoints(
  task: TaskForPoints,
  kpiWeightage: number = 20,
  totalBucketEffort: number = 5.0,
  kpiName: string = "KPI Bucket"
): IndividualTaskPointsResult {
  const sizeMult = getSizeMultiplier(task.sizeLabel, task.estimatedMins);
  
  // Safe base allocation proportional to effort share
  const effortShare = totalBucketEffort > 0 ? sizeMult / totalBucketEffort : 0.2;
  // Maximum potential points this task can yield (capped sensibly)
  const maxPoints = Math.round(Math.min(kpiWeightage, kpiWeightage * effortShare * 1.5) * 10) / 10 || 1.0;

  // 1. Completion Factor (60% weight of task points)
  let completionFactor = 0;
  const isClosed = task.status === "CLOSED";
  if (isClosed) {
    completionFactor = 1.0;
  } else if (task.status === "PENDING_REVIEW") {
    completionFactor = 0.8;
  } else if (task.status === "IN_PROGRESS" || task.status === "ACCEPTED") {
    completionFactor = 0.4;
  } else if (task.status === "ON_HOLD") {
    completionFactor = 0.2;
  } else {
    completionFactor = 0;
  }

  // 2. Timeliness & Deadline Adherence
  let timelinessRate = 1.0;
  let isOnTime: boolean | null = null;
  const due = toDate(task.dueAt);
  const completed = toDate(task.completedAt);
  const now = new Date();

  if (due) {
    const compareTime = completed ? completed.getTime() : now.getTime();
    if (compareTime <= due.getTime()) {
      isOnTime = true;
      timelinessRate = 1.0;
    } else {
      isOnTime = false;
      const hoursLate = (compareTime - due.getTime()) / (1000 * 60 * 60);
      const daysLate = Math.ceil(hoursLate / 24);
      // Deduct 10% per day late, max 40% deduction
      timelinessRate = Math.max(0.6, 1.0 - daysLate * 0.1);
    }
  }

  // Carry count penalty (each carry forward indicates missed daily commitment)
  const carryCount = task.carryCount || 0;
  const carryPenaltyRate = Math.min(0.3, carryCount * 0.08);

  // 3. Quality & Rework (15% weight)
  const reworkCount = task.reworkCount || 0;
  const isReopened = task.status === "REOPENED";
  let qualityRate = 1.0;
  if (isReopened) {
    qualityRate = 0.3;
  } else if (reworkCount > 0) {
    qualityRate = Math.max(0.4, 1.0 - reworkCount * 0.25);
  }

  // 4. Checklist completion bonus/penalty
  let checklistFactor = 1.0;
  if (task.checklistTotal && task.checklistTotal > 0) {
    const done = task.checklistDone ?? 0;
    checklistFactor = done / task.checklistTotal;
  }

  // Composite Points Calculation
  // Base point components
  const baseCompPoints = maxPoints * 0.60 * completionFactor * checklistFactor;
  const baseTimePoints = maxPoints * 0.25 * timelinessRate * (1 - carryPenaltyRate);
  const baseQualPoints = maxPoints * 0.15 * qualityRate;

  let earnedPoints = 0;
  if (isClosed) {
    earnedPoints = baseCompPoints + baseTimePoints + baseQualPoints;
  } else {
    // In-progress tasks show current accrued progress points
    earnedPoints = (baseCompPoints + baseTimePoints + baseQualPoints) * completionFactor;
  }

  earnedPoints = Math.max(0, Math.min(maxPoints, Math.round(earnedPoints * 10) / 10));

  return {
    kpiName,
    weightage: kpiWeightage,
    maxPoints,
    earnedPoints,
    completionRate: completionFactor,
    timelinessRate,
    qualityRate,
    isOnTime,
    statusLabel: task.status,
    breakdown: {
      baseAllocation: maxPoints,
      completionPoints: Math.round(baseCompPoints * 10) / 10,
      timelinessAdjustment: Math.round((baseTimePoints - maxPoints * 0.25) * 10) / 10,
      reworkPenalty: reworkCount > 0 ? Math.round(maxPoints * 0.15 * (1 - qualityRate) * 10) / 10 : 0,
      carryPenalty: carryCount > 0 ? Math.round(maxPoints * 0.25 * carryPenaltyRate * 10) / 10 : 0,
      checklistAdjustment: Math.round(checklistFactor * 100),
    },
  };
}

export type KpiBucketAnalytics = {
  kpiId: string;
  kpiName: string;
  kraName: string;
  weightage: number;
  pointsEarned: number; // 0..weightage
  efficiencyPct: number; // (pointsEarned / weightage) * 100
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  reworkCount: number;
  activeDays: number;
  consistencyScore: number;
  tasks: Array<TaskForPoints & {
    pointsResult: IndividualTaskPointsResult;
  }>;
};

export type KpiPerformanceAnalyticsSummary = {
  totalPointsEarned: number; // 0..100
  totalPointsMax: number; // 100
  overallEfficiencyPct: number;
  totalTasks: number;
  completedTasks: number;
  activeDaysTotal: number;
  topPerformingKpi: { name: string; points: number; weightage: number } | null;
  underperformingKpi: { name: string; points: number; weightage: number } | null;
  buckets: KpiBucketAnalytics[];
};

/**
 * Calculates complete KPI-level & task-level Performance Analytics for an employee.
 */
export function calculateKpiPerformanceAnalytics(
  kpiTemplates: Array<{ id: string; kpiName: string; kraName: string; weightage: number }>,
  tasks: TaskForPoints[]
): KpiPerformanceAnalyticsSummary {
  const tasksByKpi = new Map<string, TaskForPoints[]>();
  for (const k of kpiTemplates) {
    tasksByKpi.set(k.id, []);
  }

  for (const t of tasks) {
    if (t.kpiTemplateId && tasksByKpi.has(t.kpiTemplateId)) {
      tasksByKpi.get(t.kpiTemplateId)!.push(t);
    }
  }

  const buckets: KpiBucketAnalytics[] = [];
  let sumEarned = 0;
  let sumMax = 0;
  let totalTasksCount = 0;
  let totalCompletedCount = 0;
  const allActiveDates = new Set<string>();

  for (const kpi of kpiTemplates) {
    const kpiTasks = tasksByKpi.get(kpi.id) ?? [];
    const weightage = kpi.weightage ?? 0;
    sumMax += weightage;
    totalTasksCount += kpiTasks.length;

    // Total size effort in this bucket
    const totalBucketEffort = kpiTasks.reduce((acc, t) => acc + getSizeMultiplier(t.sizeLabel, t.estimatedMins), 0) || 5.0;

    const completed = kpiTasks.filter((t) => t.status === "CLOSED").length;
    const inProgress = kpiTasks.filter((t) => ["IN_PROGRESS", "ACCEPTED", "PENDING_REVIEW"].includes(t.status)).length;
    const rework = kpiTasks.filter((t) => t.status === "REOPENED" || (t.reworkCount ?? 0) > 0 || (t.carryCount ?? 0) > 0).length;
    totalCompletedCount += completed;

    // Active days for consistency
    const days = new Set<string>();
    for (const t of kpiTasks) {
      const cDate = toDate(t.createdAt);
      const compDate = toDate(t.completedAt);
      if (cDate) {
        const key = cDate.toISOString().slice(0, 10);
        days.add(key);
        allActiveDates.add(key);
      }
      if (compDate) {
        const key = compDate.toISOString().slice(0, 10);
        days.add(key);
        allActiveDates.add(key);
      }
    }
    const activeDays = days.size;

    // Standard auto score calculation for bucket
    let pointsEarned = 0;
    if (kpiTasks.length > 0) {
      const completionRate = completed / kpiTasks.length;
      const consistency = Math.min(1, activeDays / 6); // 6 active days = 100%
      const noRework = Math.max(0, 1 - rework / kpiTasks.length);
      const factor = 0.60 * completionRate + 0.25 * consistency + 0.15 * noRework;
      pointsEarned = Math.round(weightage * factor * 10) / 10;
    }

    sumEarned += pointsEarned;

    // Calculate individual task points for each task in bucket
    const enrichedTasks = kpiTasks.map((t) => {
      const pointsResult = calculateIndividualTaskPoints(t, weightage, totalBucketEffort, kpi.kpiName);
      return {
        ...t,
        pointsResult,
      };
    });

    const efficiencyPct = weightage > 0 ? Math.round((pointsEarned / weightage) * 100) : 0;

    buckets.push({
      kpiId: kpi.id,
      kpiName: kpi.kpiName,
      kraName: kpi.kraName,
      weightage,
      pointsEarned,
      efficiencyPct,
      totalTasks: kpiTasks.length,
      completedTasks: completed,
      inProgressTasks: inProgress,
      reworkCount: rework,
      activeDays,
      consistencyScore: Math.round(Math.min(1, activeDays / 6) * 100),
      tasks: enrichedTasks,
    });
  }

  const totalPointsEarned = Math.round(sumEarned * 10) / 10;
  const totalPointsMax = sumMax || 100;
  const overallEfficiencyPct = totalPointsMax > 0 ? Math.round((totalPointsEarned / totalPointsMax) * 100) : 0;

  // Find top and underperforming buckets
  const sortedBuckets = [...buckets].sort((a, b) => b.efficiencyPct - a.efficiencyPct);
  const topPerformingKpi = sortedBuckets.length > 0 && sortedBuckets[0].totalTasks > 0
    ? { name: sortedBuckets[0].kpiName, points: sortedBuckets[0].pointsEarned, weightage: sortedBuckets[0].weightage }
    : null;
  const lowest = sortedBuckets[sortedBuckets.length - 1];
  const underperformingKpi = lowest
    ? { name: lowest.kpiName, points: lowest.pointsEarned, weightage: lowest.weightage }
    : null;

  return {
    totalPointsEarned,
    totalPointsMax,
    overallEfficiencyPct,
    totalTasks: totalTasksCount,
    completedTasks: totalCompletedCount,
    activeDaysTotal: allActiveDates.size,
    topPerformingKpi,
    underperformingKpi,
    buckets,
  };
}
