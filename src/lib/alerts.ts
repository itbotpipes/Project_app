import "server-only";
import { prisma } from "./db";
import { isManagerLike } from "./auth";

export type Alert = { id: string; text: string; href: string; tone: "red" | "amber" | "blue" };

type UserLike = {
  id: string;
  roleId: string;
  systemRole: string;
};

export async function getAlerts(user: UserLike): Promise<Alert[]> {
  const alerts: Alert[] = [];
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Overdue tasks assigned to me
  const overdue = await prisma.task.count({
    where: { assigneeId: user.id, status: { notIn: ["CLOSED"] }, dueAt: { lt: now } },
  });
  if (overdue > 0)
    alerts.push({ id: "overdue", tone: "red", href: "/board", text: `${overdue} of your tasks are overdue` });

  // Tasks awaiting my review
  const toReview = await prisma.task.count({
    where: { reviewerId: user.id, status: "PENDING_REVIEW" },
  });
  if (toReview > 0)
    alerts.push({ id: "review", tone: "amber", href: "/board", text: `${toReview} task(s) awaiting your review` });

  // Reminders due now
  const dueReminders = await prisma.reminder.findMany({
    where: { sent: false, remindAt: { lte: now }, task: { assigneeId: user.id } },
    include: { task: { select: { id: true, title: true } } },
    orderBy: { remindAt: "asc" },
    take: 5,
  });
  for (const r of dueReminders) {
    alerts.push({
      id: `reminder-${r.id}`,
      tone: "blue",
      href: `/task/${r.task.id}`,
      text: `⏰ Reminder: ${r.task.title}`,
    });
  }

  // Silent escalation: task on-hold too long.
  // First alert -> the employee themselves (48h). Second -> their manager (96h).
  const HOUR = 60 * 60 * 1000;
  const staleOnHold = await prisma.task.findMany({
    where: { assigneeId: user.id, status: "ON_HOLD", updatedAt: { lt: new Date(now.getTime() - 48 * HOUR) } },
    select: { id: true, title: true },
  });
  if (staleOnHold.length)
    alerts.push({
      id: "stale-hold",
      tone: "red",
      href: "/board",
      text: `${staleOnHold.length} task(s) on hold for 48h+ — update the status`,
    });

  // KPI bucket-balance alarm
  const roleBuckets = await prisma.kpiTemplate.count({ where: { roleId: user.roleId } });
  if (roleBuckets >= 4) {
    const worked = await prisma.task.findMany({
      where: { assigneeId: user.id, createdAt: { gte: startOfMonth }, kpiTemplateId: { not: null } },
      select: { kpiTemplateId: true },
      distinct: ["kpiTemplateId"],
    });
    const total = await prisma.task.count({
      where: { assigneeId: user.id, createdAt: { gte: startOfMonth } },
    });
    if (total >= 3 && worked.length <= 2) {
      alerts.push({
        id: "kpi-balance",
        tone: "amber",
        href: "/performance",
        text: `KPI balance is off — only ${worked.length} of ${roleBuckets} buckets worked this month`,
      });
    }
  }

  // Manager: team members with overdue tasks
  if (isManagerLike(user.systemRole)) {
    const reportIds = (
      await prisma.employee.findMany({ where: { reportsToId: user.id, active: true }, select: { id: true } })
    ).map((e) => e.id);
    if (reportIds.length) {
      const teamOverdue = await prisma.task.findMany({
        where: { assigneeId: { in: reportIds }, status: { notIn: ["CLOSED"] }, dueAt: { lt: now } },
        select: { assigneeId: true },
        distinct: ["assigneeId"],
      });
      if (teamOverdue.length)
        alerts.push({
          id: "team-overdue",
          tone: "amber",
          href: "/team",
          text: `${teamOverdue.length} of your team have overdue tasks`,
        });

      // Escalation tier 2: a report's task has been on-hold for 96h+
      const teamStale = await prisma.task.findMany({
        where: {
          assigneeId: { in: reportIds },
          status: "ON_HOLD",
          updatedAt: { lt: new Date(now.getTime() - 96 * HOUR) },
        },
        select: { assigneeId: true },
        distinct: ["assigneeId"],
      });
      if (teamStale.length)
        alerts.push({
          id: "team-stale-hold",
          tone: "red",
          href: "/team",
          text: `⚠ ${teamStale.length} team member(s) have tasks on hold 96h+ — escalated to you`,
        });

      // Monthly scoring cadence: finalise LAST month's scores by the 5th.
      const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const py = prevStart.getFullYear();
      const pm = prevStart.getMonth() + 1;
      const prevCards = await prisma.monthlyScorecard.findMany({
        where: { employeeId: { in: reportIds }, year: py, month: pm },
        select: { employeeId: true, source: true },
      });
      const finalized = new Set(prevCards.filter((c) => c.source !== "auto").map((c) => c.employeeId));
      const pending = reportIds.filter((id) => !finalized.has(id)).length;
      const monthName = prevStart.toLocaleDateString("en-IN", { month: "long" });
      if (pending > 0) {
        if (now.getDate() <= 5) {
          alerts.push({
            id: "score-due",
            tone: "amber",
            href: "/scores",
            text: `Finalise ${pending} ${monthName} scorecard(s) before the 5th`,
          });
        } else {
          alerts.push({
            id: "score-overdue",
            tone: "red",
            href: "/scores",
            text: `⚠ ${pending} ${monthName} scorecard(s) not finalised — overdue (was due the 5th)`,
          });
        }
      }
    }
  }

  // Company-wide escalation (Admin / CEO): after the 5th, flag anyone still not finalised.
  if ((user.systemRole === "ADMIN" || user.systemRole === "CEO") && now.getDate() > 5) {
    const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const py = prevStart.getFullYear();
    const pm = prevStart.getMonth() + 1;
    const monthName = prevStart.toLocaleDateString("en-IN", { month: "long" });
    const activeIds = (await prisma.employee.findMany({ where: { active: true }, select: { id: true } })).map((e) => e.id);
    const cards = await prisma.monthlyScorecard.findMany({
      where: { employeeId: { in: activeIds }, year: py, month: pm },
      select: { employeeId: true, source: true },
    });
    const finalized = new Set(cards.filter((c) => c.source !== "auto").map((c) => c.employeeId));
    const pending = activeIds.filter((id) => !finalized.has(id)).length;
    if (pending > 0)
      alerts.push({
        id: "score-escalation",
        tone: "red",
        href: "/scores",
        text: `⚠ ${pending} employee scorecard(s) for ${monthName} still not finalised across the company`,
      });
  }

  return alerts;
}
