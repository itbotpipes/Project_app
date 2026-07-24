"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { adminDb } from "@/lib/firebase/admin";

function canManage(user: { systemRole: string; role: { title: string } }) {
  return (
    user.systemRole === "ADMIN" ||
    user.systemRole === "CEO" ||
    (user.role && user.role.title && user.role.title.toLowerCase().includes("hr"))
  );
}

export async function saveThought(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !canManage(user)) return { error: "Not authorized" };
  const body = String(formData.get("body") || "").trim();
  if (!body) return { error: "Write a thought first" };

  const thoughtSnap = await adminDb.collection("Announcement")
    .where("kind", "==", "THOUGHT")
    .orderBy("createdAt", "desc")
    .limit(1)
    .get();

  if (!thoughtSnap.empty) {
    await adminDb.collection("Announcement").doc(thoughtSnap.docs[0].id).update({
      body,
      authorId: user.id,
      updatedAt: new Date(),
    });
  } else {
    await adminDb.collection("Announcement").add({
      kind: "THOUGHT",
      pinned: true,
      body,
      authorId: user.id,
      createdAt: new Date(),
    });
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
  
  await adminDb.collection("Announcement").add({
    kind: "NOTICE",
    title,
    body,
    authorId: user.id,
    createdAt: new Date(),
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
  
  await adminDb.collection("Announcement").doc(id).update({
    title,
    body,
    updatedAt: new Date(),
  });
  
  revalidatePath("/");
  revalidatePath("/announcements");
  return { ok: true };
}

export async function deleteAnnouncement(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !canManage(user)) return;
  const id = String(formData.get("id") || "");
  if (!id) return;
  
  await adminDb.collection("Announcement").doc(id).delete();
  
  revalidatePath("/");
  revalidatePath("/announcements");
}
