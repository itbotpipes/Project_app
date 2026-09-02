import Link from "next/link";
import { getCurrentUser, isManagerLike } from "@/lib/auth";
import { adminDb } from "@/lib/firebase/admin";
import { TASK_STATUS_ORDER } from "@/lib/constants";
import { mondayOf } from "@/lib/date";
import { cn } from "@/lib/cn";
import { Card, SectionTitle } from "../_components/ui";
import BucketFill from "../_components/BucketFill";
import NewTaskDialog from "./NewTaskDialog";
import KanbanBoard from "./KanbanBoard";
import Celebration from "../_components/Celebration";
import { loadTemplateOptions } from "@/lib/templates";
import { batchFetchByIds, cachedFetch } from "@/lib/cache";
import ManageKpisDialog from "./ManageKpisDialog";

function toDate(val: any): Date | null {
  if (!val) return null;
  if (val.toDate) return val.toDate();
  return new Date(val);
}

export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  const sp = await searchParams;
  const period = sp.period === "week" ? "week" : sp.period === "month" ? "month" : "today";

  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  // Split board task queries to avoid full task history downloads.
  // 1. Active Board Tasks (excluding closed unless they are recent or relevant for the board layout).
  // 2. Month-bounded Tasks for KPI bucket statistics.
  const [activeTasksSnap, monthTasksSnap, kpiOptionsSnap, assignableSnap, templates] = await Promise.all([
    adminDb.collection("Task")
      .where("assigneeId", "==", user.id)
      .where("status", "!=", "CLOSED")
      .get(),
    adminDb.collection("Task")
      .where("assigneeId", "==", user.id)
      .where("createdAt", ">=", startOfMonth)
      .get(),
    adminDb.collection("KpiTemplate").get(),
    cachedFetch("active-employees", () => adminDb.collection("Employee").where("active", "==", true).get(), 300),
    loadTemplateOptions(),
  ]);

  const allKpis = kpiOptionsSnap.docs
    ? kpiOptionsSnap.docs
        .sort((a, b) => (a.data().orderIndex ?? 0) - (b.data().orderIndex ?? 0))
        .map(d => ({ id: d.id, kpiName: d.data().kpiName, kraName: d.data().kraName, roleId: d.data().roleId }))
    : [];
  const kpiOptions = allKpis.filter(k => k.roleId === user.roleId);

  // Active board tasks from the open/active tasks snap.
  // We can also merge recently closed tasks from monthTasksSnap if we want them on the board,
  // but usually active tasks (non-CLOSED) are what's displayed. Let's combine them:
  const activeBoardDocs = activeTasksSnap.docs ? activeTasksSnap.docs.filter(d => !d.data().deletedAt) : [];
  // Include recently completed tasks from this month to show on board if needed, or filter.
  // The Kanban board expects to render tasks in different columns, including CLOSED.
  // To populate the CLOSED column without downloading full history, we filter this month's closed tasks.
  const recentlyClosedDocs = monthTasksSnap.docs ? monthTasksSnap.docs.filter(d => d.data().status === "CLOSED" && !d.data().deletedAt) : [];
  const boardDocs = [...activeBoardDocs, ...recentlyClosedDocs];

  // Fetch related data for board tasks — batch queries, no N+1
  const taskIds = boardDocs.map(d => d.id);
  const kpiIds = boardDocs.map(d => d.data().kpiTemplateId).filter(Boolean) as string[];
  const projectIds = boardDocs.map(d => d.data().projectId).filter(Boolean) as string[];
  const creatorIds = boardDocs.map(d => d.data().creatorId).filter(Boolean) as string[];

  // All related-data fetches run in parallel — no inter-dependencies
  const checklistChunks: string[][] = [];
  for (let i = 0; i < taskIds.length; i += 30) checklistChunks.push(taskIds.slice(i, i + 30));

  const [kpisMap, projectsMap, creatorsMap, ...checklistSnapChunks] = await Promise.all([
    batchFetchByIds("KpiTemplate", kpiIds, adminDb),
    batchFetchByIds("Project", projectIds, adminDb),
    batchFetchByIds("Employee", creatorIds, adminDb),
    ...checklistChunks.map(chunk =>
      adminDb.collection("ChecklistItem").where("taskId", "in", chunk).get()
    ),
  ]);
  const allChecklistDocs = (checklistSnapChunks as any[]).flatMap(snap => snap.docs ?? []);


  // Group checklist items by task
  const checklistsByTask = new Map<string, any[]>();
  allChecklistDocs.forEach((c: any) => {
    const taskId = c.data().taskId;
    if (!checklistsByTask.has(taskId)) checklistsByTask.set(taskId, []);
    checklistsByTask.get(taskId)!.push({ done: c.data().done });
  });

  const tasks = boardDocs.map(doc => {
    const t = doc.data() as any;
    const kpi = t.kpiTemplateId ? (kpisMap.get(t.kpiTemplateId) as any) : null;
    const project = t.projectId ? (projectsMap.get(t.projectId) as any) : null;
    const creator = t.creatorId ? (creatorsMap.get(t.creatorId) as any) : null;
    const checklistItems = checklistsByTask.get(doc.id) || [];
    return {
      id: doc.id,
      title: t.title,
      status: t.status,
      sizeLabel: t.sizeLabel,
      urgent: t.urgent,
      important: t.important,
      estimatedMins: t.estimatedMins,
      dueAt: toDate(t.dueAt)?.toISOString() ?? null,
      holdReason: t.holdReason,
      reviewRequired: t.reviewRequired,
      carryCount: t.carryCount ?? 0,
      reworkCount: t.reworkCount ?? 0,
      kpiTemplateId: t.kpiTemplateId ?? null,
      creatorId: t.creatorId,
      kpiTemplate: kpi ? { kpiName: kpi.kpiName } : null,
      project: project ? { name: project.name } : null,
      creator: creator ? { name: creator.name } : null,
      checklistItems,
    };
  });

  // KPI bucket-balance check — derived from month-bounded tasks (no full-history fetch)
  const monthUserTasks = monthTasksSnap.docs || [];
  const startOfMonthMs = startOfMonth.getTime();

  const workedBuckets = new Set(
    monthUserTasks
      .map(d => d.data().kpiTemplateId)
      .filter(Boolean)
  );
  const monthCount = monthUserTasks.length;
  const imbalance = kpiOptions.length >= 4 && monthCount >= 3 && workedBuckets.size <= 2;

  // Bucket water-fill period
  const periodStart =
    period === "today"
      ? (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })()
      : period === "week"
      ? mondayOf()
      : startOfMonth;
  const periodStartMs = periodStart.getTime();
  const countByKpi = new Map<string, number>();
  for (const doc of monthUserTasks) {
    const raw = doc.data().createdAt;
    const createdAt = raw?.toDate ? raw.toDate() : new Date(raw ?? 0);
    if (createdAt.getTime() < periodStartMs) continue;
    const kpiId = doc.data().kpiTemplateId;
    if (!kpiId) continue;
    if (doc.data().status === "CLOSED") continue;
    countByKpi.set(kpiId, (countByKpi.get(kpiId) ?? 0) + 1);
  }
  const bucketData = kpiOptions.map(k => ({ id: k.id, name: k.kpiName, count: countByKpi.get(k.id) ?? 0 }));

  // Today's per-KPI counts (for the new task dialog)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayStartMs = todayStart.getTime();
  const todaysCounts: Record<string, number> = {};
  for (const doc of monthUserTasks) {
    const raw = doc.data().createdAt;
    const createdAt = raw?.toDate ? raw.toDate() : new Date(raw ?? 0);
    if (createdAt.getTime() < todayStartMs) continue;
    const kpiId = doc.data().kpiTemplateId;
    if (!kpiId) continue;
    if (doc.data().status === "CLOSED") continue;
    todaysCounts[kpiId] = (todaysCounts[kpiId] ?? 0) + 1;
  }

  const assignable = assignableSnap.docs
    ?.map((d: any) => ({ id: d.id, name: d.data().name, roleId: d.data().roleId }))
    .sort((a: any, b: any) => a.name.localeCompare(b.name))
    .filter((e: any) => e.id !== user.id) || [];
  const people = [{ id: user.id, name: `${user.name} (me)`, roleId: user.roleId }, ...assignable];

  const boardTasks = tasks.map(t => ({
    id: t.id,
    title: t.title,
    status: t.status,
    sizeLabel: t.sizeLabel,
    urgent: t.urgent,
    important: t.important,
    estimatedMins: t.estimatedMins,
    dueAt: t.dueAt,
    holdReason: t.holdReason,
    reviewRequired: t.reviewRequired,
    carryCount: t.carryCount,
    reworkCount: t.reworkCount,
    kpiName: t.kpiTemplate?.kpiName ?? null,
    projectName: t.project?.name ?? null,
    delegatedBy:
      t.creatorId !== user.id && t.creatorId !== user.reportsToId ? t.creator?.name ?? null : null,
    checklistTotal: t.checklistItems.length,
    checklistDone: t.checklistItems.filter((c: any) => c.done).length,
  }));
  const closedTodayDocs = monthTasksSnap.docs
    ? monthTasksSnap.docs.filter(d => {
        const cAt = toDate(d.data().completedAt);
        return d.data().status === "CLOSED" && cAt && cAt.getTime() >= todayStart.getTime() && !d.data().deletedAt;
      })
    : [];
  const celebrate = activeBoardDocs.length === 0 && closedTodayDocs.length > 0;

  return (
    <div className="space-y-4">
      {celebrate && <Celebration name={user.name.split(" ")[0]} />}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">My Board</h1>
          <p className="text-sm text-slate-500">
            {tasks?.length ?? 0} task{(tasks?.length ?? 0) === 1 ? "" : "s"} · every task fills a KPI bucket
          </p>
        </div>
        <NewTaskDialog kpiOptions={allKpis} people={people} selfId={user.id} todaysCounts={todaysCounts} templates={templates} />
      </div>

      <Card>
        <SectionTitle
          action={
            <div className="flex items-center gap-2 text-xs">
              <ManageKpisDialog kpis={kpiOptions} roleId={user.roleId} />
              {/* AutoRefresh removed — was triggering router.refresh() every 20 seconds,
                  re-running auth, alerts, and all Firestore queries for every user.
                  The board updates automatically after any action via revalidatePath(). */}
              <div className="flex gap-1">
                {(["today", "week", "month"] as const).map(p => (
                  <Link
                    key={p}
                    href={`/board?period=${p}`}
                    className={cn(
                      "rounded-full px-2.5 py-1 font-medium capitalize",
                      period === p ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                    )}
                  >
                    {p}
                  </Link>
                ))}
              </div>
            </div>
          }
        >
          🔥 KPI fire-pipes — {period === "today" ? "today" : period === "week" ? "this week" : "this month"}
        </SectionTitle>
        <BucketFill buckets={bucketData} />
        <p className="mt-3 text-[11px] text-slate-400">
          Each red pipe is one of your KPIs. Water rises as work flows through it — updates after each action.
        </p>
      </Card>

      {imbalance && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          ⚖️ <span className="font-medium">Your KPI balance is off.</span> This month you&apos;ve
          only worked {workedBuckets.size} of your {kpiOptions.length} KPI buckets. Spread your tasks
          across more of your role&apos;s KPIs to stay on track for growth.
        </div>
      )}

      <p className="text-xs text-slate-400">
        💡 Drag a card between columns to change its status — or use the &quot;Move to…&quot; dropdown on each card.
      </p>
      <KanbanBoard 
        initialTasks={boardTasks} 
        columns={[...TASK_STATUS_ORDER]} 
        key={boardTasks.map(t => t.id + t.status).join(",")} 
      />
    </div>
  );
}
