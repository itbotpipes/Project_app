"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { adminDb } from "@/lib/firebase/admin";
import bcrypt from "bcryptjs";
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

async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 10);
}

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !(user.systemRole === "ADMIN" || user.systemRole === "CEO")) return null;
  return user;
}

export async function createEmployee(formData: FormData) {
  const admin = await requireAdmin();
  if (!admin) return { error: "Not authorized" };

  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const roleId = String(formData.get("roleId") || "");
  const reportsToIds = formData.getAll("reportsToIds").map(String).filter(Boolean);
  const reportsToId = reportsToIds[0] || null;
  const systemRole = String(formData.get("systemRole") || "EMPLOYEE");
  const bday = String(formData.get("birthday") || "");
  const password = String(formData.get("password") || "").trim() || "password123";
  if (!name || !email || !roleId) return { error: "Name, email and role are required" };

  const existsSnap = await adminDb.collection("Employee").where("email", "==", email).limit(1).get();
  if (!existsSnap.empty) return { error: "That email already exists" };

  const avatarFile = formData.get("avatarFile") as File | null;
  let avatarUrl: string | null = null;
  if (avatarFile && avatarFile.size > 0) {
    avatarUrl = await uploadAvatarToCloudinary(avatarFile);
  }

  const passwordHash = await hashPassword(password);
  
  await adminDb.collection("Employee").add({
    name,
    email,
    roleId,
    reportsToId,
    reportsToIds,
    systemRole,
    birthday: bday ? new Date(bday) : null,
    passwordHash,
    avatarUrl,
    active: true,
    joinedAt: new Date(),
  });
  
  await adminDb.collection("AuditLog").add({
    actorId: admin.id,
    action: "employee.create",
    entity: "Employee",
    detail: `${name} <${email}>`,
    createdAt: new Date(),
  });

  revalidatePath("/admin");
  revalidatePath("/people");
  return { ok: true };
}

export async function setEmployeeAvatar(formData: FormData) {
  const admin = await requireAdmin();
  if (!admin) return;
  const id = String(formData.get("id") || "");
  const avatarUrl = String(formData.get("avatarUrl") || "").trim() || null;
  if (!id) return;
  
  await adminDb.collection("Employee").doc(id).update({ avatarUrl });
  
  revalidatePath("/admin");
  revalidatePath("/people");
  revalidatePath("/leaderboard");
  revalidatePath("/");
}

export async function setEmployeeActive(formData: FormData) {
  const admin = await requireAdmin();
  if (!admin) return;
  const id = String(formData.get("id") || "");
  const active = formData.get("active") === "true";
  if (!id) return;
  
  await adminDb.collection("Employee").doc(id).update({ active });
  
  await adminDb.collection("AuditLog").add({
    actorId: admin.id,
    action: "employee.active",
    entity: "Employee",
    entityId: id,
    detail: String(active),
    createdAt: new Date(),
  });
  
  revalidatePath("/admin");
}

export async function addKpiTemplate(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authorized" };
  const roleId = String(formData.get("roleId") || "");
  const isAdmin = user.systemRole === "ADMIN" || user.systemRole === "CEO";
  if (!isAdmin && roleId !== user.roleId) {
    return { error: "Not authorized" };
  }
  const kraName = String(formData.get("kraName") || "").trim();
  const kpiName = String(formData.get("kpiName") || "").trim();
  const weightage = Number(formData.get("weightage") || 0);
  const isPrimary = formData.get("isPrimary") === "on";
  if (!roleId || !kraName || !kpiName) return { error: "KRA, KPI and role required" };

  const countSnap = await adminDb.collection("KpiTemplate").where("roleId", "==", roleId).get();
  const count = countSnap.size;
  
  await adminDb.collection("KpiTemplate").add({
    roleId,
    kraName,
    kpiName,
    weightage,
    isPrimary,
    orderIndex: count,
  });
  
  await adminDb.collection("AuditLog").add({
    actorId: user.id,
    action: "kpi.add",
    entity: "KpiTemplate",
    detail: `${kpiName} (${weightage})`,
    createdAt: new Date(),
  });
  
  revalidatePath("/admin");
  revalidatePath("/board");
  return { ok: true };
}

export async function updateKpiWeightage(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  const id = String(formData.get("id") || "");
  const weightage = Number(formData.get("weightage") || 0);
  if (!id) return;
  
  const kpiDoc = await adminDb.collection("KpiTemplate").doc(id).get();
  if (!kpiDoc.exists) return;
  const kpi = kpiDoc.data()!;

  const isAdmin = user.systemRole === "ADMIN" || user.systemRole === "CEO";
  if (!isAdmin && kpi.roleId !== user.roleId) return;

  await adminDb.collection("KpiTemplate").doc(id).update({ weightage });
  
  revalidatePath("/admin");
  revalidatePath("/board");
}

export async function deleteKpiTemplate(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  const id = String(formData.get("id") || "");
  if (!id) return;
  
  const kpiDoc = await adminDb.collection("KpiTemplate").doc(id).get();
  if (!kpiDoc.exists) return;
  const kpi = kpiDoc.data()!;

  const isAdmin = user.systemRole === "ADMIN" || user.systemRole === "CEO";
  if (!isAdmin && kpi.roleId !== user.roleId) return;

  const usedSnap = await adminDb.collection("MonthlyScore").where("kpiTemplateId", "==", id).limit(1).get();
  if (!usedSnap.empty) return;
  
  await adminDb.collection("KpiTemplate").doc(id).delete();
  
  revalidatePath("/admin");
  revalidatePath("/board");
}

export async function createRole(formData: FormData) {
  const admin = await requireAdmin();
  if (!admin) return { error: "Not authorized" };

  const title = String(formData.get("title") || "").trim();
  const level = Number(formData.get("level") || 5);
  const departmentId = String(formData.get("departmentId") || "") || null;
  const permissions = formData.getAll("permissions").map(String);

  if (!title) return { error: "Title is required" };

  await adminDb.collection("Role").add({
    title,
    level,
    departmentId,
    permissions,
    createdAt: new Date(),
  });

  revalidatePath("/admin");
  return { ok: true };
}

export async function updateRolePermissions(formData: FormData) {
  const admin = await requireAdmin();
  if (!admin) return { error: "Not authorized" };

  const roleId = String(formData.get("roleId") || "");
  const permissions = formData.getAll("permissions").map(String);

  if (!roleId) return { error: "Role ID is required" };

  await adminDb.collection("Role").doc(roleId).update({
    permissions,
    updatedAt: new Date(),
  });

  revalidatePath("/admin");
  return { ok: true };
}

export async function updateEmployee(formData: FormData) {
  const admin = await requireAdmin();
  if (!admin) return { error: "Not authorized" };

  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const roleId = String(formData.get("roleId") || "");
  const reportsToIds = formData.getAll("reportsToIds").map(String).filter(Boolean);
  const reportsToId = reportsToIds[0] || null;
  const systemRole = String(formData.get("systemRole") || "EMPLOYEE");
  const bday = String(formData.get("birthday") || "");
  const password = String(formData.get("password") || "");

  if (!id || !name || !email || !roleId) {
    return { error: "ID, name, email and role are required" };
  }

  const updates: any = {
    name,
    email,
    roleId,
    reportsToId,
    reportsToIds,
    systemRole,
    birthday: bday ? new Date(bday) : null,
    updatedAt: new Date()
  };

  const avatarFile = formData.get("avatarFile") as File | null;
  if (avatarFile && avatarFile.size > 0) {
    const avatarUrl = await uploadAvatarToCloudinary(avatarFile);
    if (avatarUrl) {
      updates.avatarUrl = avatarUrl;
    }
  }

  if (password) {
    updates.passwordHash = await hashPassword(password);
  }

  await adminDb.collection("Employee").doc(id).update(updates);

  await adminDb.collection("AuditLog").add({
    actorId: admin.id,
    action: "employee.update",
    entity: "Employee",
    entityId: id,
    detail: `${name} <${email}>`,
    createdAt: new Date(),
  });

  revalidatePath("/admin");
  revalidatePath("/people");
  return { ok: true };
}

export async function createDepartment(formData: FormData) {
  const admin = await requireAdmin();
  if (!admin) return { error: "Not authorized" };

  const name = String(formData.get("name") || "").trim();
  if (!name) return { error: "Department name is required" };

  const existsSnap = await adminDb.collection("Department").where("name", "==", name).limit(1).get();
  if (!existsSnap.empty) return { error: "That department already exists" };

  await adminDb.collection("Department").add({
    name,
    createdAt: new Date(),
  });

  await adminDb.collection("AuditLog").add({
    actorId: admin.id,
    action: "department.create",
    entity: "Department",
    detail: name,
    createdAt: new Date(),
  });

  revalidatePath("/admin");
  return { ok: true };
}

export async function createSystemRole(formData: FormData) {
  const admin = await requireAdmin();
  if (!admin) return { error: "Not authorized" };

  const name = String(formData.get("name") || "").trim();
  const isManager = formData.get("isManager") === "on";
  const isAdmin = formData.get("isAdmin") === "on";

  if (!name) return { error: "System role name is required" };

  const existsSnap = await adminDb.collection("SystemRole").where("name", "==", name).limit(1).get();
  if (!existsSnap.empty) return { error: "That system role already exists" };

  await adminDb.collection("SystemRole").add({
    name,
    isManager,
    isAdmin,
    createdAt: new Date(),
  });

  await adminDb.collection("AuditLog").add({
    actorId: admin.id,
    action: "systemrole.create",
    entity: "SystemRole",
    detail: name,
    createdAt: new Date(),
  });

  revalidatePath("/admin");
  return { ok: true };
}
