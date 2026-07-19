"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser, isManagerLike } from "@/lib/auth";

/**
 * Save a monthly KRA scorecard for an employee (manager action).
 * Reads one numeric field per KPI template (name = "kpi_<id>"), upserts each
 * MonthlyScore, then recomputes and stores the MonthlyScorecard total.
 */
export async function saveMonthlyScorecard(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !isManagerLike(user.systemRole)) return;

  const employeeId = String(formData.get("employeeId") || "");
  const year = Number(formData.get("year"));
  const month = Number(formData.get("month"));
  if (!employeeId || !year || !month) return;

  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) return;

  const kpis = await prisma.kpiTemplate.findMany({ where: { roleId: employee.roleId } });

  let total = 0;
  for (const k of kpis) {
    const raw = formData.get(`kpi_${k.id}`);
    const score = raw != null && raw !== "" ? Number(raw) : 0;
    const clamped = Math.max(0, Math.min(score, k.weightage));
    total += clamped;
    await prisma.monthlyScore.upsert({
      where: {
        employeeId_kpiTemplateId_year_month: {
          employeeId,
          kpiTemplateId: k.id,
          year,
          month,
        },
      },
      create: { employeeId, kpiTemplateId: k.id, year, month, score: clamped },
      update: { score: clamped },
    });
  }

  await prisma.monthlyScorecard.upsert({
    where: { employeeId_year_month: { employeeId, year, month } },
    create: { employeeId, year, month, total, source: "computed" },
    update: { total, source: "computed" },
  });

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: "score.save",
      entity: "MonthlyScorecard",
      entityId: employeeId,
      detail: `${year}-${month} total ${total.toFixed(1)}`,
    },
  });

  revalidatePath("/team");
  revalidatePath("/performance");
  revalidatePath("/");
}
