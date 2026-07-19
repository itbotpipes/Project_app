"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function createTask(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const title = String(formData.get("title") || "").trim();
  if (!title) return;

  const assigneeId = String(formData.get("assigneeId") || user.id) || user.id;
  const kpiTemplateId = String(formData.get("kpiTemplateId") || "") || null;
  const sizeLabel = String(formData.get("sizeLabel") || "") || null;
  const estimatedMins = formData.get("estimatedMins")
    ? Number(formData.get("estimatedMins"))
    : null;
  const dueRaw = String(formData.get("dueAt") || "");
  const dueAt = dueRaw ? new Date(dueRaw) : null;
  const urgent = formData.get("urgent") === "on";
  const important = formData.get("important") === "on";
  const reviewRequired = formData.get("reviewRequired") === "on";

  await prisma.task.create({
    data: {
      title,
      description: String(formData.get("description") || "") || null,
      creatorId: user.id,
      assigneeId,
      kpiTemplateId,
      sizeLabel,
      estimatedMins,
      dueAt,
      urgent,
      important,
      reviewRequired,
      reviewerId: reviewRequired ? user.reportsToId : null,
      status: "NEW",
    },
  });

  await prisma.auditLog.create({
    data: { actorId: user.id, action: "task.create", entity: "Task", detail: title },
  });
  revalidatePath("/board");
  revalidatePath("/team");
}

export async function moveTask(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const taskId = String(formData.get("taskId") || "");
  const status = String(formData.get("status") || "");
  const holdReason = String(formData.get("holdReason") || "") || null;
  if (!taskId || !status) return;

  const data: Record<string, unknown> = { status };
  if (status === "ON_HOLD") data.holdReason = holdReason;
  if (status === "CLOSED") data.completedAt = new Date();
  if (status !== "ON_HOLD") data.holdReason = null;

  await prisma.task.update({ where: { id: taskId }, data });
  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: "task.move",
      entity: "Task",
      entityId: taskId,
      detail: status + (holdReason ? ` (${holdReason})` : ""),
    },
  });
  revalidatePath("/board");
  revalidatePath("/team");
}
