"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { adminDb } from "@/lib/firebase/admin";
import { sendNotification } from "@/lib/notificationService";
import { uploadFileBufferToCloudinary } from "@/lib/cloudinaryService";

export async function addComment(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  const taskId = String(formData.get("taskId") || "");
  const body = String(formData.get("body") || "").trim();
  const parentId = String(formData.get("parentId") || "").trim() || null;
  if (!taskId || !body) return;
  
  const now = new Date();
  
  // Save comment to Firestore
  const docRef = await adminDb.collection("TaskComment").add({
    taskId,
    authorId: user.id,
    body,
    createdAt: now,
    parentId,
  });
  
  // Save audit log to Firestore
  await adminDb.collection("AuditLog").add({
    actorId: user.id,
    action: parentId ? "task.reply" : "task.comment",
    entity: "Task",
    entityId: taskId,
    createdAt: now,
  });

  const authorDoc = await adminDb.collection("Employee").doc(user.id).get();
  const authorData = authorDoc.exists ? authorDoc.data() : null;
  const authorName = authorData?.name ?? user.name ?? "Colleague";

  // Notify task assignee and creator about new comment
  try {
    const taskDoc = await adminDb.collection("Task").doc(taskId).get();
    if (taskDoc.exists) {
      const taskData = taskDoc.data()!;
      const snippet = body.length > 70 ? `${body.slice(0, 70)}...` : body;

      if (taskData.assigneeId && taskData.assigneeId !== user.id) {
        await sendNotification({
          recipientId: taskData.assigneeId,
          actorId: user.id,
          actorName: authorName,
          taskId,
          taskTitle: taskData.title || "Task",
          type: "TASK_COMMENT",
          title: "New Comment",
          message: `${authorName}: "${snippet}"`,
          href: `/task/${taskId}`,
        });
      }

      if (
        taskData.creatorId &&
        taskData.creatorId !== user.id &&
        taskData.creatorId !== taskData.assigneeId
      ) {
        await sendNotification({
          recipientId: taskData.creatorId,
          actorId: user.id,
          actorName: authorName,
          taskId,
          taskTitle: taskData.title || "Task",
          type: "TASK_COMMENT",
          title: "New Comment",
          message: `${authorName}: "${snippet}"`,
          href: `/task/${taskId}`,
        });
      }
    }
  } catch (err) {
    console.error("[addComment] Notification dispatch error:", err);
  }

  revalidatePath(`/task/${taskId}`);
  return {
    ok: true,
    comment: {
      id: docRef.id,
      body,
      createdAt: now.toISOString(),
      parentId,
      author: {
        name: authorData?.name ?? user.name ?? "",
        avatarUrl: authorData?.avatarUrl ?? null
      }
    }
  };
}

export async function createReminder(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in" };
  const taskId = String(formData.get("taskId") || "");
  const remindAtRaw = String(formData.get("remindAt") || "");
  if (!taskId || !remindAtRaw) return { error: "Pick a date & time" };

  // Fetch the task once to denormalize employeeId + taskTitle onto the Reminder.
  // This avoids org-wide reminder scans and N+1 task lookups in the poller.
  const taskDoc = await adminDb.collection("Task").doc(taskId).get();
  if (!taskDoc.exists) return { error: "Task not found" };
  const task = taskDoc.data()!;

  const now = new Date();

  await adminDb.collection("Reminder").add({
    taskId,
    // Denormalized fields for efficient user-scoped querying
    employeeId: task.assigneeId,
    taskTitle: task.title,
    remindAt: new Date(remindAtRaw),
    sent: false,
    createdAt: now,
  });

  await adminDb.collection("AuditLog").add({
    actorId: user.id,
    action: "task.remind",
    entity: "Task",
    entityId: taskId,
    createdAt: now,
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
  
  await adminDb.collection("Reminder").doc(id).update({
    sent: true,
  });
  
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

  try {
    const uploaded = await uploadFileBufferToCloudinary(file);
    const secureUrl = uploaded.secureUrl;
    const now = new Date();
    const transcript = formData.get("transcript") ? String(formData.get("transcript")) : null;

    // Save attachment to Firestore
    const docRef = await adminDb.collection("Attachment").add({
      taskId,
      kind: uploaded.kind,
      url: secureUrl,
      filename: uploaded.filename,
      createdAt: now,
      transcript: transcript || null,
    });
    
    await adminDb.collection("AuditLog").add({
      actorId: user.id,
      action: "task.attach",
      entity: "Task",
      entityId: taskId,
      detail: kind,
      createdAt: now,
    });
    
    revalidatePath(`/task/${taskId}`);
    return { 
      ok: true,
      attachment: {
        id: docRef.id,
        kind,
        url: secureUrl,
        filename: file.name || "upload",
        transcript: transcript || null
      }
    };
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    return { error: "Upload failed" };
  }
}

export async function deleteTaskAttachment(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in" };
  const id = String(formData.get("id") || "");
  const taskId = String(formData.get("taskId") || "");
  if (!id || !taskId) return { error: "Missing fields" };

  const attachmentDoc = await adminDb.collection("Attachment").doc(id).get();
  if (!attachmentDoc.exists) return { error: "Attachment not found" };

  // Delete attachment from Firestore
  await adminDb.collection("Attachment").doc(id).delete();

  // Log audit trail
  await adminDb.collection("AuditLog").add({
    actorId: user.id,
    action: "task.detach",
    entity: "Task",
    entityId: taskId,
    detail: attachmentDoc.data()!.filename,
    createdAt: new Date(),
  });

  revalidatePath(`/task/${taskId}`);
  return { ok: true };
}
