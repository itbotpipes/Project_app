import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { computeAutoScores } from "@/lib/autoscore";
import { previousMonthStart } from "@/lib/date";
import { FieldValue } from "firebase-admin/firestore";
import { batchFetchByIds } from "@/lib/cache";

function toDate(val: any): Date | null {
  if (!val) return null;
  if (val.toDate) return val.toDate();
  return new Date(val);
}

export async function carryForwardOpenTasks(): Promise<number> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 0, 0);

  // Query only tasks with a past dueAt that are not closed.
  // Previously: fetched all non-CLOSED tasks and filtered in JS.
  // Now: use the composite index [status ASC, dueAt ASC] to let Firestore filter.
  const staleSnap = await adminDb.collection("Task")
    .where("status", "!=", "CLOSED")
    .where("dueAt", "<", startOfToday)
    .get();

  const staleDocs = staleSnap.docs.filter(doc => !doc.data().deletedAt);

  const batch = adminDb.batch();
  for (const doc of staleDocs) {
    batch.update(doc.ref, {
      dueAt: endOfToday,
      carryCount: FieldValue.increment(1),
      carryForwardDate: new Date(),
      updatedAt: new Date(),
    });
  }
  if (staleDocs.length > 0) await batch.commit();

  if (staleDocs.length > 0) {
    await adminDb.collection("AuditLog").add({
      action: "task.autoCarryForward",
      entity: "Task",
      detail: `${staleDocs.length} task(s) carried forward to today`,
      createdAt: new Date(),
    });
  }
  return staleDocs.length;
}

export async function ensureMonthlyAutoScorecards(): Promise<number> {
  const prev = previousMonthStart();
  const year = prev.getFullYear();
  const month = prev.getMonth() + 1;
  const monthEnd = new Date(year, month, 1);

  const employeesSnap = await adminDb.collection("Employee").where("active", "==", true).get();
  if (employeesSnap.empty) return 0;

  const employees = employeesSnap.docs
    ? (employeesSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[])
    : [];
  const roleIds = [...new Set(employees.map(e => e.roleId).filter(Boolean))];

  // Batch fetch all KPI templates by role IDs (parallel, chunk size 30)
  const kpisMap = await batchFetchByIds("KpiTemplate", roleIds, adminDb);

  // Group KPIs by role
  const kpisByRole = new Map<string, any[]>();
  kpisMap.forEach((kpi: any) => {
    const roleId = kpi.roleId;
    if (!kpisByRole.has(roleId)) kpisByRole.set(roleId, []);
    kpisByRole.get(roleId)!.push(kpi);
  });

  const empIds = employees.map(e => e.id);
  const tasksByEmp = new Map<string, any[]>();

  // Chunk into groups of 30 and fetch in PARALLEL (was sequential)
  const CHUNK = 30;
  const chunks: string[][] = [];
  for (let i = 0; i < empIds.length; i += CHUNK) chunks.push(empIds.slice(i, i + CHUNK));

  const taskSnaps = await Promise.all(
    chunks.map(chunk =>
      adminDb.collection("Task")
        .where("assigneeId", "in", chunk)
        .where("createdAt", ">=", prev)
        .where("createdAt", "<", monthEnd)
        .get()
    )
  );

  // Accumulate tasks per employee (date filtering now done by Firestore)
  for (const snap of taskSnaps) {
    for (const doc of snap.docs) {
      const t = doc.data();
      const task: any = {
        ...t,
        completedAt: toDate(t.completedAt),
        createdAt: toDate(t.createdAt) ?? new Date(0),
      };
      const arr = tasksByEmp.get(task.assigneeId) ?? [];
      arr.push(task);
      tasksByEmp.set(task.assigneeId, arr);
    }
  }

  let created = 0;

  // Process each employee — batch all score writes per employee
  for (const e of employees) {
    const roleKpis = kpisByRole.get(e.roleId) ?? [];
    if (!roleKpis.length) continue;

    const auto = computeAutoScores(
      roleKpis.map(k => ({ id: k.id, weightage: k.weightage })),
      tasksByEmp.get(e.id) ?? []
    );

    // Fetch all existing MonthlyScore docs for this employee/month in ONE query
    const existingScoresSnap = await adminDb.collection("MonthlyScore")
      .where("employeeId", "==", e.id)
      .where("year", "==", year)
      .where("month", "==", month)
      .get();
    const existingScoresByKpi = new Map<string, string>(); // kpiTemplateId → docId
    existingScoresSnap.docs.forEach(d => existingScoresByKpi.set(d.data().kpiTemplateId, d.id));

    // Batch all score writes for this employee
    const scoreBatch = adminDb.batch();
    let autoTotal = 0;
    for (const k of roleKpis) {
      const a = auto.get(k.id)?.auto ?? 0;
      autoTotal += a;
      const existingId = existingScoresByKpi.get(k.id);
      if (!existingId) {
        const ref = adminDb.collection("MonthlyScore").doc();
        scoreBatch.set(ref, { employeeId: e.id, kpiTemplateId: k.id, year, month, autoScore: a, score: a });
      } else {
        scoreBatch.update(adminDb.collection("MonthlyScore").doc(existingId), { autoScore: a });
      }
    }
    await scoreBatch.commit();

    // Upsert the MonthlyScorecard
    const cardSnap = await adminDb.collection("MonthlyScorecard")
      .where("employeeId", "==", e.id)
      .where("year", "==", year)
      .where("month", "==", month)
      .limit(1)
      .get();
    if (cardSnap.empty) {
      await adminDb.collection("MonthlyScorecard").add({
        employeeId: e.id, year, month,
        total: autoTotal, autoTotal,
        source: "auto", locked: false, updatedAt: new Date(),
      });
      created++;
    } else {
      const card = cardSnap.docs[0];
      if (card.data().source === "auto") {
        await adminDb.collection("MonthlyScorecard").doc(card.id).update({ total: autoTotal, autoTotal, updatedAt: new Date() });
      } else {
        await adminDb.collection("MonthlyScorecard").doc(card.id).update({ autoTotal, updatedAt: new Date() });
      }
    }
  }
  return created;
}

export async function runDailyJobs(): Promise<{ carried: number; scorecards: number; ranAt: string }> {
  const carried = await carryForwardOpenTasks();
  const scorecards = new Date().getDate() <= 7 ? await ensureMonthlyAutoScorecards() : 0;
  return { carried, scorecards, ranAt: new Date().toISOString() };
}
