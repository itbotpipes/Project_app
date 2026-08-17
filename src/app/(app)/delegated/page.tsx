import { redirect } from "next/navigation";
import { getCurrentUser, isManagerLike } from "@/lib/auth";
import { adminDb } from "@/lib/firebase/admin";
import { TASK_STATUS_LABEL, priorityQuadrant } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { Card, SectionTitle, Badge } from "../_components/ui";
import NewTaskDialog from "../board/NewTaskDialog";
import { loadTemplateOptions } from "@/lib/templates";
import TaskLink from "../_components/TaskLink";
import { batchFetchByIds, cachedFetch, fetchKpiTemplatesByRole } from "@/lib/cache";

const STATUS_TONE: Record<string, string> = {
  NEW: "bg-slate-100 text-slate-600",
  ACCEPTED: "bg-sky-100 text-sky-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  ON_HOLD: "bg-amber-100 text-amber-700",
  PENDING_REVIEW: "bg-violet-100 text-violet-700",
  CLOSED: "bg-emerald-100 text-emerald-700",
  REOPENED: "bg-red-100 text-red-700",
  CARRIED_FORWARD: "bg-slate-100 text-slate-500",
};

function toDate(val: any): Date | null {
  if (!val) return null;
  if (val.toDate) return val.toDate();
  return new Date(val);
}

export default async function DelegatedTasksPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!isManagerLike(user.systemRole)) redirect("/board");

  const [delegatedSnap, assignableSnap, kpiOptionsSnap] = await Promise.all([
    adminDb.collection("Task")
      .where("creatorId", "==", user.id)
      .get(),
    cachedFetch(
      'active-employees',
      () => adminDb.collection("Employee").where("active", "==", true).get(),
      300 // cache for 5 minutes
    ),
    fetchKpiTemplatesByRole(user.roleId, adminDb),
  ]);

  // Filter out self-assigned and deleted tasks
  const delegatedDocs = delegatedSnap.docs
    ? delegatedSnap.docs.filter((d) => d.data().assigneeId !== user.id && !d.data().deletedAt)
    : [];

  // Batch fetch assignees and KPI templates
  const assigneeIds = delegatedDocs.map((d: any) => d.data().assigneeId).filter(Boolean) as string[];
  const kpiIds = delegatedDocs.map((d: any) => d.data().kpiTemplateId).filter(Boolean) as string[];
  
  const [assigneesMap, kpisMap] = await Promise.all([
    batchFetchByIds('Employee', assigneeIds, adminDb),
    batchFetchByIds('KpiTemplate', kpiIds, adminDb),
  ]);

  const delegated = delegatedDocs.map((doc) => {
    const t = doc.data() as any;
    const assignee = assigneeIds.includes(t.assigneeId) ? (assigneesMap.get(t.assigneeId) as any) : null;
    const kpi = kpiIds.includes(t.kpiTemplateId) ? (kpisMap.get(t.kpiTemplateId) as any) : null;
    
    return {
      id: doc.id,
      title: t.title,
      status: t.status,
      urgent: t.urgent,
      important: t.important,
      assigneeId: t.assigneeId,
      dueAt: toDate(t.dueAt),
      kpiTemplate: kpi ? { kpiName: kpi.kpiName } : null,
      assignee: { id: t.assigneeId, name: assignee?.name ?? "Unknown" },
    };
  });

  const assignable = assignableSnap.docs ? assignableSnap.docs
    .map((d: any) => ({ id: d.id, name: d.data().name, roleId: d.data().roleId }))
    .filter((e: any) => e.id !== user.id)
    .sort((a: any, b: any) => a.name.localeCompare(b.name)) : [];
  const kpiOptions = kpiOptionsSnap.docs ? kpiOptionsSnap.docs
    .sort((a: any, b: any) => (a.data().orderIndex ?? 0) - (b.data().orderIndex ?? 0))
    .map((d: any) => ({ id: d.id, kpiName: d.data().kpiName, kraName: d.data().kraName })) : [];
  const templates = await loadTemplateOptions();

  const open = delegated.filter((t) => t.status !== "CLOSED");
  const closed = delegated.filter((t) => t.status === "CLOSED");

  const byAssignee = new Map<string, { name: string; open: number; closed: number }>();
  for (const t of delegated) {
    const key = t.assignee.id;
    const cur = byAssignee.get(key) ?? { name: t.assignee.name, open: 0, closed: 0 };
    if (t.status === "CLOSED") cur.closed++;
    else cur.open++;
    byAssignee.set(key, cur);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Delegated Tasks</h1>
          <p className="text-sm text-slate-500">
            {open.length} open · {closed.length} closed · tasks you&apos;ve assigned to others
          </p>
        </div>
        <NewTaskDialog kpiOptions={kpiOptions} people={assignable} selfId={assignable[0]?.id ?? user.id} todaysCounts={{}} templates={templates} />
      </div>

      {byAssignee.size > 0 && (
        <Card>
          <SectionTitle>By person</SectionTitle>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {[...byAssignee.entries()].map(([id, v]) => (
              <div key={id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                <span className="text-sm font-medium">{v.name}</span>
                <span className="flex items-center gap-1.5 text-xs">
                  <Badge className="bg-blue-100 text-blue-700">{v.open} open</Badge>
                  {v.closed > 0 && <Badge className="bg-emerald-100 text-emerald-700">{v.closed} done</Badge>}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <SectionTitle>All delegated tasks</SectionTitle>
        {delegated.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">
            You haven&apos;t assigned any tasks to others yet — use "Assign New Task" above to delegate work.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {delegated.map((t) => {
              const quad = priorityQuadrant(t.urgent, t.important);
              return (
                <TaskLink key={t.id} taskId={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 hover:bg-slate-50">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-200 text-[11px] font-semibold text-slate-700">
                    {t.assignee.name.split(" ").map((p: string) => p[0]).slice(0, 2).join("").toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-slate-900">{t.title}</div>
                    <div className="text-xs text-slate-500">
                      → {t.assignee.name}
                      {t.kpiTemplate && <> · {t.kpiTemplate.kpiName}</>}
                      {t.dueAt && <> · due {t.dueAt.toLocaleDateString()}</>}
                    </div>
                  </div>
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_TONE[t.status])}>
                    {TASK_STATUS_LABEL[t.status] ?? t.status}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">{quad}</span>
                </TaskLink>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
