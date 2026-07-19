import "server-only";
import { prisma } from "@/lib/db";

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

/** Runs everything that needs to happen once a day. Idempotent-ish: safe to call multiple times. */
export async function runDailyJobs(): Promise<{ carried: number; ranAt: string }> {
  const carried = await carryForwardOpenTasks();
  return { carried, ranAt: new Date().toISOString() };
}
