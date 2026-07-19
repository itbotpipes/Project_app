"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser, hashPassword } from "@/lib/auth";

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

  const exists = await prisma.employee.findUnique({ where: { email } });
  if (exists) return { error: "That email already exists" };

  await prisma.employee.create({
    data: {
      name,
      email,
      roleId,
      reportsToId,
      systemRole,
      birthday: bday ? new Date(bday) : null,
      passwordHash: await hashPassword(password),
    },
  });
  await prisma.auditLog.create({
    data: { actorId: admin.id, action: "employee.create", entity: "Employee", detail: `${name} <${email}>` },
  });
  revalidatePath("/admin");
  revalidatePath("/people");
  return { ok: true };
}

export async function setEmployeeActive(formData: FormData) {
  const admin = await requireAdmin();
  if (!admin) return;
  const id = String(formData.get("id") || "");
  const active = formData.get("active") === "true";
  if (!id) return;
  await prisma.employee.update({ where: { id }, data: { active } });
  await prisma.auditLog.create({
    data: { actorId: admin.id, action: "employee.active", entity: "Employee", entityId: id, detail: String(active) },
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

  const count = await prisma.kpiTemplate.count({ where: { roleId } });
  await prisma.kpiTemplate.create({
    data: { roleId, kraName, kpiName, weightage, isPrimary, orderIndex: count },
  });
  await prisma.auditLog.create({
    data: { actorId: admin.id, action: "kpi.add", entity: "KpiTemplate", detail: `${kpiName} (${weightage})` },
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
  await prisma.kpiTemplate.update({ where: { id }, data: { weightage } });
  revalidatePath("/admin");
}

export async function deleteKpiTemplate(formData: FormData) {
  const admin = await requireAdmin();
  if (!admin) return;
  const id = String(formData.get("id") || "");
  if (!id) return;
  // guard: don't delete if scores reference it
  const used = await prisma.monthlyScore.count({ where: { kpiTemplateId: id } });
  if (used > 0) return;
  await prisma.kpiTemplate.delete({ where: { id } });
  revalidatePath("/admin");
}
