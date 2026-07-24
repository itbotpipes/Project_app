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
  const remindersSnap = await adminDb.collection("Reminder")
    .where("sent", "==", false)
    .get();
  
  const dueDocs = remindersSnap.docs
    .filter(r => { const d = r.data().remindAt?.toDate?.() ?? null; return d && d <= now; })
    .sort((a, b) => (a.data().remindAt?.toMillis?.() ?? 0) - (b.data().remindAt?.toMillis?.() ?? 0))
    .slice(0, 10);

  const results = await Promise.all(
    dueDocs.map(async (r: any) => {
      const rd = r.data();
      const taskDoc = await adminDb.collection("Task").doc(rd.taskId).get();
      if (!taskDoc.exists) return null;
      const task = taskDoc.data()!;
      if (task.assigneeId !== user.id) return null;
      return {
        id: r.id,
        taskId: rd.taskId,
        title: task.title,
        remindAt: toDate(rd.remindAt),
      };
    })
  );

  return NextResponse.json({
    reminders: results.filter(Boolean),
  });
}
