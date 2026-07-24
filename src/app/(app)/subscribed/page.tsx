import { getCurrentUser } from "@/lib/auth";
import { adminDb } from "@/lib/firebase/admin";
import { TASK_STATUS_LABEL } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { Card, SectionTitle } from "../_components/ui";
import TaskLink from "../_components/TaskLink";

const STATUS_TONE: Record<string, string> = {
  NEW: "bg-slate-100 text-slate-600",
  ACCEPTED: "bg-sky-100 text-sky-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  ON_HOLD: "bg-amber-100 text-amber-700",
  PENDING_REVIEW: "bg-violet-100 text-violet-700",
  CLOSED: "bg-emerald-100 text-emerald-700",
};

export default async function SubscribedTasksPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const watchesSnap = await adminDb.collection("TaskWatcher").where("employeeId", "==", user.id).get();
  watchesSnap.docs.sort((a, b) => (b.data().createdAt?.toMillis?.() ?? 0) - (a.data().createdAt?.toMillis?.() ?? 0));
  
  const watches = await Promise.all(
    watchesSnap.docs.map(async (doc) => {
      const w = doc.data() as any;
      const tDoc = await adminDb.collection("Task").doc(w.taskId).get();
      if (!tDoc.exists) return null;
      const t = tDoc.data()!;
      if (t.deletedAt) return null;

      const [assigneeDoc, creatorDoc, kpiDoc] = await Promise.all([
        t.assigneeId ? adminDb.collection("Employee").doc(t.assigneeId).get() : Promise.resolve(null),
        t.creatorId ? adminDb.collection("Employee").doc(t.creatorId).get() : Promise.resolve(null),
        t.kpiTemplateId ? adminDb.collection("KpiTemplate").doc(t.kpiTemplateId).get() : Promise.resolve(null),
      ]);

      return {
        id: doc.id,
        task: {
          id: tDoc.id,
          title: t.title,
          status: t.status,
          assignee: { name: assigneeDoc?.exists ? assigneeDoc.data()!.name : "Unknown" },
          creator: { name: creatorDoc?.exists ? creatorDoc.data()!.name : "Unknown" },
          kpiTemplate: kpiDoc?.exists ? { kpiName: kpiDoc.data()!.kpiName } : null,
        }
      };
    })
  );

  const activeWatches = watches.filter(Boolean) as any[];

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Subscribed Tasks</h1>
        <p className="text-sm text-slate-500">Tasks you&apos;re &ldquo;in the loop&rdquo; on — from your own board, delegated tasks, or group tasks.</p>
      </div>

      <Card>
        <SectionTitle>{activeWatches.length} subscribed</SectionTitle>
        {activeWatches.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">
            Nothing here yet. Open any task and tap &ldquo;Join loop&rdquo;, or get added as &ldquo;In Loop&rdquo; when someone assigns a task.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {activeWatches.map((w) => (
              <TaskLink key={w.id} taskId={w.task.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 hover:bg-slate-50">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-slate-900">{w.task.title}</div>
                  <div className="text-xs text-slate-500">
                    {w.task.assignee.name} · created by {w.task.creator.name}
                    {w.task.kpiTemplate && <> · {w.task.kpiTemplate.kpiName}</>}
                  </div>
                </div>
                <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_TONE[w.task.status])}>
                  {TASK_STATUS_LABEL[w.task.status] ?? w.task.status}
                </span>
              </TaskLink>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
