"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser, canScoreCompanyWide } from "@/lib/auth";
import { REACTION_EMOJIS, type ReactionEmoji } from "@/lib/reactions";

/** Add my reaction, or remove it if I already reacted with that emoji (like / unlike). */
export async function toggleReaction(announcementId: string, emoji: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in" };
  if (!REACTION_EMOJIS.includes(emoji as ReactionEmoji)) return { error: "Bad emoji" };

  const existing = await prisma.announcementReaction.findUnique({
    where: { announcementId_employeeId_emoji: { announcementId, employeeId: user.id, emoji } },
  });
  if (existing) {
    await prisma.announcementReaction.delete({ where: { id: existing.id } });
  } else {
    await prisma.announcementReaction.create({ data: { announcementId, employeeId: user.id, emoji } });
  }
  revalidatePath("/");
  revalidatePath("/announcements");
  return { ok: true };
}

/** Add a comment to an announcement / the Thought of the day. */
export async function addComment(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in" };
  const announcementId = String(formData.get("announcementId") || "");
  const body = String(formData.get("body") || "").trim();
  if (!announcementId || !body) return { error: "Empty comment" };
  if (body.length > 1000) return { error: "Too long" };

  await prisma.announcementComment.create({
    data: { announcementId, employeeId: user.id, body },
  });
  revalidatePath("/");
  revalidatePath("/announcements");
  return { ok: true };
}

/** Delete a comment — author, or Admin/CEO/HR. */
export async function deleteComment(commentId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in" };
  const c = await prisma.announcementComment.findUnique({ where: { id: commentId } });
  if (!c) return { error: "Not found" };
  if (c.employeeId !== user.id && !canScoreCompanyWide(user)) return { error: "Not authorized" };
  await prisma.announcementComment.delete({ where: { id: commentId } });
  revalidatePath("/");
  revalidatePath("/announcements");
  return { ok: true };
}

/** Post a birthday wish for a colleague; can @-tag other employees. */
export async function postBirthdayWish(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in" };
  const forId = String(formData.get("forId") || "");
  const body = String(formData.get("body") || "").trim();
  const tagged = formData.getAll("taggedIds").map(String).filter(Boolean);
  if (!forId || !body) return { error: "Write a wish first" };
  if (body.length > 500) return { error: "Too long" };

  await prisma.birthdayWish.create({
    data: {
      forId,
      fromId: user.id,
      body,
      taggedIds: tagged.length ? JSON.stringify(tagged) : null,
      year: new Date().getFullYear(),
    },
  });
  revalidatePath("/");
  return { ok: true };
}
