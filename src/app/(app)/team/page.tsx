import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, isManagerLike, hasPermission } from "@/lib/auth";
import { adminDb } from "@/lib/firebase/admin";
import { incrementBand } from "@/lib/constants";
import { monthLabel } from "@/lib/scores";
import { Card, SectionTitle, Badge } from "../_components/ui";
import { batchFetchByIds } from "@/lib/cache";

function toDate(val: any): Date | null {
  if (!val) return null;
  if (val.toDate) return val.toDate();
  return new Date(val);
}

export default async function TeamPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!hasPermission(user, "team")) redirect("/");

  const reportsSnap = await adminDb.collection("Employee").where("reportsToId", "==", user.id).where("active", "==", true).get();
  
  // Batch fetch all related data
  const roleIds = reportsSnap.docs ? reportsSnap.docs.map((d: any) => d.data().roleId).filter(Boolean) as string[] : [];
  const employeeIds = reportsSnap.docs ? reportsSnap.docs.map((d: any) => d.id) : [];
  
  const [rolesMap, scorecardsSnap, tasksSnap] = await Promise.all([
    batchFetchByIds('Role', roleIds, adminDb),
    employeeIds.length > 0 ? adminDb.collection("MonthlyScorecard").where("employeeId", "in", employeeIds).get() : Promise.resolve({ docs: [] } as any),
    employeeIds.length > 0 ? adminDb.collection("Task").where("assigneeId", "in", employeeIds).where("status", "!=", "CLOSED").get() : Promise.resolve({ docs: [] } as any),
  ]);
  
  // Group scorecards by employee
  const scorecardsByEmployee = new Map<string, any[]>();
  scorecardsSnap.docs?.forEach((doc: any) => {
    const empId = doc.data().employeeId;
    if (!scorecardsByEmployee.has(empId)) scorecardsByEmployee.set(empId, []);
    scorecardsByEmployee.get(empId)!.push(doc.data());
  });
  
  // Get latest scorecard for each employee
  const latestScorecards = new Map<string, any>();
  scorecardsByEmployee.forEach((cards, empId) => {
    const sorted = cards.sort((a, b) => (b.year - a.year) || (b.month - a.month));
    if (sorted.length > 0) latestScorecards.set(empId, sorted[0]);
  });
  
  // Group tasks by employee
  const tasksByEmployee = new Map<string, any[]>();
  tasksSnap.docs?.forEach((doc: any) => {
    const empId = doc.data().assigneeId;
    if (!tasksByEmployee.has(empId)) tasksByEmployee.set(empId, []);
    tasksByEmployee.get(empId)!.push(doc.data());
  });
  
  const reportsData = reportsSnap.docs ? reportsSnap.docs.map((doc: any) => {
    const emp = doc.data();
    const role = emp.roleId ? (rolesMap.get(emp.roleId) as any) : { title: "Unknown" };
    const latestScorecard = latestScorecards.get(doc.id) || null;
    const employeeTasks = tasksByEmployee.get(doc.id) || [];
    
    // Filter out deleted tasks
    const activeOpenTasks = employeeTasks.filter((t: any) => !t.deletedAt).map((t: any) => ({ dueAt: toDate(t.dueAt) }));
    
    return {
      id: doc.id,
      name: emp.name,
      role,
      scorecards: latestScorecard ? [latestScorecard] : [],
      openTasks: activeOpenTasks,
      _count: { assignedTasks: activeOpenTasks.length }
    };
  }) : [];
  reportsData.sort((a, b) => a.name.localeCompare(b.name));

  // Workload radar — open + overdue tasks per report
  const now = new Date();
  
  const radar = reportsData.map((r) => {
    let overdueCount = 0;
    for (const t of r.openTasks) {
      if (t.dueAt && t.dueAt < now) overdueCount++;
    }
    const openCount = r.openTasks.length;
    const status = openCount >= 7 ? "Overloaded" : openCount === 0 ? "Underutilized" : "Balanced";
    return { id: r.id, name: r.name, open: openCount, overdue: overdueCount, status };
  });
  
  const statusTone: Record<string, string> = {
    Overloaded: "bg-red-100 text-red-700",
    Balanced: "bg-emerald-100 text-emerald-700",
    Underutilized: "bg-amber-100 text-amber-700",
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">My Team</h1>
          <p className="text-sm text-slate-500">
            {reportsData.length} direct report{reportsData.length === 1 ? "" : "s"} · tasks &amp; monthly scores
          </p>
        </div>
        <Link href="/scores" className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
          Open Scoring Panel →
        </Link>
      </div>

      {reportsData.length === 0 && (
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

      {reportsData.length > 0 && (
        <Card>
          <SectionTitle>Team scores</SectionTitle>
          <div className="divide-y divide-slate-100">
            {reportsData.map((r) => {
              const latest = r.scorecards[0];
              const band = latest ? incrementBand(latest.total) : null;
              return (
                <div key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700">
                    {r.name.split(" ").map((p: string) => p[0]).slice(0, 2).join("").toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-slate-500">{r.role.title}</div>
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <Badge className="bg-blue-100 text-blue-700">
                      {r._count.assignedTasks} open
                    </Badge>
                    {latest ? (
                      <Badge className="bg-slate-100 text-slate-700">
                        Score {Math.round(latest.total)} · {monthLabel(latest.year, latest.month)}
                      </Badge>
                    ) : (
                      <Badge className="bg-slate-100 text-slate-400">not scored</Badge>
                    )}
                    {band && <Badge className="bg-emerald-50 text-emerald-700">{band.label}</Badge>}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            To score your team per KPI (or adjust the system&apos;s auto scores), open the{" "}
            <Link href="/scores" className="text-blue-600 hover:underline">Scoring Panel</Link>.
          </p>
        </Card>
      )}
    </div>
  );
}
