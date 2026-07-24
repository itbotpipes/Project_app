"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { adminDb } from "@/lib/firebase/admin";
import bcrypt from "bcryptjs";

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
  const reportsToId = String(formData.get("reportsToId") || "") || null;
  const systemRole = String(formData.get("systemRole") || "EMPLOYEE");
  const bday = String(formData.get("birthday") || "");
  const password = String(formData.get("password") || "password123");
  if (!name || !email || !roleId) return { error: "Name, email and role are required" };

  const existsSnap = await adminDb.collection("Employee").where("email", "==", email).limit(1).get();
  if (!existsSnap.empty) return { error: "That email already exists" };

  const passwordHash = await hashPassword(password);
  
  await adminDb.collection("Employee").add({
    name,
    email,
    roleId,
    reportsToId,
    systemRole,
    birthday: bday ? new Date(bday) : null,
    passwordHash,
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
  const admin = await requireAdmin();
  if (!admin) return { error: "Not authorized" };
  const roleId = String(formData.get("roleId") || "");
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
    actorId: admin.id,
    action: "kpi.add",
    entity: "KpiTemplate",
    detail: `${kpiName} (${weightage})`,
    createdAt: new Date(),
  });
  
  revalidatePath("/admin");
  return { ok: true };
}

export async function updateKpiWeightage(formData: FormData) {
  const admin = await requireAdmin();
  if (!admin) return;
  const id = String(formData.get("id") || "");
  const weightage = Number(formData.get("weightage") || 0);
  if (!id) return;
  
  await adminDb.collection("KpiTemplate").doc(id).update({ weightage });
  
  revalidatePath("/admin");
}

export async function deleteKpiTemplate(formData: FormData) {
  const admin = await requireAdmin();
  if (!admin) return;
  const id = String(formData.get("id") || "");
  if (!id) return;
  
  const usedSnap = await adminDb.collection("MonthlyScore").where("kpiTemplateId", "==", id).limit(1).get();
  if (!usedSnap.empty) return;
  
  await adminDb.collection("KpiTemplate").doc(id).delete();
  
  revalidatePath("/admin");
}
