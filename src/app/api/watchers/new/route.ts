import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { adminDb } from "@/lib/firebase/admin";

// New "In Loop" watcher rows for the current user that haven't popped a
// notification yet. Marking `notified` happens client-side on dismiss (same
// pattern as /api/reminders/due), so the toast can keep showing until seen.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ watchers: [] }, { status: 401 });

  const watchersSnap = await adminDb.collection("TaskWatcher")
    .where("employeeId", "==", user.id)
    .where("notified", "==", false)
    .get();

  const sortedDocs = watchersSnap.docs
    .sort((a, b) => (b.data().createdAt?.toMillis?.() ?? 0) - (a.data().createdAt?.toMillis?.() ?? 0))
    .slice(0, 10);

  const results = await Promise.all(
    sortedDocs.map(async (w: any) => {
      const wd = w.data();
      const taskDoc = await adminDb.collection("Task").doc(wd.taskId).get();
      if (!taskDoc.exists || taskDoc.data()!.deletedAt) return null;
      return {
        id: w.id,
        taskId: wd.taskId,
        title: taskDoc.data()!.title,
      };
    })
  );

  return NextResponse.json({
    watchers: results.filter(Boolean),
  });
}
