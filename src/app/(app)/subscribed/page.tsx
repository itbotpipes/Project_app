import { getCurrentUser } from "@/lib/auth";
import { adminDb } from "@/lib/firebase/admin";
import { TASK_STATUS_LABEL } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { Card, SectionTitle } from "../_components/ui";
import TaskLink from "../_components/TaskLink";
import { batchFetchByIds } from "@/lib/cache";

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
  if (watchesSnap.docs) {
    watchesSnap.docs.sort((a, b) => (b.data().createdAt?.toMillis?.() ?? 0) - (a.data().createdAt?.toMillis?.() ?? 0));
  }
  
  // Batch fetch all watched tasks and related data
  const taskIds = watchesSnap.docs ? watchesSnap.docs.map((d: any) => d.data().taskId).filter(Boolean) as string[] : [];
  const tasksMap = await batchFetchByIds('Task', taskIds, adminDb);
  
  // Filter out deleted tasks and collect related IDs
  const validTasks = new Map<string, any>();
  const assigneeIds: string[] = [];
  const creatorIds: string[] = [];
  const kpiIds: string[] = [];
  
  tasksMap.forEach((task: any) => {
    if (!task.deletedAt) {
      validTasks.set(task.id, task);
      if (task.assigneeId) assigneeIds.push(task.assigneeId);
      if (task.creatorId) creatorIds.push(task.creatorId);
      if (task.kpiTemplateId) kpiIds.push(task.kpiTemplateId);
    }
  });
  
  // Batch fetch related data
  const [assigneesMap, creatorsMap, kpisMap] = await Promise.all([
    batchFetchByIds('Employee', assigneeIds, adminDb),
    batchFetchByIds('Employee', creatorIds, adminDb),
    batchFetchByIds('KpiTemplate', kpiIds, adminDb),
  ]);
  
  const watches = watchesSnap.docs ? watchesSnap.docs.map((doc: any) => {
    const w = doc.data();
    const task = validTasks.get(w.taskId);
    if (!task) return null;
    
    const assignee = task.assigneeId ? (assigneesMap.get(task.assigneeId) as any) : null;
    const creator = task.creatorId ? (creatorsMap.get(task.creatorId) as any) : null;
    const kpi = task.kpiTemplateId ? (kpisMap.get(task.kpiTemplateId) as any) : null;

    return {
      id: doc.id,
      task: {
        id: task.id,
        title: task.title,
        status: task.status,
        assignee: { name: assignee?.name ?? "Unknown" },
        creator: { name: creator?.name ?? "Unknown" },
        kpiTemplate: kpi ? { kpiName: kpi.kpiName } : null,
      }
    };
  }).filter(Boolean) : [];

  const activeWatches = watches as any[];

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
