import Link from "next/link";
import { getCurrentUser, isManagerLike } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TASK_STATUS_ORDER, TASK_STATUS_LABEL } from "@/lib/constants";
import { mondayOf } from "@/lib/date";
import { cn } from "@/lib/cn";
import { Card, SectionTitle } from "../_components/ui";
import BucketFill from "../_components/BucketFill";
import NewTaskDialog from "./NewTaskDialog";
import TaskCard from "./TaskCard";

const columnTint: Record<string, string> = {
  NEW: "bg-slate-100",
  ACCEPTED: "bg-sky-100",
  IN_PROGRESS: "bg-blue-100",
  ON_HOLD: "bg-amber-100",
  PENDING_REVIEW: "bg-violet-100",
  CLOSED: "bg-emerald-100",
};

export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  const sp = await searchParams;
  const period = sp.period === "week" ? "week" : sp.period === "month" ? "month" : "today";

  const tasks = await prisma.task.findMany({
    where: { assigneeId: user.id },
    include: { kpiTemplate: true, project: true, creator: { select: { name: true } } },
    orderBy: [{ urgent: "desc" }, { important: "desc" }, { createdAt: "desc" }],
  });

  const kpiOptions = await prisma.kpiTemplate.findMany({
    where: { roleId: user.roleId },
    orderBy: { orderIndex: "asc" },
    select: { id: true, kpiName: true, kraName: true },
  });

  // KPI bucket-balance check (this month)
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const monthTasks = await prisma.task.findMany({
    where: { assigneeId: user.id, createdAt: { gte: startOfMonth } },
    select: { kpiTemplateId: true },
  });
  const workedBuckets = new Set(monthTasks.filter((t) => t.kpiTemplateId).map((t) => t.kpiTemplateId));
  const imbalance =
    kpiOptions.length >= 4 && monthTasks.length >= 3 && workedBuckets.size <= 2;

  // Bucket water-fill: how many tasks landed in each KPI bucket this period
  const periodStart =
    period === "today"
      ? (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })()
      : period === "week"
        ? mondayOf()
        : startOfMonth;
  const periodTasks = await prisma.task.findMany({
    where: { assigneeId: user.id, createdAt: { gte: periodStart } },
    select: { kpiTemplateId: true },
  });
  const countByKpi = new Map<string, number>();
  for (const t of periodTasks) {
    if (!t.kpiTemplateId) continue;
    countByKpi.set(t.kpiTemplateId, (countByKpi.get(t.kpiTemplateId) ?? 0) + 1);
  }
  const bucketData = kpiOptions.map((k) => ({ id: k.id, name: k.kpiName, count: countByKpi.get(k.id) ?? 0 }));

  // Today's counts specifically, for the "new task" KPI preview (independent of the period tabs above)
  const todaysCounts: Record<string, number> = period === "today" ? Object.fromEntries(countByKpi) : {};
  if (period !== "today") {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todaysTasks = await prisma.task.findMany({
      where: { assigneeId: user.id, createdAt: { gte: todayStart } },
      select: { kpiTemplateId: true },
    });
    for (const t of todaysTasks) {
      if (!t.kpiTemplateId) continue;
      todaysCounts[t.kpiTemplateId] = (todaysCounts[t.kpiTemplateId] ?? 0) + 1;
    }
  }

  // Who can this person assign to: themselves always; managers can delegate to
  // ANY active employee (not just their direct reports) — "anybody can give a
  // task to anyone" for managers/executives, per company policy.
  const assignable = isManagerLike(user.systemRole)
    ? await prisma.employee.findMany({
        where: { active: true, id: { not: user.id } },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : [];
  const people = [{ id: user.id, name: `${user.name} (me)` }, ...assignable];

  // group tasks; fold REOPENED/CARRIED_FORWARD into NEW column for display
  const byStatus: Record<string, typeof tasks> = {};
  for (const s of TASK_STATUS_ORDER) byStatus[s] = [];
  for (const t of tasks) {
    const col = TASK_STATUS_ORDER.includes(t.status as never) ? t.status : "NEW";
    byStatus[col].push(t);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">My Board</h1>
          <p className="text-sm text-slate-500">
            {tasks.length} task{tasks.length === 1 ? "" : "s"} · every task fills a KPI bucket
          </p>
        </div>
        <NewTaskDialog kpiOptions={kpiOptions} people={people} selfId={user.id} todaysCounts={todaysCounts} />
      </div>

      <Card>
        <SectionTitle
          action={
            <div className="flex gap-1 text-xs">
              {(["today", "week", "month"] as const).map((p) => (
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
          }
        >
          🪣 KPI buckets — {period === "today" ? "today" : period === "week" ? "this week" : "this month"}
        </SectionTitle>
        <BucketFill buckets={bucketData} />
      </Card>

      {imbalance && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          ⚖️ <span className="font-medium">Your KPI balance is off.</span> This month you&apos;ve
          only worked {workedBuckets.size} of your {kpiOptions.length} KPI buckets. Spread your tasks
          across more of your role&apos;s KPIs to stay on track for growth.
        </div>
      )}

      <div className="flex gap-4 overflow-x-auto scroll-thin pb-4">
        {TASK_STATUS_ORDER.map((status) => (
          <div key={status} className="w-72 shrink-0">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${columnTint[status]}`} />
                <h2 className="text-sm font-semibold text-slate-700">
                  {TASK_STATUS_LABEL[status]}
                </h2>
              </div>
              <span className="rounded-full bg-slate-100 px-2 text-xs text-slate-500">
                {byStatus[status].length}
              </span>
            </div>
            <div className="space-y-2 rounded-xl bg-slate-100/60 p-2 min-h-24">
              {byStatus[status].map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  delegatedBy={
                    t.creatorId !== user.id && t.creatorId !== user.reportsToId ? t.creator?.name : null
                  }
                />
              ))}
              {!byStatus[status].length && (
                <div className="py-6 text-center text-xs text-slate-400">—</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
