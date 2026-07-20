import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { monthStartOf, previousMonthStart } from "@/lib/date";
import { Card, SectionTitle, Badge } from "../_components/ui";
import { ScoreBars } from "../_components/Charts";

function fmtISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!(user.systemRole === "ADMIN" || user.systemRole === "CEO")) redirect("/");

  const sp = await searchParams;
  const periodStart = sp.date ? monthStartOf(new Date(sp.date)) : previousMonthStart();
  const periodEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 1);
  const monthLabelStr = periodStart.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const monthValue = `${periodStart.getFullYear()}-${String(periodStart.getMonth() + 1).padStart(2, "0")}`;

  const employees = await prisma.employee.findMany({
    where: { active: true },
    include: { role: { include: { department: true } } },
  });
  const empIds = employees.map((e) => e.id);

  const [scorecards, tasksInPeriod, closedTasks] = await Promise.all([
    prisma.monthlyScorecard.findMany({
      where: { employeeId: { in: empIds }, year: periodStart.getFullYear(), month: periodStart.getMonth() + 1 },
    }),
    prisma.task.findMany({
      where: { assigneeId: { in: empIds }, createdAt: { gte: periodStart, lt: periodEnd } },
      select: { assigneeId: true, status: true },
    }),
    prisma.task.findMany({
      where: {
        assigneeId: { in: empIds },
        status: "CLOSED",
        completedAt: { gte: periodStart, lt: periodEnd },
      },
      select: { assigneeId: true, completedAt: true },
    }),
  ]);

  // Final scorecard total already reflects the manager's per-KPI review.
  const scoreMap = new Map(scorecards.map((s) => [s.employeeId, s.total]));

  const daysElapsed = Math.max(
    1,
    Math.min(
      Math.ceil((Math.min(Date.now(), periodEnd.getTime()) - periodStart.getTime()) / 86400000),
      31,
    ),
  );

  type DeptAgg = {
    name: string;
    people: number;
    scoreSum: number;
    scoreCount: number;
    total: number;
    closed: number;
    activeDays: Set<string>; // "employeeId|yyyy-mm-dd"
  };
  const byDept = new Map<string, DeptAgg>();
  const deptOf = new Map<string, string>();

  for (const e of employees) {
    const dName = e.role.department?.name ?? "Other";
    deptOf.set(e.id, dName);
    if (!byDept.has(dName)) {
      byDept.set(dName, { name: dName, people: 0, scoreSum: 0, scoreCount: 0, total: 0, closed: 0, activeDays: new Set() });
    }
    byDept.get(dName)!.people++;
  }
  for (const e of employees) {
    const agg = byDept.get(deptOf.get(e.id)!)!;
    const effective = scoreMap.get(e.id);
    if (effective != null) {
      agg.scoreSum += effective;
      agg.scoreCount++;
    }
  }
  for (const t of tasksInPeriod) {
    const agg = byDept.get(deptOf.get(t.assigneeId)!);
    if (agg) agg.total++;
  }
  for (const t of closedTasks) {
    const agg = byDept.get(deptOf.get(t.assigneeId)!);
    if (agg) {
      agg.closed++;
      agg.activeDays.add(`${t.assigneeId}|${fmtISO(t.completedAt!)}`);
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
        <h1 className="text-2xl font-semibold">Department Leaderboard</h1>
        <p className="text-sm text-slate-500">
          Which department is performing best — by score, task completion, and day-to-day consistency.
        </p>
      </div>

      <Card>
        <form className="flex flex-wrap items-end gap-3" method="GET">
          <label className="text-xs font-medium text-slate-600">
            Month
            <input
              name="date"
              type="month"
              defaultValue={monthValue}
              className="mt-1 block rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            />
          </label>
          <button className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
            Go
          </button>
          <span className="text-sm text-slate-500">
            Showing: <strong>{monthLabelStr}</strong>
          </span>
        </form>
      </Card>

      <Card>
        <SectionTitle>Productivity Index (ranked)</SectionTitle>
        {barData.length ? <ScoreBars data={barData} /> : <p className="text-sm text-slate-400">No data yet.</p>}
        <p className="mt-3 text-xs text-slate-500">
          Index = 50% score (manager score if entered, else auto) + 25% task completion rate + 25%
          consistency (days with completed work ÷ working days in the period).
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
                  <td className="py-2">
                    <Badge className={i === 0 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"}>
                      #{i + 1}
                    </Badge>
                  </td>
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
          <strong>On ROI (₹ return per employee):</strong> we don&apos;t yet have salary/cost data
          in the system, so this shows a <em>Productivity Index</em> (0–100) instead of a rupee
          figure — it would be dishonest to invent a cost number. Once you share per-employee cost
          (via Admin, or the fuller roster sheet), this page can convert straight into a real ₹
          ROI view.
        </p>
      </Card>
    </div>
  );
}
