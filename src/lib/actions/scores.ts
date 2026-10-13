"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, isManagerLike, canScoreCompanyWide } from "@/lib/auth";
import { adminDb } from "@/lib/firebase/admin";
import { computeAutoScores } from "@/lib/autoscore";
import { BEHAVIOUR_ASPECTS } from "@/lib/behaviour";

/**
 * Authorization check for scoring a given employee.
 * Accepts the full user object (from getCurrentUser) so we don't re-fetch
 * Employee + Role on every scoring action — those were 2 extra Firestore reads.
 */
async function canScoreForUser(
  user: { id: string; systemRole: string; role: { title: string } | null },
  employeeId: string
) {
  // Company-wide scorers (ADMIN, CEO, HR) can always score anyone
  if (user.role && canScoreCompanyWide(user as any)) return true;
  // Managers can only score direct reports
  if (!isManagerLike(user.systemRole)) return false;
  const targetDoc = await adminDb.collection("Employee").doc(employeeId).get();
  if (!targetDoc.exists) return false;
  const targetData = targetDoc.data()!;
  const reportsToIds = targetData.reportsToIds || (targetData.reportsToId ? [targetData.reportsToId] : []);
  return reportsToIds.includes(user.id);
}


export async function saveMonthlyScorecard(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in" };

  const employeeId = String(formData.get("employeeId") || "");
  const year = Number(formData.get("year"));
  const month = Number(formData.get("month"));
  if (!employeeId || !year || !month) return { error: "Missing fields" };
  if (!(await canScoreForUser(user, employeeId))) return { error: "Not authorized" };

  const employeeDoc = await adminDb.collection("Employee").doc(employeeId).get();
  if (!employeeDoc.exists) return { error: "No such employee" };
  const employee = employeeDoc.data()!;

  const kpisSnap = await adminDb.collection("KpiTemplate").where("roleId", "==", employee.roleId).get();
  const kpis = kpisSnap.docs ? kpisSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[] : [];

  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 1);
  const tasksSnap = await adminDb.collection("Task")
    .where("assigneeId", "==", employeeId)
    .get();
  // Filter date range in JS — no composite index needed
  const monthStartMs = monthStart.getTime();
  const monthEndMs = monthEnd.getTime();
  const tasks = tasksSnap.docs
    .filter((d) => {
      const raw = d.data().createdAt;
      const createdAt = raw?.toDate ? raw.toDate() : new Date(raw ?? 0);
      return createdAt.getTime() >= monthStartMs && createdAt.getTime() < monthEndMs;
    })
    .map((d) => {
    const t = d.data();
    return {
      kpiTemplateId: t.kpiTemplateId,
      status: t.status,
      createdAt: t.createdAt?.toDate ? t.createdAt.toDate() : new Date(t.createdAt),
      completedAt: t.completedAt ? (t.completedAt?.toDate ? t.completedAt.toDate() : new Date(t.completedAt)) : null,
      carryCount: t.carryCount ?? 0,
    };
  });

  const auto = computeAutoScores(kpis.map((k) => ({ id: k.id, weightage: k.weightage })), tasks);

  let total = 0;
  let autoTotal = 0;
  for (const k of kpis) {
    const a = auto.get(k.id)?.auto ?? 0;
    autoTotal += a;
    const raw = formData.get(`kpi_${k.id}`);
    const finalScore = raw != null && raw !== "" ? Number(raw) : a;
    const clamped = Math.max(0, Math.min(finalScore, k.weightage));
    total += clamped;

    // Upsert MonthlyScore
    const scoreSnap = await adminDb.collection("MonthlyScore")
      .where("employeeId", "==", employeeId)
      .where("kpiTemplateId", "==", k.id)
      .where("year", "==", year)
      .where("month", "==", month)
      .limit(1)
      .get();

    if (!scoreSnap.empty) {
      await adminDb.collection("MonthlyScore").doc(scoreSnap.docs[0].id).update({ autoScore: a, score: clamped });
    } else {
      await adminDb.collection("MonthlyScore").add({ employeeId, kpiTemplateId: k.id, year, month, autoScore: a, score: clamped });
    }
  }

  // Upsert MonthlyScorecard
  const cardSnap = await adminDb.collection("MonthlyScorecard")
    .where("employeeId", "==", employeeId)
    .where("year", "==", year)
    .where("month", "==", month)
    .limit(1)
    .get();

  const cardData = { employeeId, year, month, total, autoTotal, source: "computed", updatedAt: new Date() };
  if (!cardSnap.empty) {
    await adminDb.collection("MonthlyScorecard").doc(cardSnap.docs[0].id).update(cardData);
  } else {
    await adminDb.collection("MonthlyScorecard").add({ ...cardData, locked: false });
  }

  await adminDb.collection("AuditLog").add({
    actorId: user.id,
    action: "score.save",
    entity: "MonthlyScorecard",
    entityId: employeeId,
    detail: `${year}-${month} total ${total.toFixed(1)} (auto ${autoTotal.toFixed(1)})`,
    createdAt: new Date(),
  });

  revalidatePath("/scores");
  revalidatePath("/team");
  revalidatePath("/performance");
  revalidatePath("/people");
  revalidatePath("/");
  return { ok: true };
}

export async function saveYearlyReview(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in" };
  const employeeId = String(formData.get("employeeId") || "");
  const year = Number(formData.get("year"));
  if (!employeeId || !year) return { error: "Missing fields" };
  if (!(await canScoreForUser(user, employeeId))) return { error: "Not authorized" };

  const clampPct = (v: FormDataEntryValue | null) =>
    v != null && v !== "" ? Math.max(0, Math.min(100, Number(v))) : null;
  const behaviourScore = clampPct(formData.get("behaviourScore"));
  const targetAchievedPct = clampPct(formData.get("targetAchievedPct"));

  const snap = await adminDb.collection("YearlyReview")
    .where("employeeId", "==", employeeId)
    .where("year", "==", year)
    .limit(1)
    .get();

  const data = { employeeId, year, behaviourScore, targetAchievedPct, updatedAt: new Date() };
  if (!snap.empty) {
    await adminDb.collection("YearlyReview").doc(snap.docs[0].id).update(data);
  } else {
    await adminDb.collection("YearlyReview").add(data);
  }

  revalidatePath("/scores");
  revalidatePath("/performance");
  revalidatePath("/people");
  return { ok: true };
}

export async function saveBehaviourReview(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in" };
  const employeeId = String(formData.get("employeeId") || "");
  const year = Number(formData.get("year"));
  const month = Number(formData.get("month"));
  if (!employeeId || !year || !month) return { error: "Missing fields" };
  if (!(await canScoreForUser(user, employeeId))) return { error: "Not authorized" };

  const clamp10 = (v: FormDataEntryValue | null) =>
    Math.max(0, Math.min(10, Number(v ?? 0) || 0));
  const aspectData = Object.fromEntries(
    BEHAVIOUR_ASPECTS.map((a) => [a.key, clamp10(formData.get(a.key))]),
  ) as Record<string, number>;
  const note = String(formData.get("behaviourNote") || "") || null;

  const snap = await adminDb.collection("BehaviourReview")
    .where("employeeId", "==", employeeId)
    .where("year", "==", year)
    .where("month", "==", month)
    .limit(1)
    .get();

  const data = { employeeId, year, month, ratedById: user.id, note, ...aspectData, updatedAt: new Date() };
  if (!snap.empty) {
    await adminDb.collection("BehaviourReview").doc(snap.docs[0].id).update(data);
  } else {
    await adminDb.collection("BehaviourReview").add(data);
  }

  await adminDb.collection("AuditLog").add({
    actorId: user.id,
    action: "behaviour.save",
    entity: "BehaviourReview",
    entityId: employeeId,
    detail: `${year}-${month} behaviour by ${user.name}`,
    createdAt: new Date(),
  });

  revalidatePath("/scores");
  revalidatePath("/performance");
  revalidatePath("/people");
  return { ok: true };
}

export async function getEmployeeScoringData(employeeId: string, year: number, month: number) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in" };
  if (!(await canScoreForUser(user, employeeId))) return { error: "Not authorized to score this employee" };

  const employeeDoc = await adminDb.collection("Employee").doc(employeeId).get();
  if (!employeeDoc.exists) return { error: "Employee not found" };
  const employeeData = employeeDoc.data()!;

  let roleTitle = "Team Member";
  let departmentName = "General";
  if (employeeData.roleId) {
    const roleDoc = await adminDb.collection("Role").doc(employeeData.roleId).get();
    if (roleDoc.exists) {
      const rData = roleDoc.data()!;
      roleTitle = rData.title || "Team Member";
      if (rData.departmentId) {
        const deptDoc = await adminDb.collection("Department").doc(rData.departmentId).get();
        if (deptDoc.exists) departmentName = deptDoc.data()!.name || "General";
      }
    }
  }

  // Fetch KPIs for employee's role
  let kpis: any[] = [];
  if (employeeData.roleId) {
    const kpisSnap = await adminDb.collection("KpiTemplate").where("roleId", "==", employeeData.roleId).get();
    kpis = kpisSnap.docs ? kpisSnap.docs.map((d: any) => ({ id: d.id, ...d.data() })) : [];
    kpis.sort((a: any, b: any) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
  }

  // Date bounds for month
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 1);
  const monthStartMs = monthStart.getTime();
  const monthEndMs = monthEnd.getTime();

  // Fetch tasks
  const tasksSnap = await adminDb.collection("Task").where("assigneeId", "==", employeeId).get();
  const tasks = tasksSnap.docs
    .filter((d: any) => {
      const t = d.data();
      if (t.deletedAt) return false;
      const raw = t.createdAt;
      const createdAt = raw?.toDate ? raw.toDate() : new Date(raw ?? 0);
      return createdAt.getTime() >= monthStartMs && createdAt.getTime() < monthEndMs;
    })
    .map((d: any) => {
      const t = d.data();
      return {
        kpiTemplateId: t.kpiTemplateId,
        status: t.status,
        createdAt: t.createdAt?.toDate ? t.createdAt.toDate() : new Date(t.createdAt),
        completedAt: t.completedAt ? (t.completedAt?.toDate ? t.completedAt.toDate() : new Date(t.completedAt)) : null,
        carryCount: t.carryCount ?? 0,
      };
    });

  const auto = computeAutoScores(
    kpis.map((k: any) => ({ id: k.id, weightage: k.weightage })),
    tasks
  );

  // Fetch existing MonthlyScores
  const scoresSnap = await adminDb.collection("MonthlyScore")
    .where("employeeId", "==", employeeId)
    .where("year", "==", year)
    .where("month", "==", month)
    .get();

  const scoreMap = new Map<string, number>();
  scoresSnap.docs?.forEach((d: any) => {
    const data = d.data();
    if (data.kpiTemplateId) scoreMap.set(data.kpiTemplateId, data.score);
  });

  const rows = kpis.map((k: any) => {
    const existing = scoreMap.has(k.id) ? scoreMap.get(k.id)! : null;
    const a = auto.get(k.id);
    return {
      id: k.id,
      name: k.kpiName,
      kra: k.kraName || "",
      weightage: k.weightage,
      auto: a?.auto ?? 0,
      tasks: a?.total ?? 0,
      current: existing,
      saved: existing != null,
    };
  });

  // Fetch BehaviourReview
  const behaviourSnap = await adminDb.collection("BehaviourReview")
    .where("employeeId", "==", employeeId)
    .where("year", "==", year)
    .where("month", "==", month)
    .limit(1)
    .get();
  const bh = !behaviourSnap.empty ? behaviourSnap.docs[0].data() : null;

  // Fetch YearlyReview
  const reviewSnap = await adminDb.collection("YearlyReview")
    .where("employeeId", "==", employeeId)
    .where("year", "==", year)
    .limit(1)
    .get();
  const review = !reviewSnap.empty ? reviewSnap.docs[0].data() : null;

  // Fetch Targets for employee
  const targetsSnap = await adminDb.collection("Target")
    .where("employeeId", "==", employeeId)
    .get();
  const targets = (targetsSnap.docs || []).map((d) => {
    const data = d.data();
    return {
      id: d.id,
      title: data.title,
      description: data.description ?? null,
      periodType: data.periodType ?? "month",
      targetType: data.targetType ?? "NUMERIC",
      metricUnit: data.metricUnit ?? "",
      targetValue: data.targetValue ?? 1,
      currentValue: data.currentValue ?? 0,
      weightagePct: data.weightagePct ?? 20,
      achievedPct: data.achievedPct ?? 0,
      managerScore: data.managerScore ?? null,
      managerFeedback: data.managerFeedback ?? null,
      status: data.status ?? "ACTIVE",
    };
  });

  return {
    employee: {
      id: employeeId,
      name: employeeData.name || "Employee",
      roleTitle,
      departmentName,
    },
    year,
    month,
    rows,
    behaviour: bh
      ? {
          attendance: bh.attendance ?? 0,
          punctuality: bh.punctuality ?? 0,
          learning: bh.learning ?? 0,
          helpfulness: bh.helpfulness ?? 0,
          trust: bh.trust ?? 0,
          conduct: bh.conduct ?? 0,
          note: bh.note ?? null,
        }
      : null,
    targetAchievedPct: review?.targetAchievedPct ?? null,
    targets,
  };
}
