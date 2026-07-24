import "server-only";
import { adminDb } from "./firebase/admin";
import { isManagerLike } from "./auth";

export type Alert = { id: string; text: string; href: string; tone: "red" | "amber" | "blue" };

type UserLike = {
  id: string;
  roleId: string;
  systemRole: string;
};

function toDate(val: any): Date {
  if (!val) return new Date(0);
  if (val.toDate) return val.toDate();
  return new Date(val);
}

export async function getAlerts(user: UserLike): Promise<Alert[]> {
  const alerts: Alert[] = [];
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const HOUR = 60 * 60 * 1000;

  const [allTasksSnap1, allTasksSnap2, remindersSnapAll, allTasksSnap4, kpiCountSnap] = await Promise.all([
    adminDb.collection("Task").where("assigneeId", "==", user.id).get(),
    adminDb.collection("Task").where("reviewerId", "==", user.id).get(),
    adminDb.collection("Reminder").where("sent", "==", false).get(),
    adminDb.collection("Task").where("assigneeId", "==", user.id).get(),
    adminDb.collection("KpiTemplate").where("roleId", "==", user.roleId).get(),
  ]);

  const overdueTasks = allTasksSnap1.docs.filter(d => {
    const data = d.data();
    return data.status !== "CLOSED" && data.dueAt && data.dueAt.toDate() < now;
  });

  const pendingReview = allTasksSnap2.docs.filter(d => d.data().status === "PENDING_REVIEW");

  let dueReminders = remindersSnapAll.docs.filter(d => d.data().remindAt && d.data().remindAt.toDate() <= now);
  dueReminders = dueReminders.sort((a,b) => a.data().remindAt.toMillis() - b.data().remindAt.toMillis()).slice(0, 5);

  const staleOnHold = allTasksSnap4.docs.filter(d => {
    const data = d.data();
    return data.status === "ON_HOLD" && data.updatedAt && data.updatedAt.toDate() < new Date(now.getTime() - 48 * HOUR);
  });

  if (overdueTasks.length > 0)
    alerts.push({ id: "overdue", tone: "red", href: "/board", text: `${overdueTasks.length} of your tasks are overdue` });

  if (pendingReview.length > 0)
    alerts.push({ id: "review", tone: "amber", href: "/board", text: `${pendingReview.length} task(s) awaiting your review` });

  for (const r of dueReminders) {
    const rd = r.data();
    const taskDoc = await adminDb.collection("Task").doc(rd.taskId).get();
    if (taskDoc.exists && taskDoc.data()!.assigneeId === user.id) {
      alerts.push({
        id: `reminder-${r.id}`,
        tone: "blue",
        href: `/task/${rd.taskId}`,
        text: `⏰ Reminder: ${taskDoc.data()!.title}`,
      });
    }
  }

  if (staleOnHold.length > 0)
    alerts.push({ id: "stale-hold", tone: "red", href: "/board", text: `${staleOnHold.length} task(s) on hold for 48h+ — update the status` });

  const roleBuckets = kpiCountSnap.size;
  if (roleBuckets >= 4) {
    const allMonthTasksSnap = await adminDb.collection("Task").where("assigneeId", "==", user.id).get();
    const workedKpis = new Set(
      allMonthTasksSnap.docs
        .filter((d) => {
          const createdAt = d.data().createdAt?.toDate ? d.data().createdAt.toDate() : new Date(d.data().createdAt ?? 0);
          return createdAt >= startOfMonth;
        })
        .map((d) => d.data().kpiTemplateId)
        .filter(Boolean)
    );
    const total = allMonthTasksSnap.docs.filter((d) => {
      const createdAt = d.data().createdAt?.toDate ? d.data().createdAt.toDate() : new Date(d.data().createdAt ?? 0);
      return createdAt >= startOfMonth;
    }).length;
    if (total >= 3 && workedKpis.size <= 2) {
      alerts.push({ id: "kpi-balance", tone: "amber", href: "/performance", text: `KPI balance is off — only ${workedKpis.size} of ${roleBuckets} buckets worked this month` });
    }
  }

  if (isManagerLike(user.systemRole)) {
    const reportSnap = await adminDb.collection("Employee").where("reportsToId", "==", user.id).where("active", "==", true).get();
    const reportIds = reportSnap.docs.map((d) => d.id);

    if (reportIds.length) {
      const teamOverdueIds = new Set<string>();
      for (const id of reportIds) {
        const tSnap = await adminDb.collection("Task")
          .where("assigneeId", "==", id)
          .where("status", "!=", "CLOSED")
          .limit(10)
          .get();
        if (tSnap.docs.some(d => d.data().dueAt && d.data().dueAt.toDate() < now)) teamOverdueIds.add(id);
      }
      if (teamOverdueIds.size > 0)
        alerts.push({ id: "team-overdue", tone: "amber", href: "/team", text: `${teamOverdueIds.size} of your team have overdue tasks` });

      const teamStaleIds = new Set<string>();
      for (const id of reportIds) {
        const tSnap = await adminDb.collection("Task")
          .where("assigneeId", "==", id)
          .where("status", "==", "ON_HOLD")
          .limit(10)
          .get();
        if (tSnap.docs.some(d => d.data().updatedAt && d.data().updatedAt.toDate() < new Date(now.getTime() - 96 * HOUR))) teamStaleIds.add(id);
      }
      if (teamStaleIds.size > 0)
        alerts.push({ id: "team-stale-hold", tone: "red", href: "/team", text: `⚠ ${teamStaleIds.size} team member(s) have tasks on hold 96h+ — escalated to you` });

      const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const py = prevStart.getFullYear();
      const pm = prevStart.getMonth() + 1;
      const prevCards = await Promise.all(
        reportIds.map((id) =>
          adminDb.collection("MonthlyScorecard").where("employeeId", "==", id).where("year", "==", py).where("month", "==", pm).limit(1).get()
        )
      );
      const finalized = new Set(
        prevCards.flatMap((snap) => snap.docs.filter((d) => d.data().source !== "auto").map((d) => d.data().employeeId))
      );
      const pending = reportIds.filter((id) => !finalized.has(id)).length;
      const monthName = prevStart.toLocaleDateString("en-IN", { month: "long" });
      if (pending > 0) {
        if (now.getDate() <= 5) {
          alerts.push({ id: "score-due", tone: "amber", href: "/scores", text: `Finalise ${pending} ${monthName} scorecard(s) before the 5th` });
        } else {
          alerts.push({ id: "score-overdue", tone: "red", href: "/scores", text: `⚠ ${pending} ${monthName} scorecard(s) not finalised — overdue (was due the 5th)` });
        }
      }
    }
  }

  if ((user.systemRole === "ADMIN" || user.systemRole === "CEO") && now.getDate() > 5) {
    const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const py = prevStart.getFullYear();
    const pm = prevStart.getMonth() + 1;
    const monthName = prevStart.toLocaleDateString("en-IN", { month: "long" });
    const activeSnap = await adminDb.collection("Employee").where("active", "==", true).get();
    const activeIds = activeSnap.docs.map((d) => d.id);
    const cards = await Promise.all(
      activeIds.map((id) =>
        adminDb.collection("MonthlyScorecard").where("employeeId", "==", id).where("year", "==", py).where("month", "==", pm).limit(1).get()
      )
    );
    const finalized = new Set(
      cards.flatMap((snap) => snap.docs.filter((d) => d.data().source !== "auto").map((d) => d.data().employeeId))
    );
    const pending = activeIds.filter((id) => !finalized.has(id)).length;
    if (pending > 0)
      alerts.push({ id: "score-escalation", tone: "red", href: "/scores", text: `⚠ ${pending} employee scorecard(s) for ${monthName} still not finalised across the company` });
  }

  return alerts;
}
