"use server";

import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function addComment(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  const taskId = String(formData.get("taskId") || "");
  const body = String(formData.get("body") || "").trim();
  if (!taskId || !body) return;
  await prisma.taskComment.create({ data: { taskId, authorId: user.id, body } });
  await prisma.auditLog.create({
    data: { actorId: user.id, action: "task.comment", entity: "Task", entityId: taskId },
  });
  revalidatePath(`/task/${taskId}`);
}

export async function createReminder(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in" };
  const taskId = String(formData.get("taskId") || "");
  const remindAtRaw = String(formData.get("remindAt") || "");
  if (!taskId || !remindAtRaw) return { error: "Pick a date & time" };
  await prisma.reminder.create({ data: { taskId, remindAt: new Date(remindAtRaw) } });
  await prisma.auditLog.create({
    data: { actorId: user.id, action: "task.remind", entity: "Task", entityId: taskId },
  });
  revalidatePath(`/task/${taskId}`);
  return { ok: true };
}

export async function dismissReminder(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  const id = String(formData.get("id") || "");
  const taskId = String(formData.get("taskId") || "");
  if (!id) return;
  await prisma.reminder.update({ where: { id }, data: { sent: true } });
  revalidatePath(`/task/${taskId}`);
  revalidatePath("/");
}

export async function uploadTaskAttachment(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in" };
  const taskId = String(formData.get("taskId") || "");
  const kind = String(formData.get("kind") || "FILE");
  const file = formData.get("file") as File | null;
  if (!taskId || !file || file.size === 0) return { error: "No file" };
  if (file.size > 15 * 1024 * 1024) return { error: "File too large (max 15MB)" };

  const bytes = Buffer.from(await file.arrayBuffer());
  const safe = (file.name || "upload").replace(/[^\w.\-]/g, "_");
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), bytes);

  await prisma.attachment.create({
    data: { taskId, kind, url: `/uploads/${filename}`, filename: file.name || filename },
  });
  await prisma.auditLog.create({
    data: { actorId: user.id, action: "task.attach", entity: "Task", entityId: taskId, detail: kind },
  });
  revalidatePath(`/task/${taskId}`);
  return { ok: true };
}
