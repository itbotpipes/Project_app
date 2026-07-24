import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { computeAutoScores } from "@/lib/autoscore";
import { previousMonthStart } from "@/lib/date";
import { FieldValue } from "firebase-admin/firestore";

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

  const staleSnap = await adminDb.collection("Task")
    .where("status", "!=", "CLOSED")
    .get();

  // Filter in JS — no composite index needed
  const staleDocs = staleSnap.docs.filter((doc) => {
    const dueAt = toDate(doc.data().dueAt);
    return dueAt && dueAt < startOfToday;
  });

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

  const employees = employeesSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
  const roleIds = [...new Set(employees.map((e) => e.roleId).filter(Boolean))];

  const kpisByRole = new Map<string, any[]>();
  await Promise.all(
    roleIds.map(async (roleId) => {
      const snap = await adminDb.collection("KpiTemplate").where("roleId", "==", roleId).get();
      kpisByRole.set(roleId, snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    })
  );

  const empIds = employees.map((e) => e.id);
  const tasksByEmp = new Map<string, any[]>();
  // Firestore "in" query supports max 30, batch if needed
  const chunks: string[][] = [];
  for (let i = 0; i < empIds.length; i += 30) chunks.push(empIds.slice(i, i + 30));
  for (const chunk of chunks) {
    const tasksSnap = await adminDb.collection("Task")
      .where("assigneeId", "in", chunk)
      .get();
    // Filter date range in JS — no composite index needed
    const prevMs = prev.getTime();
    const monthEndMs = monthEnd.getTime();
    for (const doc of tasksSnap.docs) {
      const raw = doc.data().createdAt;
      const createdAt = raw?.toDate ? raw.toDate() : new Date(raw ?? 0);
      if (createdAt.getTime() < prevMs || createdAt.getTime() >= monthEndMs) continue;
      const t: any = { ...doc.data(), completedAt: toDate(doc.data().completedAt), createdAt };
      const arr = tasksByEmp.get(t.assigneeId) ?? [];
      arr.push(t);
      tasksByEmp.set(t.assigneeId, arr);
    }
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
      const scoreSnap = await adminDb.collection("MonthlyScore")
        .where("employeeId", "==", e.id)
        .where("kpiTemplateId", "==", k.id)
        .where("year", "==", year)
        .where("month", "==", month)
        .limit(1)
        .get();
      if (scoreSnap.empty) {
        await adminDb.collection("MonthlyScore").add({ employeeId: e.id, kpiTemplateId: k.id, year, month, autoScore: a, score: a });
      } else {
        await adminDb.collection("MonthlyScore").doc(scoreSnap.docs[0].id).update({ autoScore: a });
      }
    }
    const cardSnap = await adminDb.collection("MonthlyScorecard")
      .where("employeeId", "==", e.id)
      .where("year", "==", year)
      .where("month", "==", month)
      .limit(1)
      .get();
    if (cardSnap.empty) {
      await adminDb.collection("MonthlyScorecard").add({ employeeId: e.id, year, month, total: autoTotal, autoTotal, source: "auto", locked: false, updatedAt: new Date() });
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
