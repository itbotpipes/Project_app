"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { adminDb } from "@/lib/firebase/admin";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function markMorningPlanned() {
  const user = await getCurrentUser();
  if (!user) return;
  const date = startOfToday();

  const openSnap = await adminDb.collection("Task")
    .where("assigneeId", "==", user.id)
    .where("status", "!=", "CLOSED")
    .get();
  const plannedTaskIds = JSON.stringify(openSnap.docs.map((d) => d.id));

  const existSnap = await adminDb.collection("DailyRitual")
    .where("employeeId", "==", user.id)
    .where("date", "==", date)
    .limit(1)
    .get();

  if (!existSnap.empty) {
    await adminDb.collection("DailyRitual").doc(existSnap.docs[0].id).update({
      morningPlanned: true,
      plannedTaskIds,
      updatedAt: new Date(),
    });
  } else {
    await adminDb.collection("DailyRitual").add({
      employeeId: user.id,
      date,
      morningPlanned: true,
      eveningClosed: false,
      plannedTaskIds,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
  revalidatePath("/");
}

export async function markEveningClosed() {
  const user = await getCurrentUser();
  if (!user) return;
  const date = startOfToday();

  const existSnap = await adminDb.collection("DailyRitual")
    .where("employeeId", "==", user.id)
    .where("date", "==", date)
    .limit(1)
    .get();

  if (!existSnap.empty) {
    await adminDb.collection("DailyRitual").doc(existSnap.docs[0].id).update({
      eveningClosed: true,
      updatedAt: new Date(),
    });
  } else {
    await adminDb.collection("DailyRitual").add({
      employeeId: user.id,
      date,
      morningPlanned: false,
      eveningClosed: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
  revalidatePath("/");
}
