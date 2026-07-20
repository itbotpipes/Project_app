"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser, isManagerLike, canScoreCompanyWide } from "@/lib/auth";
import { computeAutoScores } from "@/lib/autoscore";

async function canScore(raterId: string, employeeId: string) {
  const rater = await prisma.employee.findUnique({ where: { id: raterId }, include: { role: true } });
  if (!rater) return false;
  if (canScoreCompanyWide(rater)) return true;
  if (!isManagerLike(rater.systemRole)) return false;
  const target = await prisma.employee.findUnique({ where: { id: employeeId } });
  return target?.reportsToId === raterId;
}

/**
 * Save a monthly KRA scorecard for an employee.
 * Recomputes each KPI's auto score server-side (integrity), stores the manager's
 * final value per KPI (defaulting to auto if left blank), and rolls up both totals.
 */
export async function saveMonthlyScorecard(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in" };

  const employeeId = String(formData.get("employeeId") || "");
  const year = Number(formData.get("year"));
  const month = Number(formData.get("month"));
  if (!employeeId || !year || !month) return { error: "Missing fields" };
  if (!(await canScore(user.id, employeeId))) return { error: "Not authorized" };

  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) return { error: "No such employee" };

  const kpis = await prisma.kpiTemplate.findMany({ where: { roleId: employee.roleId } });

  // recompute auto scores for this month
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 1);
  const tasks = await prisma.task.findMany({
    where: { assigneeId: employeeId, createdAt: { gte: monthStart, lt: monthEnd } },
    select: { kpiTemplateId: true, status: true, createdAt: true, completedAt: true, carryCount: true },
  });
  const auto = computeAutoScores(kpis.map((k) => ({ id: k.id, weightage: k.weightage })), tasks);

  let total = 0;
  let autoTotal = 0;
  for (const k of kpis) {
    const a = auto.get(k.id)?.auto ?? 0;
    autoTotal += a;
    const raw = formData.get(`kpi_${k.id}`);
    // blank field = accept the system auto value
    const finalScore = raw != null && raw !== "" ? Number(raw) : a;
    const clamped = Math.max(0, Math.min(finalScore, k.weightage));
    total += clamped;
    await prisma.monthlyScore.upsert({
      where: { employeeId_kpiTemplateId_year_month: { employeeId, kpiTemplateId: k.id, year, month } },
      create: { employeeId, kpiTemplateId: k.id, year, month, autoScore: a, score: clamped },
      update: { autoScore: a, score: clamped },
    });
  }

  await prisma.monthlyScorecard.upsert({
    where: { employeeId_year_month: { employeeId, year, month } },
    create: { employeeId, year, month, total, autoTotal, source: "computed" },
    update: { total, autoTotal, source: "computed" },
  });

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: "score.save",
      entity: "MonthlyScorecard",
      entityId: employeeId,
      detail: `${year}-${month} total ${total.toFixed(1)} (auto ${autoTotal.toFixed(1)})`,
    },
  });

  revalidatePath("/scores");
  revalidatePath("/team");
  revalidatePath("/performance");
  revalidatePath("/");
  return { ok: true };
}

/** Manager/admin sets the annual behaviour + target-achievement inputs for the increment projection. */
export async function saveYearlyReview(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in" };
  const employeeId = String(formData.get("employeeId") || "");
  const year = Number(formData.get("year"));
  if (!employeeId || !year) return { error: "Missing fields" };
  if (!(await canScore(user.id, employeeId))) return { error: "Not authorized" };

  const clampPct = (v: FormDataEntryValue | null) =>
    v != null && v !== "" ? Math.max(0, Math.min(100, Number(v))) : null;
  const behaviourScore = clampPct(formData.get("behaviourScore"));
  const targetAchievedPct = clampPct(formData.get("targetAchievedPct"));

  await prisma.yearlyReview.upsert({
    where: { employeeId_year: { employeeId, year } },
    create: { employeeId, year, behaviourScore, targetAchievedPct },
    update: { behaviourScore, targetAchievedPct },
  });
  revalidatePath("/scores");
  revalidatePath("/performance");
  return { ok: true };
}
