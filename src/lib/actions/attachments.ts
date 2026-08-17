"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { adminDb } from "@/lib/firebase/admin";
import { v2 as cloudinary } from "cloudinary";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function addComment(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  const taskId = String(formData.get("taskId") || "");
  const body = String(formData.get("body") || "").trim();
  if (!taskId || !body) return;
  
  const now = new Date();
  
  // Save comment to Firestore
  await adminDb.collection("TaskComment").add({
    taskId,
    authorId: user.id,
    body,
    createdAt: now,
  });
  
  // Save audit log to Firestore
  await adminDb.collection("AuditLog").add({
    actorId: user.id,
    action: "task.comment",
    entity: "Task",
    entityId: taskId,
    createdAt: now,
  });
  
  revalidatePath(`/task/${taskId}`);
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
    const bytes = Buffer.from(await file.arrayBuffer());
    
    // Upload to Cloudinary using a promise wrapper
    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: "taskflow_uploads", resource_type: "auto" },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(bytes);
    }) as any;

    const secureUrl = uploadResult.secure_url;
    const now = new Date();

    // Save attachment to Firestore
    await adminDb.collection("Attachment").add({
      taskId,
      kind,
      url: secureUrl,
      filename: file.name || "upload",
      createdAt: now,
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
    return { ok: true };
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    return { error: "Upload failed" };
  }
}
