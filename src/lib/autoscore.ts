// Per-KPI automatic scoring from task activity.
//
// For each KPI bucket, the system looks at the tasks the employee logged into
// that bucket during the month and rewards:
//   • completion   — did they actually finish what they started (60%)
//   • consistency  — did they work it across many days, not all at once (25%)
//   • no-rework    — tasks not reopened / not repeatedly carried forward (15%)
// The score is capped at that KPI's weightage. A bucket with no tasks scores 0.

export type ScoreableTask = {
  kpiTemplateId: string | null;
  status: string;
  createdAt: Date;
  completedAt: Date | null;
  carryCount: number;
};

export type KpiForScore = { id: string; weightage: number };

export type KpiAuto = {
  auto: number; // 0..weightage
  total: number; // # tasks in the bucket
  completed: number;
  activeDays: number;
  rework: number; // # tasks reopened or carried
};

const CONSISTENCY_TARGET_DAYS = 6; // working this bucket ~6 days in a month = full consistency

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function computeAutoScores(
  kpis: KpiForScore[],
  tasks: ScoreableTask[],
): Map<string, KpiAuto> {
  const byKpi = new Map<string, ScoreableTask[]>();
  for (const k of kpis) byKpi.set(k.id, []);
  for (const t of tasks) {
    if (t.kpiTemplateId && byKpi.has(t.kpiTemplateId)) byKpi.get(t.kpiTemplateId)!.push(t);
  }

  const out = new Map<string, KpiAuto>();
  for (const k of kpis) {
    const list = byKpi.get(k.id) ?? [];
    const total = list.length;
    if (total === 0) {
      out.set(k.id, { auto: 0, total: 0, completed: 0, activeDays: 0, rework: 0 });
      continue;
    }
    const completed = list.filter((t) => t.status === "CLOSED").length;
    const rework = list.filter((t) => t.status === "REOPENED" || t.carryCount > 0).length;

    const days = new Set<string>();
    for (const t of list) {
      days.add(dayKey(t.createdAt));
      if (t.completedAt) days.add(dayKey(t.completedAt));
    }
    const activeDays = days.size;

    const completionRate = completed / total;
    const consistency = Math.min(1, activeDays / CONSISTENCY_TARGET_DAYS);
    const noRework = Math.max(0, 1 - rework / total);

    const factor = 0.6 * completionRate + 0.25 * consistency + 0.15 * noRework;
    const auto = Math.round(k.weightage * factor * 10) / 10; // 1 decimal

    out.set(k.id, { auto, total, completed, activeDays, rework });
  }
  return out;
}
