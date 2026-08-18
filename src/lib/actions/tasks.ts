"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, isManagerLike } from "@/lib/auth";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

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
  const category = String(formData.get("category") || "").trim() || null;
  const groupId = String(formData.get("groupId") || "") || null;
  const checklist = formData.getAll("checklist").map(String).map((s) => s.trim()).filter(Boolean);
  const watcherIds = formData.getAll("watcherIds").map(String).filter(Boolean);

  let groupMemberIds: string[] = [];
  if (groupId) {
    const membersSnap = await adminDb.collection("GroupMember").where("groupId", "==", groupId).get();
    groupMemberIds = membersSnap.docs ? membersSnap.docs.map((doc: any) => doc.data().employeeId) : [];
  }
  
  const allWatcherIds = Array.from(new Set([...watcherIds, ...groupMemberIds])).filter((id) => id !== assigneeId);
  const now = new Date();

  // Create task in Firestore
  const taskRef = await adminDb.collection("Task").add({
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
    category,
    groupId,
    carryCount: 0,
    reworkCount: 0,
    deletedAt: null,   // must be explicit null for Firestore equality queries
    createdAt: now,
    updatedAt: now,
  });

  // Create checklist items
  if (checklist.length > 0) {
    const batch = adminDb.batch();
    checklist.forEach((text, i) => {
      const itemRef = adminDb.collection("ChecklistItem").doc();
      batch.set(itemRef, {
        taskId: taskRef.id,
        text,
        orderIndex: i,
        done: false,
        createdAt: now,
      });
    });
    await batch.commit();
  }

  // Create watchers
  if (allWatcherIds.length > 0) {
    const batch = adminDb.batch();
    allWatcherIds.forEach((employeeId) => {
      const watcherRef = adminDb.collection("TaskWatcher").doc();
      batch.set(watcherRef, {
        taskId: taskRef.id,
        employeeId,
        notified: false,
        createdAt: now,
      });
    });
    await batch.commit();
  }

  await adminDb.collection("AuditLog").add({
    actorId: user.id,
    action: "task.create",
    entity: "Task",
    entityId: taskRef.id,
    detail: title,
    createdAt: now,
  });

  revalidatePath("/board");
  revalidatePath("/team");
  revalidatePath("/delegated");
  if (groupId) revalidatePath(`/groups/${groupId}`);
  return { ok: true, id: taskRef.id };
}

export async function updateTask(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in." };

  const taskId = String(formData.get("taskId") || "");
  const title = String(formData.get("title") || "").trim();
  if (!taskId || !title) return { error: "Title is required." };

  const taskDoc = await adminDb.collection("Task").doc(taskId).get();
  if (!taskDoc.exists) return { error: "Task not found." };
  const task = taskDoc.data()!;
  
  const allowed = task.creatorId === user.id || task.assigneeId === user.id || isManagerLike(user.systemRole);
  if (!allowed) return { error: "Not allowed to edit this task." };

  const kpiTemplateId = String(formData.get("kpiTemplateId") || "") || null;
  const sizeLabel = String(formData.get("sizeLabel") || "") || null;
  const category = String(formData.get("category") || "").trim() || null;
  const dueRaw = String(formData.get("dueAt") || "");
  const dueAt = dueRaw ? new Date(dueRaw) : null;
  const urgent = formData.get("urgent") === "on";
  const important = formData.get("important") === "on";

  await adminDb.collection("Task").doc(taskId).update({
    title,
    description: String(formData.get("description") || "") || null,
    kpiTemplateId,
    sizeLabel,
    category,
    dueAt,
    urgent,
    important,
    updatedAt: new Date(),
  });

  await adminDb.collection("AuditLog").add({
    actorId: user.id,
    action: "task.edit",
    entity: "Task",
    entityId: taskId,
    detail: title,
    createdAt: new Date(),
  });

  revalidatePath("/board");
  revalidatePath("/delegated");
  revalidatePath(`/task/${taskId}`);
  return { ok: true };
}

export async function moveTask(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in." };

  const taskId = String(formData.get("taskId") || "");
  const status = String(formData.get("status") || "");
  const holdReason = String(formData.get("holdReason") || "") || null;
  const rejectionReason = String(formData.get("rejectionReason") || "") || null;
  if (!taskId || !status) return { error: "Missing fields." };

  if (status === "CLOSED") {
    const checklistSnap = await adminDb.collection("ChecklistItem").where("taskId", "==", taskId).get();
    const total = checklistSnap.size;
    const doneCount = checklistSnap.docs.filter(doc => doc.data().done).length;
    if (total > 0 && doneCount < total) {
      return { error: `Finish the checklist first — ${doneCount}/${total} items ticked.` };
    }
  }

  if (status === "REOPENED" && !rejectionReason) {
    return { error: "A reason is required when sending a task back for rework." };
  }

  const data: Record<string, any> = { status, updatedAt: new Date() };
  if (status === "ON_HOLD") data.holdReason = holdReason;
  if (status === "CLOSED") data.completedAt = new Date();
  if (status !== "ON_HOLD") data.holdReason = null;
  if (status === "REOPENED") {
    data.rejectionReason = rejectionReason;
    data.rejectedAt = new Date();
    data.reworkCount = FieldValue.increment(1);
  }

  await adminDb.collection("Task").doc(taskId).update(data);
  
  await adminDb.collection("AuditLog").add({
    actorId: user.id,
    action: status === "REOPENED" ? "task.reject" : "task.move",
    entity: "Task",
    entityId: taskId,
    detail: status === "REOPENED" ? rejectionReason ?? "" : status + (holdReason ? ` (${holdReason})` : ""),
    createdAt: new Date(),
  });

  revalidatePath("/board");
  revalidatePath("/team");
  revalidatePath("/delegated");
  revalidatePath("/");
  revalidatePath(`/task/${taskId}`);
  return { ok: true };
}

export async function softDeleteTask(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  const taskId = String(formData.get("taskId") || "");
  if (!taskId) return;
  
  const taskDoc = await adminDb.collection("Task").doc(taskId).get();
  if (!taskDoc.exists) return;
  const task = taskDoc.data()!;

  const allowed = task.creatorId === user.id || task.assigneeId === user.id || isManagerLike(user.systemRole);
  if (!allowed) return;

  await adminDb.collection("Task").doc(taskId).update({ deletedAt: new Date(), updatedAt: new Date() });
  
  await adminDb.collection("AuditLog").add({
    actorId: user.id,
    action: "task.delete",
    entity: "Task",
    entityId: taskId,
    detail: task.title,
    createdAt: new Date(),
  });

  revalidatePath("/board");
  revalidatePath("/deleted");
  revalidatePath("/delegated");
  revalidatePath(`/task/${taskId}`);
  if (task.groupId) revalidatePath(`/groups/${task.groupId}`);
}

export async function restoreTask(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  const taskId = String(formData.get("taskId") || "");
  if (!taskId) return;
  
  const taskDoc = await adminDb.collection("Task").doc(taskId).get();
  if (!taskDoc.exists) return;
  const task = taskDoc.data()!;

  const allowed = task.creatorId === user.id || task.assigneeId === user.id || isManagerLike(user.systemRole);
  if (!allowed) return;

  await adminDb.collection("Task").doc(taskId).update({ deletedAt: null, updatedAt: new Date() });
  
  await adminDb.collection("AuditLog").add({
    actorId: user.id,
    action: "task.restore",
    entity: "Task",
    entityId: taskId,
    detail: task.title,
    createdAt: new Date(),
  });

  revalidatePath("/board");
  revalidatePath("/deleted");
  revalidatePath("/delegated");
}

export async function toggleWatch(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  const taskId = String(formData.get("taskId") || "");
  if (!taskId) return;

  const existingSnap = await adminDb.collection("TaskWatcher")
    .where("taskId", "==", taskId)
    .where("employeeId", "==", user.id)
    .limit(1)
    .get();

  if (!existingSnap.empty) {
    await adminDb.collection("TaskWatcher").doc(existingSnap.docs[0].id).delete();
  } else {
    await adminDb.collection("TaskWatcher").add({
      taskId,
      employeeId: user.id,
      notified: true,
      createdAt: new Date(),
    });
  }
  
  revalidatePath(`/task/${taskId}`);
  revalidatePath("/subscribed");
}

export async function dismissWatcherNotification(formData: FormData) {
  const id = String(formData.get("id") || "");
  if (!id) return;
  await adminDb.collection("TaskWatcher").doc(id).update({ notified: true });
}
