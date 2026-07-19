"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { mondayOf } from "@/lib/date";

export async function saveReflection(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  const weekStart = mondayOf();
  const data = {
    wentWell: String(formData.get("wentWell") || "") || null,
    whatDelayed: String(formData.get("whatDelayed") || "") || null,
    whatImprove: String(formData.get("whatImprove") || "") || null,
  };
  await prisma.weeklyReflection.upsert({
    where: { employeeId_weekStart: { employeeId: user.id, weekStart } },
    create: { employeeId: user.id, weekStart, ...data },
    update: data,
  });
  await prisma.auditLog.create({
    data: { actorId: user.id, action: "reflection.save", entity: "WeeklyReflection" },
  });
  revalidatePath("/reflection");
}
