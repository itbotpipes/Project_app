import "server-only";
import { prisma } from "@/lib/db";
import { computeAutoScores } from "@/lib/autoscore";
import { previousMonthStart } from "@/lib/date";

/**
 * "Tasks which are not ticked off will be carried over to the next day —
 * automatic next day planning." (from the original spec)
 *
 * Any task that isn't CLOSED and whose due date has slipped into the past
 * gets its due date pushed to the end of today, its carry count bumped, and
 * an audit trail kept — so nothing silently falls off the board.
 */
export async function carryForwardOpenTasks(): Promise<number> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 0, 0);

  const stale = await prisma.task.findMany({
    where: {
      status: { notIn: ["CLOSED"] },
      dueAt: { lt: startOfToday },
    },
    select: { id: true },
  });

  for (const t of stale) {
    await prisma.task.update({
      where: { id: t.id },
      data: {
        dueAt: endOfToday,
        carryCount: { increment: 1 },
        carryForwardDate: new Date(),
      },
    });
  }

  if (stale.length) {
    await prisma.auditLog.create({
      data: {
        action: "task.autoCarryForward",
        entity: "Task",
        detail: `${stale.length} task(s) carried forward to today`,
      },
    });
  }
  return stale.length;
}

/**
 * Materialise the PREVIOUS month's auto scorecards for every active employee so
 * that, on the 1st, everyone can already see their "auto" chart for the month
 * just gone — before the manager finalises by the 5th.
 *
 * Never clobbers a manager's finalised numbers: a scorecard the manager has
 * already saved (source !== "auto") only has its autoTotal refreshed.
 */
export async function ensureMonthlyAutoScorecards(): Promise<number> {
  const prev = previousMonthStart();
  const year = prev.getFullYear();
  const month = prev.getMonth() + 1;
  const monthEnd = new Date(year, month, 1);

  const employees = await prisma.employee.findMany({
    where: { active: true },
    select: { id: true, roleId: true },
  });
  if (!employees.length) return 0;

  const roleIds = [...new Set(employees.map((e) => e.roleId))];
  const kpis = await prisma.kpiTemplate.findMany({ where: { roleId: { in: roleIds } } });
  const kpisByRole = new Map<string, typeof kpis>();
  for (const k of kpis) {
    const a = kpisByRole.get(k.roleId) ?? [];
    a.push(k);
    kpisByRole.set(k.roleId, a);
  }

  const empIds = employees.map((e) => e.id);
  const tasks = await prisma.task.findMany({
    where: { assigneeId: { in: empIds }, createdAt: { gte: prev, lt: monthEnd } },
    select: { assigneeId: true, kpiTemplateId: true, status: true, createdAt: true, completedAt: true, carryCount: true },
  });
  const tasksByEmp = new Map<string, typeof tasks>();
  for (const t of tasks) {
    const a = tasksByEmp.get(t.assigneeId) ?? [];
    a.push(t);
    tasksByEmp.set(t.assigneeId, a);
  }

  let created = 0;
  for (const e of employees) {
    const roleKpis = kpisByRole.get(e.roleId) ?? [];
    if (!roleKpis.length) continue;
    const auto = computeAutoScores(
      roleKpis.map((k) => ({ id: k.id, weightage: k.weightage })),
      tasksByEmp.get(e.id) ?? [],
    );
    let autoTotal = 0;
    for (const k of roleKpis) {
      const a = auto.get(k.id)?.auto ?? 0;
      autoTotal += a;
      const existing = await prisma.monthlyScore.findUnique({
        where: { employeeId_kpiTemplateId_year_month: { employeeId: e.id, kpiTemplateId: k.id, year, month } },
      });
      if (!existing) {
        await prisma.monthlyScore.create({
          data: { employeeId: e.id, kpiTemplateId: k.id, year, month, autoScore: a, score: a },
        });
      } else {
        await prisma.monthlyScore.update({ where: { id: existing.id }, data: { autoScore: a } });
      }
    }
    const card = await prisma.monthlyScorecard.findUnique({
      where: { employeeId_year_month: { employeeId: e.id, year, month } },
    });
    if (!card) {
      await prisma.monthlyScorecard.create({
        data: { employeeId: e.id, year, month, total: autoTotal, autoTotal, source: "auto" },
      });
      created++;
    } else if (card.source === "auto") {
      await prisma.monthlyScorecard.update({ where: { id: card.id }, data: { total: autoTotal, autoTotal } });
    } else {
      await prisma.monthlyScorecard.update({ where: { id: card.id }, data: { autoTotal } });
    }
  }
  return created;
}

/** Runs everything that needs to happen once a day. Idempotent-ish: safe to call multiple times. */
export async function runDailyJobs(): Promise<{ carried: number; scorecards: number; ranAt: string }> {
  const carried = await carryForwardOpenTasks();
  // Only bother materialising last month's auto scorecards in the first week.
  const scorecards = new Date().getDate() <= 7 ? await ensureMonthlyAutoScorecards() : 0;
  return { carried, scorecards, ranAt: new Date().toISOString() };
}
