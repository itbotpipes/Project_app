"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, isManagerLike } from "@/lib/auth";
import { adminDb } from "@/lib/firebase/admin";

export async function createTemplate(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const name = String(formData.get("name") || "").trim();
  const title = String(formData.get("title") || "").trim();
  if (!name || !title) return;

  const checklist = formData.getAll("checklist").map(String).map((s) => s.trim()).filter(Boolean);

  await adminDb.collection("TaskTemplate").add({
    name,
    title,
    description: String(formData.get("description") || "") || null,
    kpiTemplateId: String(formData.get("kpiTemplateId") || "") || null,
    roleId: String(formData.get("roleId") || "") || null,
    sizeLabel: String(formData.get("sizeLabel") || "") || null,
    category: String(formData.get("category") || "").trim() || null,
    checklistJSON: checklist.length ? JSON.stringify(checklist) : null,
    createdById: user.id,
    createdAt: new Date(),
  });

  revalidatePath("/templates");
  revalidatePath("/admin");
}

export async function deleteTemplate(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  const id = String(formData.get("id") || "");
  if (!id) return;

  const tDoc = await adminDb.collection("TaskTemplate").doc(id).get();
  if (!tDoc.exists) return;
  const t = tDoc.data()!;
  if (t.createdById !== user.id && !isManagerLike(user.systemRole)) return;

  await adminDb.collection("TaskTemplate").doc(id).delete();
  revalidatePath("/templates");
  revalidatePath("/admin");
}

export async function useTemplate(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in." };
  const templateId = String(formData.get("templateId") || "");
  const assigneeId = String(formData.get("assigneeId") || user.id) || user.id;
  if (!templateId) return { error: "Missing template." };

  const tDoc = await adminDb.collection("TaskTemplate").doc(templateId).get();
  if (!tDoc.exists) return { error: "Template not found." };
  const t = tDoc.data()!;

  const checklist: string[] = t.checklistJSON ? JSON.parse(t.checklistJSON) : [];
  const now = new Date();

  const taskRef = await adminDb.collection("Task").add({
    title: t.title,
    description: t.description ?? null,
    creatorId: user.id,
    assigneeId,
    kpiTemplateId: t.kpiTemplateId ?? null,
    sizeLabel: t.sizeLabel ?? null,
    category: t.category ?? null,
    status: "NEW",
    carryCount: 0,
    reworkCount: 0,
    createdAt: now,
    updatedAt: now,
  });

  if (checklist.length > 0) {
    const batch = adminDb.batch();
    checklist.forEach((text, i) => {
      const itemRef = adminDb.collection("ChecklistItem").doc();
      batch.set(itemRef, { taskId: taskRef.id, text, orderIndex: i, done: false, createdAt: now });
    });
    await batch.commit();
  }

  await adminDb.collection("AuditLog").add({
    actorId: user.id,
    action: "task.fromTemplate",
    entity: "Task",
    entityId: taskRef.id,
    detail: t.name,
    createdAt: now,
  });

  revalidatePath("/board");
  revalidatePath("/templates");
  return { ok: true, id: taskRef.id };
}
