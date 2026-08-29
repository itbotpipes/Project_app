"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { adminDb } from "@/lib/firebase/admin";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function uploadAvatarToCloudinary(file: File): Promise<string | null> {
  if (!file || file.size === 0) return null;
  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { 
          folder: "taskflow_avatars", 
          resource_type: "image",
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(bytes);
    }) as any;
    return uploadResult.secure_url;
  } catch (err) {
    console.error("Avatar upload failed:", err);
    return null;
  }
}

export async function updateProfile(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authorized" };

  const name = String(formData.get("name") || "").trim();
  const birthdayVal = String(formData.get("birthday") || "");

  if (!name) return { error: "Name is required" };

  const updates: any = {
    name,
    birthday: birthdayVal ? new Date(birthdayVal) : null,
    updatedAt: new Date(),
  };

  const avatarFile = formData.get("avatarFile") as File | null;
  if (avatarFile && avatarFile.size > 0) {
    const avatarUrl = await uploadAvatarToCloudinary(avatarFile);
    if (avatarUrl) {
      updates.avatarUrl = avatarUrl;
    }
  }

  try {
    await adminDb.collection("Employee").doc(user.id).update(updates);

    await adminDb.collection("AuditLog").add({
      actorId: user.id,
      action: "employee.profile_update",
      entity: "Employee",
      entityId: user.id,
      detail: `${name} updated their profile`,
      createdAt: new Date(),
    });

    revalidatePath("/");
    revalidatePath("/profile");
    revalidatePath("/people");
    revalidatePath("/leaderboard");
    
    return { ok: true };
  } catch (error: any) {
    return { error: error.message || "Failed to update profile" };
  }
}
