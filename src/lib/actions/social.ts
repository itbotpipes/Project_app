"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, canScoreCompanyWide } from "@/lib/auth";
import { adminDb } from "@/lib/firebase/admin";
import { REACTION_EMOJIS, type ReactionEmoji } from "@/lib/reactions";

export async function toggleReaction(announcementId: string, emoji: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in" };
  if (!REACTION_EMOJIS.includes(emoji as ReactionEmoji)) return { error: "Bad emoji" };

  const snap = await adminDb.collection("AnnouncementReaction")
    .where("announcementId", "==", announcementId)
    .where("employeeId", "==", user.id)
    .where("emoji", "==", emoji)
    .limit(1)
    .get();

  if (!snap.empty) {
    await adminDb.collection("AnnouncementReaction").doc(snap.docs[0].id).delete();
  } else {
    await adminDb.collection("AnnouncementReaction").add({
      announcementId,
      employeeId: user.id,
      emoji,
      createdAt: new Date(),
    });
  }
  revalidatePath("/");
  revalidatePath("/announcements");
  return { ok: true };
}

export async function addComment(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in" };
  const announcementId = String(formData.get("announcementId") || "");
  const body = String(formData.get("body") || "").trim();
  if (!announcementId || !body) return { error: "Empty comment" };
  if (body.length > 1000) return { error: "Too long" };

  await adminDb.collection("AnnouncementComment").add({
    announcementId,
    employeeId: user.id,
    body,
    createdAt: new Date(),
  });
  revalidatePath("/");
  revalidatePath("/announcements");
  return { ok: true };
}

export async function deleteComment(commentId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in" };

  const cDoc = await adminDb.collection("AnnouncementComment").doc(commentId).get();
  if (!cDoc.exists) return { error: "Not found" };
  const c = cDoc.data()!;

  if (c.employeeId !== user.id && !canScoreCompanyWide(user)) return { error: "Not authorized" };
  await adminDb.collection("AnnouncementComment").doc(commentId).delete();
  revalidatePath("/");
  revalidatePath("/announcements");
  return { ok: true };
}

export async function postBirthdayWish(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in" };
  const forId = String(formData.get("forId") || "");
  const body = String(formData.get("body") || "").trim();
  const tagged = formData.getAll("taggedIds").map(String).filter(Boolean);
  if (!forId || !body) return { error: "Write a wish first" };
  if (body.length > 500) return { error: "Too long" };

  await adminDb.collection("BirthdayWish").add({
    forId,
    fromId: user.id,
    body,
    taggedIds: tagged.length ? JSON.stringify(tagged) : null,
    year: new Date().getFullYear(),
    createdAt: new Date(),
  });
  revalidatePath("/");
  return { ok: true };
}
