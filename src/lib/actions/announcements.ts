"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// Admin, CEO, and HR can manage the board + thought of the day.
function canManage(user: { systemRole: string; role: { title: string } }) {
  return (
    user.systemRole === "ADMIN" ||
    user.systemRole === "CEO" ||
    user.role.title.toLowerCase().includes("hr")
  );
}

export async function saveThought(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !canManage(user)) return { error: "Not authorized" };
  const body = String(formData.get("body") || "").trim();
  if (!body) return { error: "Write a thought first" };

  // keep a single pinned thought — update the latest, else create
  const existing = await prisma.announcement.findFirst({
    where: { kind: "THOUGHT" },
    orderBy: { createdAt: "desc" },
  });
  if (existing) {
    await prisma.announcement.update({ where: { id: existing.id }, data: { body, authorId: user.id } });
  } else {
    await prisma.announcement.create({ data: { kind: "THOUGHT", pinned: true, body, authorId: user.id } });
  }
  revalidatePath("/");
  revalidatePath("/announcements");
  return { ok: true };
}

export async function createAnnouncement(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !canManage(user)) return { error: "Not authorized" };
  const title = String(formData.get("title") || "").trim() || null;
  const body = String(formData.get("body") || "").trim();
  if (!body) return { error: "Message is required" };
  await prisma.announcement.create({
    data: { kind: "NOTICE", title, body, authorId: user.id },
  });
  revalidatePath("/");
  revalidatePath("/announcements");
  return { ok: true };
}

export async function updateAnnouncement(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !canManage(user)) return { error: "Not authorized" };
  const id = String(formData.get("id") || "");
  const title = String(formData.get("title") || "").trim() || null;
  const body = String(formData.get("body") || "").trim();
  if (!id || !body) return { error: "Message is required" };
  await prisma.announcement.update({ where: { id }, data: { title, body } });
  revalidatePath("/");
  revalidatePath("/announcements");
  return { ok: true };
}

export async function deleteAnnouncement(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !canManage(user)) return;
  const id = String(formData.get("id") || "");
  if (!id) return;
  await prisma.announcement.delete({ where: { id } });
  revalidatePath("/");
  revalidatePath("/announcements");
}
