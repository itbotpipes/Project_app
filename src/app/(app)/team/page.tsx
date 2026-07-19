import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, isManagerLike } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { incrementBand } from "@/lib/constants";
import { monthLabel } from "@/lib/scores";
import { Card, SectionTitle, Badge } from "../_components/ui";
import ScorecardEditor from "./ScorecardEditor";

export default async function TeamPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!isManagerLike(user.systemRole)) redirect("/");

  const reports = await prisma.employee.findMany({
    where: { reportsToId: user.id, active: true },
    include: {
      role: true,
      scorecards: { orderBy: [{ year: "desc" }, { month: "desc" }], take: 1 },
      scoresReceived: { where: { period: "MONTHLY" }, orderBy: { periodStart: "desc" }, take: 1 },
      _count: { select: { assignedTasks: { where: { status: { notIn: ["CLOSED"] } } } } },
    },
    orderBy: { name: "asc" },
  });

  // Workload radar — open + overdue tasks per report
  const now = new Date();
  const openTasks = await prisma.task.findMany({
    where: { assigneeId: { in: reports.map((r) => r.id) }, status: { notIn: ["CLOSED"] } },
    select: { assigneeId: true, dueAt: true },
  });
  const load = new Map<string, { open: number; overdue: number }>();
  for (const r of reports) load.set(r.id, { open: 0, overdue: 0 });
  for (const t of openTasks) {
    const l = load.get(t.assigneeId)!;
    l.open++;
    if (t.dueAt && new Date(t.dueAt) < now) l.overdue++;
  }
  const radar = reports.map((r) => {
    const l = load.get(r.id)!;
    const status = l.open >= 7 ? "Overloaded" : l.open === 0 ? "Underutilized" : "Balanced";
    return { id: r.id, name: r.name, ...l, status };
  });
  const statusTone: Record<string, string> = {
    Overloaded: "bg-red-100 text-red-700",
    Balanced: "bg-emerald-100 text-emerald-700",
    Underutilized: "bg-amber-100 text-amber-700",
  };

  // KPI templates per role (for the score editor)
  const roleIds = [...new Set(reports.map((r) => r.roleId))];
  const kpis = await prisma.kpiTemplate.findMany({
    where: { roleId: { in: roleIds } },
    orderBy: { orderIndex: "asc" },
  });
  const kpisByRole = new Map<string, typeof kpis>();
  for (const k of kpis) {
    const arr = kpisByRole.get(k.roleId) ?? [];
    arr.push(k);
    kpisByRole.set(k.roleId, arr);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">My Team</h1>
          <p className="text-sm text-slate-500">
            {reports.length} direct report{reports.length === 1 ? "" : "s"} · scores, tasks &amp;
            monthly KRA scoring
          </p>
        </div>
        <Link href="/scores" className="text-sm font-medium text-blue-600 hover:underline">
          Open scoring panel →
        </Link>
      </div>

      {reports.length === 0 && (
        <Card>
          <p className="text-sm text-slate-500">No direct reports assigned to you yet.</p>
        </Card>
      )}

      {radar.length > 0 && (
        <Card>
          <SectionTitle>⚡ Workload radar</SectionTitle>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {radar.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                <div className="text-sm font-medium">{r.name}</div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500">{r.open} open</span>
                  {r.overdue > 0 && <span className="text-red-600">{r.overdue} overdue</span>}
                  <Badge className={statusTone[r.status]}>{r.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="space-y-4">
        {reports.map((r) => {
          const latest = r.scorecards[0];
          const manScore = r.scoresReceived[0];
          const effective = manScore?.score ?? latest?.total;
          const band = effective != null ? incrementBand(effective) : null;
          return (
            <Card key={r.id}>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-slate-200 text-sm font-semibold text-slate-700">
                  {r.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="font-medium">{r.name}</div>
                  <div className="text-xs text-slate-500">{r.role.title}</div>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <Badge className="bg-blue-100 text-blue-700">
                    {r._count.assignedTasks} open task{r._count.assignedTasks === 1 ? "" : "s"}
                  </Badge>
                  {latest ? (
                    <Badge className="bg-slate-100 text-slate-700" title="Auto-computed from tasks/KPIs">
                      Auto {Math.round(latest.total)} · {monthLabel(latest.year, latest.month)}
                    </Badge>
                  ) : (
                    <Badge className="bg-slate-100 text-slate-400">no auto score</Badge>
                  )}
                  {manScore ? (
                    <Badge className="bg-violet-100 text-violet-700" title="Manager's holistic score">
                      Manager {Math.round(manScore.score)}
                    </Badge>
                  ) : (
                    <Badge className="bg-violet-50 text-violet-400">not scored</Badge>
                  )}
                  {band && <Badge className="bg-emerald-50 text-emerald-700">{band.label}</Badge>}
                </div>
              </div>
              <div className="mt-3 border-t border-slate-100 pt-3">
                <ScorecardEditor
                  employeeId={r.id}
                  employeeName={r.name}
                  kpis={(kpisByRole.get(r.roleId) ?? []).map((k) => ({
                    id: k.id,
                    kpiName: k.kpiName,
                    kraName: k.kraName,
                    weightage: k.weightage,
                  }))}
                />
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
