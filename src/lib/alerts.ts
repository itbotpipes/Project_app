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

  // ── Single Task fetch replaces the 3 duplicate reads that were here ──────
  // Previously: allTasksSnap1, allTasksSnap2, allTasksSnap4, allMonthTasksSnap
  // were all separate queries returning overlapping data. Now we fetch once and
  // derive all needed subsets in JS (acceptable — this is the user's own tasks).
  // Two targeted queries replace the single all-history Task fetch:
  //  1. Active tasks (excluding CLOSED) — covers overdue, on-hold, open count. No history needed.
  //  2. Month-bounded tasks — for KPI balance checking.
  const [activeTasksSnap, monthTasksSnap, reviewTasksSnap, remindersSnap, kpiCountSnap] = await Promise.all([
    adminDb.collection("Task")
      .where("assigneeId", "==", user.id)
      .where("status", "!=", "CLOSED")
      .where("deletedAt", "==", null)
      .get(),
    adminDb.collection("Task")
      .where("assigneeId", "==", user.id)
      .where("createdAt", ">=", startOfMonth)
      .get(),
    // Tasks where the user is the reviewer and they're pending review
    adminDb.collection("Task")
      .where("reviewerId", "==", user.id)
      .where("status", "==", "PENDING_REVIEW")
      .get(),
    // User-scoped reminders that are due — requires employeeId on Reminder doc.
    // Wrap in try-catch to prevent layout crash if index is building or query fails.
    adminDb.collection("Reminder")
      .where("employeeId", "==", user.id)
      .where("sent", "==", false)
      .where("remindAt", "<=", now)
      .orderBy("remindAt", "asc")
      .limit(5)
      .get()
      .catch(err => {
        console.error("[getAlerts] Failed to fetch reminders:", err);
        return { empty: true, docs: [] } as any;
      }),
    adminDb.collection("KpiTemplate").where("roleId", "==", user.roleId).get(),
  ]);

  // ── Overdue tasks ─────────────────────────────────────────────────────────
  const overdueTasks = activeTasksSnap.docs.filter(d => {
    const data = d.data();
    return data.dueAt && toDate(data.dueAt) < now;
  });
  if (overdueTasks.length > 0)
    alerts.push({ id: "overdue", tone: "red", href: "/board", text: `${overdueTasks.length} of your tasks are overdue` });

  // ── Pending review ────────────────────────────────────────────────────────
  const pendingReviewCount = reviewTasksSnap.size;
  if (pendingReviewCount > 0)
    alerts.push({ id: "review", tone: "amber", href: "/board", text: `${pendingReviewCount} task(s) awaiting your review` });

  // ── Due reminders — no N+1 loop needed, title is stored on the Reminder ──
  // For reminders that don't yet have a title (pre-backfill), we do a single
  // Promise.all fetch rather than sequential awaits.
  if (!remindersSnap.empty) {
    const remDocs = remindersSnap.docs;
    // Fetch task titles in parallel for reminders that don't have a cached title
    const needsTitle = remDocs.filter(r => !r.data().taskTitle);
    let taskTitles = new Map<string, string>();
    if (needsTitle.length > 0) {
      const taskDocs = await Promise.all(
        needsTitle.map(r => adminDb.collection("Task").doc(r.data().taskId).get())
      );
      taskDocs.forEach(td => {
        if (td.exists) taskTitles.set(td.id, td.data()!.title);
      });
    }
    for (const r of remDocs) {
      const rd = r.data();
      const title = rd.taskTitle ?? taskTitles.get(rd.taskId) ?? "Task";
      alerts.push({
        id: `reminder-${r.id}`,
        tone: "blue",
        href: `/task/${rd.taskId}`,
        text: `⏰ Reminder: ${title}`,
      });
    }
  }

  // ── Stale on-hold tasks (48h+) ────────────────────────────────────────────
  const staleOnHold = activeTasksSnap.docs.filter(d => {
    const data = d.data();
    return data.status === "ON_HOLD" && data.updatedAt && toDate(data.updatedAt) < new Date(now.getTime() - 48 * HOUR);
  });
  if (staleOnHold.length > 0)
    alerts.push({ id: "stale-hold", tone: "red", href: "/board", text: `${staleOnHold.length} task(s) on hold for 48h+ — update the status` });

  // ── KPI bucket balance ────────────────────────────────────────────────────
  const roleBuckets = kpiCountSnap.size;
  if (roleBuckets >= 4) {
    const workedKpis = new Set(monthTasksSnap.docs.map(d => d.data().kpiTemplateId).filter(Boolean));
    if (monthTasksSnap.docs.length >= 3 && workedKpis.size <= 2) {
      alerts.push({ id: "kpi-balance", tone: "amber", href: "/performance", text: `KPI balance is off — only ${workedKpis.size} of ${roleBuckets} buckets worked this month` });
    }
  }

  // ── Manager alerts ────────────────────────────────────────────────────────
  if (isManagerLike(user.systemRole)) {
    const reportSnap = await adminDb.collection("Employee")
      .where("reportsToId", "==", user.id)
      .where("active", "==", true)
      .get();
    const reportIds = reportSnap.docs ? reportSnap.docs.map(d => d.id) : [];

    if (reportIds.length) {
      const teamOverdueIds = new Set<string>();
      const teamStaleIds = new Set<string>();

      // Chunk into groups of 30 (Firebase Admin limit for 'in' queries)
      const chunks: string[][] = [];
      for (let i = 0; i < reportIds.length; i += 30) {
        chunks.push(reportIds.slice(i, i + 30));
      }

      // Parallel chunk queries
      const teamTasksSnaps = await Promise.all(chunks.map(chunk =>
        adminDb.collection("Task")
          .where("assigneeId", "in", chunk)
          .where("status", "!=", "CLOSED")
          .get()
      ));

      teamTasksSnaps.forEach(snap => {
        snap.docs.forEach(d => {
          const data = d.data();
          const assigneeId = data.assigneeId;
          if (data.dueAt && toDate(data.dueAt) < now) {
            teamOverdueIds.add(assigneeId);
          }
          if (data.status === "ON_HOLD" && data.updatedAt && toDate(data.updatedAt) < new Date(now.getTime() - 96 * HOUR)) {
            teamStaleIds.add(assigneeId);
          }
        });
      });

      if (teamOverdueIds.size > 0)
        alerts.push({ id: "team-overdue", tone: "amber", href: "/team", text: `${teamOverdueIds.size} of your team have overdue tasks` });
      if (teamStaleIds.size > 0)
        alerts.push({ id: "team-stale-hold", tone: "red", href: "/team", text: `⚠ ${teamStaleIds.size} team member(s) have tasks on hold 96h+ — escalated to you` });

      const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const py = prevStart.getFullYear();
      const pm = prevStart.getMonth() + 1;

      // Batch fetch scorecards in a single query (uses 'in' instead of N+1)
      const scorecardsSnap = reportIds.length > 0
        ? await adminDb.collection("MonthlyScorecard")
            .where("employeeId", "in", reportIds.slice(0, 30)) // safe — managers typically have <30 reports
            .where("year", "==", py)
            .where("month", "==", pm)
            .get()
        : { docs: [] } as any;

      const finalized = new Set(
        scorecardsSnap.docs?.filter((d: any) => d.data().source !== "auto").map((d: any) => d.data().employeeId) ?? []
      );
      const pending = reportIds.filter(id => !finalized.has(id)).length;
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

  // ── Admin / CEO company-wide scorecard check ──────────────────────────────
  if ((user.systemRole === "ADMIN" || user.systemRole === "CEO") && now.getDate() > 5) {
    const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const py = prevStart.getFullYear();
    const pm = prevStart.getMonth() + 1;
    const monthName = prevStart.toLocaleDateString("en-IN", { month: "long" });
    const activeSnap = await adminDb.collection("Employee").where("active", "==", true).get();
    const activeIds = activeSnap.docs ? activeSnap.docs.map((d: any) => d.id) : [];

    // Firestore 'in' supports up to 30; for companies >30 employees, run multiple queries
    const idChunks: string[][] = [];
    for (let i = 0; i < activeIds.length; i += 30) idChunks.push(activeIds.slice(i, i + 30));
    const cardSnaps = await Promise.all(
      idChunks.map(chunk =>
        adminDb.collection("MonthlyScorecard")
          .where("employeeId", "in", chunk)
          .where("year", "==", py)
          .where("month", "==", pm)
          .get()
      )
    );

    const finalizedAll = new Set<string>();
    cardSnaps.forEach(snap => {
      snap.docs?.filter((d: any) => d.data().source !== "auto").forEach((d: any) => finalizedAll.add(d.data().employeeId));
    });
    const pending = activeIds.filter(id => !finalizedAll.has(id)).length;
    if (pending > 0)
      alerts.push({ id: "score-escalation", tone: "red", href: "/scores", text: `⚠ ${pending} employee scorecard(s) for ${monthName} still not finalised across the company` });
  }

  return alerts;
}
