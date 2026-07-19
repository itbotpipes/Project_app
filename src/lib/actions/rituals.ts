"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function markMorningPlanned() {
  const user = await getCurrentUser();
  if (!user) return;
  const date = startOfToday();

  // Snapshot which tasks are open right now — "the plan" — so end-of-day we can
  // tell what was planned vs. what got done instead (ad-hoc/urgent additions).
  const openTasks = await prisma.task.findMany({
    where: { assigneeId: user.id, status: { notIn: ["CLOSED"] } },
    select: { id: true },
  });
  const plannedTaskIds = JSON.stringify(openTasks.map((t) => t.id));

  await prisma.dailyRitual.upsert({
    where: { employeeId_date: { employeeId: user.id, date } },
    create: { employeeId: user.id, date, morningPlanned: true, plannedTaskIds },
    update: { morningPlanned: true, plannedTaskIds },
  });
  revalidatePath("/");
}

export async function markEveningClosed() {
  const user = await getCurrentUser();
  if (!user) return;
  const date = startOfToday();
  await prisma.dailyRitual.upsert({
    where: { employeeId_date: { employeeId: user.id, date } },
    create: { employeeId: user.id, date, eveningClosed: true },
    update: { eveningClosed: true },
  });
  revalidatePath("/");
}
