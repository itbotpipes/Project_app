"use server";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUser, isManagerLike, hasPermission } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export type TargetType = "NUMERIC" | "MILESTONE";
export type TargetPeriod = "week" | "month" | "quarter" | "custom";
export type TargetStatus = "ACTIVE" | "COMPLETED" | "UNDER_REVIEW" | "REVIEWED" | "CANCELLED";

export interface TargetData {
  id?: string;
  title: string;
  description?: string;
  employeeId: string;
  assignedById: string;
  assignedByName?: string;
  periodType: TargetPeriod;
  startDate: Date;
  endDate: Date;
  targetType: TargetType;
  metricUnit?: string;
  targetValue?: number;
  currentValue?: number;
  weightagePct: number;
  achievedPct: number;
  status: TargetStatus;
  managerScore?: number | null;
  managerFeedback?: string | null;
  reviewedAt?: Date | null;
  reviewedById?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

// Convert Firestore timestamps or strings to Date
function toDate(val: any): Date {
  if (!val) return new Date();
  if (val.toDate && typeof val.toDate === "function") return val.toDate();
  const d = new Date(val);
  return isNaN(d.getTime()) ? new Date() : d;
}

/**
 * Fetch targets for an employee within a given date range or active period.
 */
export async function getEmployeeTargets(employeeId: string, fromDate?: Date, toDateLimit?: Date) {
  let query: any = adminDb.collection("Target").where("employeeId", "==", employeeId);

  const snap = await query.get();
  if (snap.empty) return [];

  const list: any[] = snap.docs.map((d: any) => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      startDate: toDate(data.startDate).toISOString(),
      endDate: toDate(data.endDate).toISOString(),
      createdAt: data.createdAt ? toDate(data.createdAt).toISOString() : null,
      reviewedAt: data.reviewedAt ? toDate(data.reviewedAt).toISOString() : null,
    };
  });

  // Sort descending by startDate
  list.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

  if (!fromDate && !toDateLimit) return list;

  return list.filter((t) => {
    const s = new Date(t.startDate).getTime();
    const e = new Date(t.endDate).getTime();
    if (fromDate && e < fromDate.getTime()) return false;
    if (toDateLimit && s > toDateLimit.getTime()) return false;
    return true;
  });
}

/**
 * Assign a new target to an employee (Manager / Authority only)
 */
export async function createTarget(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const canManage = isManagerLike(user.systemRole) || hasPermission(user, "scores") || hasPermission(user, "team");
  if (!canManage) return { error: "Only managers and authorities can assign targets" };

  const employeeId = String(formData.get("employeeId") || "").trim();
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const periodType = (formData.get("periodType") || "month") as TargetPeriod;
  const targetType = (formData.get("targetType") || "NUMERIC") as TargetType;
  const metricUnit = String(formData.get("metricUnit") || "").trim() || (targetType === "NUMERIC" ? "Units" : "");
  const targetValue = targetType === "NUMERIC" ? Math.max(0.1, Number(formData.get("targetValue")) || 1) : 1;
  const weightagePct = Math.max(1, Math.min(100, Number(formData.get("weightagePct")) || 20));

  const startDateStr = String(formData.get("startDate") || "");
  const endDateStr = String(formData.get("endDate") || "");

  if (!employeeId || !title) return { error: "Employee and Title are required" };
  if (!startDateStr || !endDateStr) return { error: "Start date and End date are required" };

  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);
  endDate.setHours(23, 59, 59, 999);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return { error: "Invalid date format provided" };
  }

  const docRef = await adminDb.collection("Target").add({
    title,
    description: description || null,
    employeeId,
    assignedById: user.id,
    assignedByName: user.name || "Manager",
    periodType,
    startDate,
    endDate,
    targetType,
    metricUnit,
    targetValue,
    currentValue: 0,
    weightagePct,
    achievedPct: 0,
    status: "ACTIVE",
    managerScore: null,
    managerFeedback: null,
    reviewedAt: null,
    reviewedById: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await adminDb.collection("AuditLog").add({
    actorId: user.id,
    action: "target.create",
    entity: "Target",
    entityId: docRef.id,
    detail: `Target "${title}" assigned to employee by ${user.name}`,
    createdAt: new Date(),
  });

  revalidatePath("/performance");
  revalidatePath("/scores");
  revalidatePath("/people");
  return { ok: true, id: docRef.id };
}

/**
 * Log employee progress or self-update on a target
 */
export async function updateTargetProgress(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const targetId = String(formData.get("targetId") || "").trim();
  const currentValue = Math.max(0, Number(formData.get("currentValue")) || 0);
  const submitForReview = formData.get("submitForReview") === "true";

  if (!targetId) return { error: "Target ID required" };

  const doc = await adminDb.collection("Target").doc(targetId).get();
  if (!doc.exists) return { error: "Target not found" };

  const data = doc.data() as any;
  const isOwner = data.employeeId === user.id;
  const isManager = isManagerLike(user.systemRole) || user.id === data.assignedById;

  if (!isOwner && !isManager) return { error: "Not authorized to update this target" };

  const targetVal = Number(data.targetValue) || 1;
  const achievedPct = data.targetType === "NUMERIC" 
    ? Math.min(100, Math.round((currentValue / targetVal) * 100))
    : data.achievedPct;

  let newStatus = data.status;
  if (submitForReview) {
    newStatus = "UNDER_REVIEW";
  } else if (achievedPct >= 100 && data.status === "ACTIVE") {
    newStatus = "COMPLETED";
  }

  await adminDb.collection("Target").doc(targetId).update({
    currentValue,
    achievedPct,
    status: newStatus,
    updatedAt: new Date(),
  });

  revalidatePath("/performance");
  revalidatePath("/scores");
  return { ok: true };
}

/**
 * Manager review and score a target
 */
export async function reviewTarget(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const canReview = isManagerLike(user.systemRole) || hasPermission(user, "scores") || hasPermission(user, "team");
  if (!canReview) return { error: "Not authorized to review targets" };

  const targetId = String(formData.get("targetId") || "").trim();
  const managerScore = Math.max(0, Math.min(100, Number(formData.get("managerScore")) || 0));
  const managerFeedback = String(formData.get("managerFeedback") || "").trim();
  const status = (formData.get("status") || "REVIEWED") as TargetStatus;

  if (!targetId) return { error: "Target ID required" };

  const doc = await adminDb.collection("Target").doc(targetId).get();
  if (!doc.exists) return { error: "Target not found" };

  await adminDb.collection("Target").doc(targetId).update({
    managerScore,
    managerFeedback: managerFeedback || null,
    status,
    reviewedAt: new Date(),
    reviewedById: user.id,
    updatedAt: new Date(),
  });

  await adminDb.collection("AuditLog").add({
    actorId: user.id,
    action: "target.review",
    entity: "Target",
    entityId: targetId,
    detail: `Target reviewed with score ${managerScore}% by ${user.name}`,
    createdAt: new Date(),
  });

  revalidatePath("/performance");
  revalidatePath("/scores");
  return { ok: true };
}

/**
 * Delete / cancel a target (Reversible / Cleanable)
 */
export async function deleteTarget(targetId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const canDelete = isManagerLike(user.systemRole) || hasPermission(user, "scores");
  if (!canDelete) return { error: "Not authorized to delete targets" };

  await adminDb.collection("Target").doc(targetId).delete();

  await adminDb.collection("AuditLog").add({
    actorId: user.id,
    action: "target.delete",
    entity: "Target",
    entityId: targetId,
    detail: `Target deleted by ${user.name}`,
    createdAt: new Date(),
  });

  revalidatePath("/performance");
  revalidatePath("/scores");
  return { ok: true };
}
