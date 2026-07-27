import { getCurrentUser } from "@/lib/auth";
import { adminDb } from "@/lib/firebase/admin";
import { monthStartOf, previousMonthStart } from "@/lib/date";
import { computeWeeklyStars } from "@/lib/weeklyStar";
import { Card, SectionTitle, Badge } from "../_components/ui";
import Avatar from "../_components/Avatar";
import { ScoreBars } from "../_components/Charts";
import { batchFetchByIds, fetchAllRoles, fetchAllDepartments } from "@/lib/cache";

function fmtISO(d: Date) {
  return d.toISOString().slice(0, 10);
}
function toDate(val: any): Date | null {
  if (!val) return null;
  if (val.toDate) return val.toDate();
  return new Date(val);
}

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const weeklyStars = await computeWeeklyStars();
  const starOfWeek = weeklyStars[0] ?? null;

  const lastMonthStart = previousMonthStart();
  const ly = lastMonthStart.getFullYear();
  const lm = lastMonthStart.getMonth() + 1;

  // Employee of last month — fetch all for that month, sort in JS
  const lastMonthAllSnap = await adminDb.collection("MonthlyScorecard")
    .where("year", "==", ly)
    .where("month", "==", lm)
    .get();
  let lastMonthTop: any = null;
  if (!lastMonthAllSnap.empty) {
    const sorted = lastMonthAllSnap.docs
      .filter((d) => (d.data().total ?? 0) > 0)
      .sort((a, b) => b.data().total - a.data().total);
    if (sorted.length > 0) {
      const card = sorted[0].data();
      const empDoc = await adminDb.collection("Employee").doc(card.employeeId).get();
      if (empDoc.exists) {
        const emp = empDoc.data()!;
        let roleData: any = null;
        if (emp.roleId) {
          const roleDoc = await adminDb.collection("Role").doc(emp.roleId).get();
          if (roleDoc.exists) roleData = { title: roleDoc.data()!.title };
        }
        lastMonthTop = { ...card, employee: { ...emp, id: empDoc.id, role: roleData } };
      }
    }
  }

  const sp = await searchParams;
  const periodStart = sp.date ? monthStartOf(new Date(sp.date)) : previousMonthStart();
  const periodEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 1);
  const monthLabelStr = periodStart.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const monthValue = `${periodStart.getFullYear()}-${String(periodStart.getMonth() + 1).padStart(2, "0")}`;
  const py = periodStart.getFullYear();
  const pm = periodStart.getMonth() + 1;

  const employeesSnap = await adminDb.collection("Employee").where("active", "==", true).get();
  const empIds = employeesSnap.docs ? employeesSnap.docs.map((d: any) => d.id) : [];
  const roleIds = employeesSnap.docs ? employeesSnap.docs.map((d: any) => d.data().roleId).filter(Boolean) as string[] : [];

  // Batch fetch roles and departments using cached data
  const [rolesMap, departmentsMap] = await Promise.all([
    batchFetchByIds('Role', roleIds, adminDb),
    fetchAllDepartments(adminDb),
  ]);

  // Build department name map from roles
  const deptNameByRoleId = new Map<string, string>();
  rolesMap.forEach((role: any) => {
    if (role.departmentId) {
      const dept = departmentsMap.docs?.find((d: any) => d.id === role.departmentId);
      if (dept) deptNameByRoleId.set(role.id, dept.data().name);
    }
  });

  // Resolve roles and departments for each employee using batched data
  const employees = employeesSnap.docs ? employeesSnap.docs.map((doc: any) => {
    const emp = doc.data();
    const deptName = emp.roleId ? (deptNameByRoleId.get(emp.roleId) ?? "Other") : "Other";
    return { id: doc.id, ...emp, deptName };
  }) : [];

  // Batch scorecards and tasks for period (max 30 per Firestore "in" query)
  const chunkSize = 30;
  const chunks: string[][] = [];
  for (let i = 0; i < empIds.length; i += chunkSize) chunks.push(empIds.slice(i, i + chunkSize));

  const scorecardsAll: any[] = [];
  const tasksAll: any[] = [];
  const closedTasksAll: any[] = [];

  if (chunks.length > 0) {
    await Promise.all(
      chunks.map(async (chunk) => {
        const [sc, ta, ca] = await Promise.all([
          adminDb.collection("MonthlyScorecard").where("employeeId", "in", chunk).where("year", "==", py).where("month", "==", pm).get(),
          adminDb.collection("Task").where("assigneeId", "in", chunk).get(),
          adminDb.collection("Task").where("assigneeId", "in", chunk).where("status", "==", "CLOSED").get(),
        ]);
        const periodStartMs = periodStart.getTime();
        const periodEndMs = periodEnd.getTime();
        sc.docs?.forEach((d: any) => scorecardsAll.push({ ...d.data(), id: d.id }));
        ta.docs?.forEach((d: any) => {
          const raw = d.data().createdAt;
          const createdAt = raw?.toDate ? raw.toDate() : new Date(raw ?? 0);
          if (createdAt.getTime() >= periodStartMs && createdAt.getTime() < periodEndMs)
            tasksAll.push({ ...d.data(), id: d.id });
        });
        ca.docs?.forEach((d: any) => {
          const raw = d.data().completedAt;
          const completedAt = raw?.toDate ? raw.toDate() : new Date(raw ?? 0);
          if (completedAt.getTime() >= periodStartMs && completedAt.getTime() < periodEndMs)
            closedTasksAll.push({ ...d.data(), id: d.id });
        });
      })
    );
  }

  const scoreMap = new Map(scorecardsAll.map((s: any) => [s.employeeId, s.total as number]));

  const daysElapsed = Math.max(1, Math.min(
    Math.ceil((Math.min(Date.now(), periodEnd.getTime()) - periodStart.getTime()) / 86400000), 31
  ));

  type DeptAgg = { name: string; people: number; scoreSum: number; scoreCount: number; total: number; closed: number; activeDays: Set<string> };
  const byDept = new Map<string, DeptAgg>();
  const deptOf = new Map<string, string>();

  for (const e of employees) {
    deptOf.set(e.id, e.deptName);
    if (!byDept.has(e.deptName)) {
      byDept.set(e.deptName, { name: e.deptName, people: 0, scoreSum: 0, scoreCount: 0, total: 0, closed: 0, activeDays: new Set() });
    }
    byDept.get(e.deptName)!.people++;
    const effective = scoreMap.get(e.id);
    if (effective != null) {
      byDept.get(e.deptName)!.scoreSum += effective;
      byDept.get(e.deptName)!.scoreCount++;
    }
  }
  for (const t of tasksAll) {
    const agg = byDept.get(deptOf.get(t.assigneeId)!);
    if (agg) agg.total++;
  }
  for (const t of closedTasksAll) {
    const agg = byDept.get(deptOf.get(t.assigneeId)!);
    if (agg) {
      agg.closed++;
      const completedAt = toDate(t.completedAt);
      if (completedAt) agg.activeDays.add(`${t.assigneeId}|${fmtISO(completedAt)}`);
    }
  }

  const rows = [...byDept.values()]
    .map((d) => {
      const avgScore = d.scoreCount ? d.scoreSum / d.scoreCount : 0;
      const completionRate = d.total ? (d.closed / d.total) * 100 : 0;
      const possibleActiveDays = d.people * daysElapsed;
      const consistency = possibleActiveDays ? Math.min(100, (d.activeDays.size / possibleActiveDays) * 100) : 0;
      const productivityIndex = avgScore * 0.5 + completionRate * 0.25 + consistency * 0.25;
      return { ...d, avgScore, completionRate, consistency, productivityIndex };
    })
    .filter((d) => d.people > 0)
    .sort((a, b) => b.productivityIndex - a.productivityIndex);

  const barData = rows.map((r) => ({ name: r.name, score: Math.round(r.productivityIndex) }));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Leaderboard</h1>
        <p className="text-sm text-slate-500">Company-wide — everyone can see who&apos;s leading, by department and individually.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-white">
          <div className="text-xs font-semibold uppercase tracking-wide text-amber-600">⭐ Star of the Week</div>
          {starOfWeek ? (
            <div className="mt-3 flex items-center gap-4">
              <Avatar name={starOfWeek.name} url={starOfWeek.avatarUrl} size={64} ring />
              <div className="min-w-0">
                <div className="truncate text-lg font-bold text-slate-900">{starOfWeek.name}</div>
                <div className="truncate text-sm text-slate-500">{starOfWeek.roleTitle}</div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <Badge className="bg-amber-100 text-amber-700">{starOfWeek.closed} closed</Badge>
                  <Badge className="bg-emerald-100 text-emerald-700">{starOfWeek.onTimeRate}% on time</Badge>
                  <Badge className="bg-blue-100 text-blue-700">index {starOfWeek.index}</Badge>
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-400">No one has closed a task this week yet.</p>
          )}
          <p className="mt-3 text-[11px] text-slate-500">
            Calculated automatically — on-time completion (50%), weekly volume (30%), KPI-bucket coverage (20%). Resets every Monday.
          </p>
        </Card>

        <Card className="border-violet-200 bg-gradient-to-br from-violet-50 to-white">
          <div className="text-xs font-semibold uppercase tracking-wide text-violet-600">
            🏆 Employee of the Month — {lastMonthStart.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
          </div>
          {lastMonthTop ? (
            <div className="mt-3 flex items-center gap-4">
              <Avatar name={lastMonthTop.employee.name} url={lastMonthTop.employee.avatarUrl} size={64} ring />
              <div className="min-w-0">
                <div className="truncate text-lg font-bold text-slate-900">{lastMonthTop.employee.name}</div>
                <div className="truncate text-sm text-slate-500">{lastMonthTop.employee.role?.title}</div>
                <div className="mt-1">
                  <Badge className="bg-violet-100 text-violet-700">Final score {Math.round(lastMonthTop.total)}</Badge>
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-400">No finalized scores for last month yet.</p>
          )}
          <p className="mt-3 text-[11px] text-slate-500">
            The final monthly total — system auto-score plus the manager&apos;s review in the Scoring Panel.
          </p>
        </Card>
      </div>

      {weeklyStars.length > 1 && (
        <Card>
          <SectionTitle>This week — full ranking</SectionTitle>
          <ol className="space-y-1.5">
            {weeklyStars.slice(0, 10).map((r, i) => (
              <li key={r.id} className="flex items-center gap-3">
                <span className={"w-5 text-right text-xs font-bold " + (i === 0 ? "text-amber-600" : "text-slate-400")}>{i + 1}</span>
                <Avatar name={r.name} url={r.avatarUrl} size={28} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{r.name}</div>
                  <div className="truncate text-xs text-slate-500">{r.roleTitle}</div>
                </div>
                <Badge className="bg-slate-100 text-slate-700">{r.closed} closed · {r.onTimeRate}% on time</Badge>
                <Badge className="bg-blue-50 text-blue-700">{r.index}</Badge>
              </li>
            ))}
          </ol>
        </Card>
      )}

      <Card>
        <form className="flex flex-wrap items-end gap-3" method="GET">
          <label className="text-xs font-medium text-slate-600">
            Month
            <input name="date" type="month" defaultValue={monthValue} className="mt-1 block rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
          </label>
          <button className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">Go</button>
          <span className="text-sm text-slate-500">Showing: <strong>{monthLabelStr}</strong></span>
        </form>
      </Card>

      <Card>
        <SectionTitle>Productivity Index (ranked)</SectionTitle>
        {barData.length ? <ScoreBars data={barData} /> : <p className="text-sm text-slate-400">No data yet.</p>}
        <p className="mt-3 text-xs text-slate-500">
          Index = 50% score (manager score if entered, else auto) + 25% task completion rate + 25% consistency (days with completed work ÷ working days in the period).
        </p>
      </Card>

      <Card>
        <SectionTitle>Department breakdown</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="pb-2 font-medium">Rank</th>
                <th className="pb-2 font-medium">Department</th>
                <th className="pb-2 font-medium text-right">People</th>
                <th className="pb-2 font-medium text-right">Avg score</th>
                <th className="pb-2 font-medium text-right">Completion</th>
                <th className="pb-2 font-medium text-right">Consistency</th>
                <th className="pb-2 font-medium text-right">Index</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, i) => (
                <tr key={r.name}>
                  <td className="py-2"><Badge className={i === 0 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"}>#{i + 1}</Badge></td>
                  <td className="py-2 font-medium">{r.name}</td>
                  <td className="py-2 text-right text-slate-600">{r.people}</td>
                  <td className="py-2 text-right text-slate-600">{r.avgScore.toFixed(0)}</td>
                  <td className="py-2 text-right text-slate-600">{r.completionRate.toFixed(0)}%</td>
                  <td className="py-2 text-right text-slate-600">{r.consistency.toFixed(0)}%</td>
                  <td className="py-2 text-right font-semibold text-blue-700">{r.productivityIndex.toFixed(0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="border-amber-100 bg-amber-50/40">
        <p className="text-sm text-amber-800">
          <strong>On ROI (₹ return per employee):</strong> we don&apos;t yet have salary/cost data in the system, so this shows a <em>Productivity Index</em> (0–100) instead of a rupee figure — it would be dishonest to invent a cost number.
        </p>
      </Card>
    </div>
  );
}
