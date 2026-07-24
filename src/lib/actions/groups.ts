"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, isManagerLike } from "@/lib/auth";
import { adminDb } from "@/lib/firebase/admin";

export async function createGroup(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  if (!isManagerLike(user.systemRole)) return;

  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  const description = String(formData.get("description") || "") || null;
  const departmentId = String(formData.get("departmentId") || "") || null;
  const memberIds = formData.getAll("memberIds").map(String).filter(Boolean);

  const groupRef = await adminDb.collection("Group").add({
    name,
    description,
    departmentId,
    createdById: user.id,
    createdAt: new Date(),
  });

  const batch = adminDb.batch();
  // Add creator as ADMIN
  const creatorRef = adminDb.collection("GroupMember").doc();
  batch.set(creatorRef, { groupId: groupRef.id, employeeId: user.id, role: "ADMIN", joinedAt: new Date() });
  // Add other members
  for (const id of memberIds.filter((id) => id !== user.id)) {
    const memberRef = adminDb.collection("GroupMember").doc();
    batch.set(memberRef, { groupId: groupRef.id, employeeId: id, role: "MEMBER", joinedAt: new Date() });
  }
  await batch.commit();

  await adminDb.collection("AuditLog").add({
    actorId: user.id,
    action: "group.create",
    entity: "Group",
    entityId: groupRef.id,
    detail: name,
    createdAt: new Date(),
  });
  revalidatePath("/groups");
}

async function isGroupAdmin(groupId: string, employeeId: string, systemRole: string) {
  if (systemRole === "ADMIN" || systemRole === "CEO") return true;
  const snap = await adminDb.collection("GroupMember")
    .where("groupId", "==", groupId)
    .where("employeeId", "==", employeeId)
    .limit(1)
    .get();
  return !snap.empty && snap.docs[0].data().role === "ADMIN";
}

export async function addGroupMember(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  const groupId = String(formData.get("groupId") || "");
  const employeeId = String(formData.get("employeeId") || "");
  if (!groupId || !employeeId) return;
  if (!(await isGroupAdmin(groupId, user.id, user.systemRole))) return;

  const existSnap = await adminDb.collection("GroupMember")
    .where("groupId", "==", groupId)
    .where("employeeId", "==", employeeId)
    .limit(1)
    .get();

  if (existSnap.empty) {
    await adminDb.collection("GroupMember").add({ groupId, employeeId, role: "MEMBER", joinedAt: new Date() });
  }
  revalidatePath(`/groups/${groupId}`);
}

export async function removeGroupMember(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  const groupId = String(formData.get("groupId") || "");
  const employeeId = String(formData.get("employeeId") || "");
  if (!groupId || !employeeId) return;
  if (!(await isGroupAdmin(groupId, user.id, user.systemRole))) return;

  const snap = await adminDb.collection("GroupMember")
    .where("groupId", "==", groupId)
    .where("employeeId", "==", employeeId)
    .get();
  const batch = adminDb.batch();
  snap.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
  revalidatePath(`/groups/${groupId}`);
}

export async function reassignGroupTask(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in." };
  const taskId = String(formData.get("taskId") || "");
  const newAssigneeId = String(formData.get("assigneeId") || "");
  if (!taskId || !newAssigneeId) return { error: "Missing fields." };

  const taskDoc = await adminDb.collection("Task").doc(taskId).get();
  if (!taskDoc.exists) return { error: "This task isn't in a group." };
  const task = taskDoc.data()!;
  if (!task.groupId) return { error: "This task isn't in a group." };

  const [actorSnap, targetSnap] = await Promise.all([
    adminDb.collection("GroupMember").where("groupId", "==", task.groupId).where("employeeId", "==", user.id).limit(1).get(),
    adminDb.collection("GroupMember").where("groupId", "==", task.groupId).where("employeeId", "==", newAssigneeId).limit(1).get(),
  ]);

  if (actorSnap.empty && !isManagerLike(user.systemRole)) return { error: "Only group members can exchange this task." };
  if (targetSnap.empty) return { error: "That person isn't in this group." };

  await adminDb.collection("Task").doc(taskId).update({ assigneeId: newAssigneeId, updatedAt: new Date() });
  await adminDb.collection("AuditLog").add({
    actorId: user.id,
    action: "task.exchange",
    entity: "Task",
    entityId: taskId,
    detail: `reassigned to ${newAssigneeId} within group ${task.groupId}`,
    createdAt: new Date(),
  });
  revalidatePath(`/groups/${task.groupId}`);
  revalidatePath("/board");
  return { ok: true };
}
