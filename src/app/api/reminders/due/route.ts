import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { adminDb } from "@/lib/firebase/admin";

function toDate(val: any): Date | null {
  if (!val) return null;
  if (val.toDate) return val.toDate();
  return new Date(val);
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ reminders: [] }, { status: 401 });

  const now = new Date();

  let remindersSnap;
  try {
    remindersSnap = await adminDb.collection("Reminder")
      .where("employeeId", "==", user.id)
      .where("sent", "==", false)
      .where("remindAt", "<=", now)
      .orderBy("remindAt", "asc")
      .limit(10)
      .get();
  } catch (err: any) {
    console.error("[reminders-due] Failed to fetch reminders:", err);
    return NextResponse.json({ error: "Failed to fetch reminders (e.g. index building)", details: err.message }, { status: 500 });
  }

  if (remindersSnap.empty) {
    return NextResponse.json({ reminders: [] });
  }

  // taskTitle is denormalized onto the Reminder document.
  // For legacy docs that don't have it yet, batch-fetch in parallel (not sequentially).
  const docsNeedingTitle = remindersSnap.docs.filter(r => !r.data().taskTitle);
  let taskTitles = new Map<string, string>();

  if (docsNeedingTitle.length > 0) {
    const taskDocs = await Promise.all(
      docsNeedingTitle.map(r => adminDb.collection("Task").doc(r.data().taskId).get())
    );
    taskDocs.forEach(td => {
      if (td.exists) taskTitles.set(td.id, td.data()!.title);
    });
  }

  const reminders = remindersSnap.docs.map(r => {
    const rd = r.data();
    const title = rd.taskTitle ?? taskTitles.get(rd.taskId) ?? "Task";
    return {
      id: r.id,
      taskId: rd.taskId,
      title,
      remindAt: toDate(rd.remindAt)?.toISOString() ?? null,
    };
  });

  return NextResponse.json({ reminders });
}
