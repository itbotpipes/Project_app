"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { adminDb } from "@/lib/firebase/admin";

async function assertTaskAccess(taskId: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  const taskDoc = await adminDb.collection("Task").doc(taskId).get();
  if (!taskDoc.exists) return null;
  return { user, task: { id: taskId, ...taskDoc.data()! } };
}

export async function addChecklistItem(formData: FormData) {
  const taskId = String(formData.get("taskId") || "");
  const text = String(formData.get("text") || "").trim();
  if (!taskId || !text) return;
  const ctx = await assertTaskAccess(taskId);
  if (!ctx) return;

  const countSnap = await adminDb.collection("ChecklistItem").where("taskId", "==", taskId).get();
  const count = countSnap.size;

  await adminDb.collection("ChecklistItem").add({
    taskId,
    text,
    orderIndex: count,
    done: false,
    createdAt: new Date(),
  });
  revalidatePath(`/task/${taskId}`);
}

export async function toggleChecklistItem(formData: FormData) {
  const id = String(formData.get("id") || "");
  if (!id) return;
  const itemDoc = await adminDb.collection("ChecklistItem").doc(id).get();
  if (!itemDoc.exists) return;
  const item = itemDoc.data()!;
  const user = await getCurrentUser();
  if (!user) return;

  const done = !item.done;
  await adminDb.collection("ChecklistItem").doc(id).update({
    done,
    doneAt: done ? new Date() : null,
    doneById: done ? user.id : null,
  });
  revalidatePath(`/task/${item.taskId}`);
}

export async function deleteChecklistItem(formData: FormData) {
  const id = String(formData.get("id") || "");
  if (!id) return;
  const itemDoc = await adminDb.collection("ChecklistItem").doc(id).get();
  if (!itemDoc.exists) return;
  const item = itemDoc.data()!;
  await adminDb.collection("ChecklistItem").doc(id).delete();
  revalidatePath(`/task/${item.taskId}`);
}
