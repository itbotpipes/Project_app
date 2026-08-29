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
    const bytes = Buffer.from(await file.arrayBuffer());
    
    // Determine dynamic resource_type for Cloudinary to avoid corruption of documents (e.g. PPT, PDF, DOCX)
    const isImage = file.type.startsWith("image/");
    const isAudioVideo = file.type.startsWith("audio/") || file.type.startsWith("video/");
    const resourceType = isImage ? "image" : isAudioVideo ? "video" : "raw";

    // Extract file extension to preserve in Cloudinary publicId (vital for raw documents like PPT, DOCX)
    const lastDot = file.name.lastIndexOf(".");
    const fileExtension = lastDot !== -1 ? file.name.substring(lastDot) : "";
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const publicId = `${uniqueId}${fileExtension}`;

    // Upload to Cloudinary using a promise wrapper
    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { 
          folder: "taskflow_uploads", 
          resource_type: resourceType,
          public_id: publicId
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(bytes);
    }) as any;

    const secureUrl = uploadResult.secure_url;
    const now = new Date();
    const transcript = formData.get("transcript") ? String(formData.get("transcript")) : null;

    // Save attachment to Firestore
    const docRef = await adminDb.collection("Attachment").add({
      taskId,
      kind,
      url: secureUrl,
      filename: file.name || "upload",
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
