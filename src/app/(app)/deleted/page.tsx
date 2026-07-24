import { getCurrentUser, isManagerLike } from "@/lib/auth";
import { adminDb } from "@/lib/firebase/admin";
import { Card, SectionTitle } from "../_components/ui";
import RestoreButton from "./RestoreButton";

function toDate(val: any): Date | null {
  if (!val) return null;
  if (val.toDate) return val.toDate();
  return new Date(val);
}

export default async function DeletedTasksPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  // Firestore doesn't support OR on different fields with complex where — fetch by manager vs employee
  let tasksSnap;
  if (isManagerLike(user.systemRole)) {
    tasksSnap = await adminDb.collection("Task").where("deletedAt", "!=", null).get();
    tasksSnap.docs.sort((a, b) => (b.data().deletedAt?.toMillis?.() ?? 0) - (a.data().deletedAt?.toMillis?.() ?? 0));
  } else {
    const [creatorSnap, assigneeSnap] = await Promise.all([
      adminDb.collection("Task").where("creatorId", "==", user.id).where("deletedAt", "!=", null).get(),
      adminDb.collection("Task").where("assigneeId", "==", user.id).where("deletedAt", "!=", null).get(),
    ]);
    const seen = new Set<string>();
    const combined = [...creatorSnap.docs, ...assigneeSnap.docs].filter((d) => {
      if (seen.has(d.id)) return false;
      seen.add(d.id);
      return true;
    });
    // Sort by deletedAt desc
    combined.sort((a, b) => {
      const da = toDate(a.data().deletedAt)?.getTime() ?? 0;
      const db = toDate(b.data().deletedAt)?.getTime() ?? 0;
      return db - da;
    });
    tasksSnap = { docs: combined };
  }

  const tasks = await Promise.all(
    tasksSnap.docs.map(async (doc) => {
      const t = doc.data() as any;
      const [assigneeDoc, creatorDoc] = await Promise.all([
        t.assigneeId ? adminDb.collection("Employee").doc(t.assigneeId).get() : Promise.resolve(null),
        t.creatorId ? adminDb.collection("Employee").doc(t.creatorId).get() : Promise.resolve(null),
      ]);
      return {
        id: doc.id,
        title: t.title,
        deletedAt: toDate(t.deletedAt),
        assignee: { name: assigneeDoc?.exists ? assigneeDoc.data()!.name : "Unknown" },
        creator: { name: creatorDoc?.exists ? creatorDoc.data()!.name : "Unknown" },
      };
    })
  );

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Deleted Tasks</h1>
        <p className="text-sm text-slate-500">
          Nothing is ever permanently erased — restore any of these back to the active board.
        </p>
      </div>

      <Card>
        <SectionTitle>{tasks.length} in trash</SectionTitle>
        {tasks.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">Trash is empty.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {tasks.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-slate-500 line-through">{t.title}</div>
                  <div className="text-xs text-slate-400">
                    {t.assignee.name} · created by {t.creator.name} · deleted {t.deletedAt ? t.deletedAt.toLocaleDateString() : ""}
                  </div>
                </div>
                <RestoreButton taskId={t.id} />
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
