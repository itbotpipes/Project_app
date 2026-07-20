// Rule-based weekly insights derived from an employee's task activity.
// Works with zero external dependencies; when an ANTHROPIC_API_KEY is present
// the coach chat (actions/coach.ts) layers a real LLM on top of these facts.

export type InsightTask = {
  status: string;
  createdAt: Date;
  completedAt: Date | null;
  carryCount: number;
  kpiName: string | null;
};

export type WeeklyInsights = {
  stats: {
    created: number;
    completed: number;
    carried: number;
    rework: number;
    bucketsWorked: number;
    activeDays: number;
    topBucket: string | null;
  };
  wentWell: string[];
  needsAttention: string[];
};

export function computeWeeklyInsights(
  tasks: InsightTask[],
  totalRoleBuckets: number,
): WeeklyInsights {
  const created = tasks.length;
  const completed = tasks.filter((t) => t.status === "CLOSED").length;
  const carried = tasks.filter((t) => t.carryCount > 0).length;
  const rework = tasks.filter((t) => t.status === "REOPENED").length;

  const bucketCounts = new Map<string, number>();
  const days = new Set<string>();
  for (const t of tasks) {
    if (t.kpiName) bucketCounts.set(t.kpiName, (bucketCounts.get(t.kpiName) ?? 0) + 1);
    days.add(t.createdAt.toISOString().slice(0, 10));
    if (t.completedAt) days.add(t.completedAt.toISOString().slice(0, 10));
  }
  const bucketsWorked = bucketCounts.size;
  const topBucket =
    [...bucketCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const completionRate = created ? completed / created : 0;

  const wentWell: string[] = [];
  const needsAttention: string[] = [];

  if (completed > 0) wentWell.push(`You completed ${completed} task${completed === 1 ? "" : "s"} this week.`);
  if (completionRate >= 0.7 && created >= 3)
    wentWell.push(`Strong finish rate — ${Math.round(completionRate * 100)}% of what you started got done.`);
  if (topBucket) wentWell.push(`Your biggest focus was “${topBucket}”.`);
  if (rework === 0 && completed > 0) wentWell.push(`Clean work — nothing had to be reopened.`);
  if (days.size >= 4) wentWell.push(`Consistent — you logged work on ${days.size} different days.`);
  if (wentWell.length === 0) wentWell.push(`A fresh week — add and complete a few tasks to build momentum.`);

  if (carried > 0)
    needsAttention.push(`${carried} task${carried === 1 ? "" : "s"} slipped and got carried forward — try smaller, time-boxed tasks.`);
  if (rework > 0)
    needsAttention.push(`${rework} task${rework === 1 ? "" : "s"} was reopened — a quick quality check before closing helps.`);
  if (created > 0 && completionRate < 0.5)
    needsAttention.push(`Less than half of your tasks closed — plan fewer, finish more.`);
  if (totalRoleBuckets >= 4 && bucketsWorked <= 2 && created >= 3)
    needsAttention.push(`You worked only ${bucketsWorked} of your ${totalRoleBuckets} KPI areas — spread effort wider for balanced growth.`);
  if (created === 0)
    needsAttention.push(`No tasks logged this week — start each morning by listing your day's tasks.`);

  return {
    stats: { created, completed, carried, rework, bucketsWorked, activeDays: days.size, topBucket },
    wentWell,
    needsAttention,
  };
}
