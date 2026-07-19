"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser, isManagerLike, canScoreCompanyWide } from "@/lib/auth";

/** Can `rater` give a holistic score to `employeeId`? Company-wide scorers, or their direct manager. */
async function canRate(raterId: string, employeeId: string) {
  const rater = await prisma.employee.findUnique({ where: { id: raterId }, include: { role: true } });
  if (!rater) return false;
  if (canScoreCompanyWide(rater)) return true;
  if (!isManagerLike(rater.systemRole)) return false;
  const target = await prisma.employee.findUnique({ where: { id: employeeId } });
  return target?.reportsToId === raterId;
}

export async function saveManagerScore(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in" };

  const employeeId = String(formData.get("employeeId") || "");
  const period = String(formData.get("period") || "MONTHLY");
  const periodStartRaw = String(formData.get("periodStart") || "");
  const score = Number(formData.get("score"));
  const note = String(formData.get("note") || "") || null;

  if (!employeeId || !periodStartRaw) return { error: "Missing employee or period" };
  if (Number.isNaN(score) || score < 0 || score > 100) return { error: "Score must be 0–100" };
  if (!(await canRate(user.id, employeeId))) return { error: "Not authorized to score this person" };

  const periodStart = new Date(periodStartRaw);

  await prisma.managerScore.upsert({
    where: { employeeId_period_periodStart: { employeeId, period, periodStart } },
    create: { employeeId, ratedById: user.id, period, periodStart, score, note },
    update: { score, note, ratedById: user.id },
  });

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: "score.manager",
      entity: "ManagerScore",
      entityId: employeeId,
      detail: `${period} ${periodStart.toISOString().slice(0, 10)} = ${score}`,
    },
  });

  revalidatePath("/scores");
  revalidatePath("/performance");
  revalidatePath("/team");
  revalidatePath("/");
  return { ok: true };
}
