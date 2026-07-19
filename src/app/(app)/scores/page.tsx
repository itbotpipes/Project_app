import { redirect } from "next/navigation";
import { getCurrentUser, isManagerLike, canScoreCompanyWide } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { mondayOf, monthStartOf, previousMonthStart } from "@/lib/date";
import { Card, SectionTitle, Badge } from "../_components/ui";
import RowForm from "./RowForm";

function fmtISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function ScoresPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; date?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const companyWide = canScoreCompanyWide(user);
  const manager = isManagerLike(user.systemRole);
  if (!companyWide && !manager) redirect("/");

  const sp = await searchParams;
  const period = sp.period === "WEEKLY" ? "WEEKLY" : "MONTHLY";
  const periodStart =
    period === "WEEKLY"
      ? mondayOf(sp.date ? new Date(sp.date) : new Date())
      : sp.date
        ? monthStartOf(new Date(sp.date))
        : previousMonthStart();
  const isoStart = fmtISO(periodStart);
  const monthValue = `${periodStart.getFullYear()}-${String(periodStart.getMonth() + 1).padStart(2, "0")}`;

  // Company-wide scorers see everyone; line managers see only their direct reports.
  const employees = await prisma.employee.findMany({
    where: companyWide ? { active: true } : { active: true, reportsToId: user.id },
    include: { role: { include: { department: true } } },
    orderBy: [{ role: { level: "asc" } }, { name: "asc" }],
  });

  const empIds = employees.map((e) => e.id);
  const [managerScores, autoScores] = await Promise.all([
    prisma.managerScore.findMany({ where: { employeeId: { in: empIds }, period, periodStart } }),
    period === "MONTHLY"
      ? prisma.monthlyScorecard.findMany({
          where: {
            employeeId: { in: empIds },
            year: periodStart.getFullYear(),
            month: periodStart.getMonth() + 1,
          },
        })
      : Promise.resolve([]),
  ]);
  const mScoreMap = new Map(managerScores.map((s) => [s.employeeId, s]));
  const aScoreMap = new Map(autoScores.map((s) => [s.employeeId, s]));

  const byDept = new Map<string, typeof employees>();
  for (const e of employees) {
    const d = e.role.department?.name ?? "Other";
    const arr = byDept.get(d) ?? [];
    arr.push(e);
    byDept.set(d, arr);
  }

  const monthLabel = periodStart.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Performance Scoring Panel</h1>
        <p className="text-sm text-slate-500">
          Two numbers per person: the <strong>Auto score</strong> (computed from their daily task
          routine &amp; KPI buckets) and the <strong>Manager score</strong> (your own assessment out
          of 100, from observation &amp; discussion). Both feed their growth chart.
        </p>
      </div>

      <Card>
        <form className="flex flex-wrap items-end gap-3" method="GET">
          <label className="text-xs font-medium text-slate-600">
            Period
            <select name="period" defaultValue={period} className="mt-1 block rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
              <option value="MONTHLY">Monthly</option>
              <option value="WEEKLY">Weekly</option>
            </select>
          </label>
          <label className="text-xs font-medium text-slate-600">
            {period === "WEEKLY" ? "Any date in the week" : "Month"}
            <input
              name="date"
              type={period === "WEEKLY" ? "date" : "month"}
              defaultValue={period === "WEEKLY" ? isoStart : monthValue}
              className="mt-1 block rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            />
          </label>
          <button className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
            Go
          </button>
          <span className="text-sm text-slate-500">
            Scoring: <strong>{period === "WEEKLY" ? `week of ${isoStart}` : monthLabel}</strong>
          </span>
        </form>
      </Card>

      {[...byDept.entries()].map(([dept, list]) => (
        <Card key={dept}>
          <SectionTitle>{dept}</SectionTitle>
          <div className="space-y-3">
            {list.map((e) => {
              const auto = aScoreMap.get(e.id);
              const man = mScoreMap.get(e.id);
              return (
                <div
                  key={e.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 p-3"
                >
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700">
                    {e.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                  </div>
                  <div className="min-w-[9rem]">
                    <div className="text-sm font-medium">{e.name}</div>
                    <div className="text-xs text-slate-500">{e.role.title}</div>
                  </div>
                  <Badge className="bg-blue-50 text-blue-700" title="Auto-computed from tasks/KPIs this month">
                    Auto: {auto ? Math.round(auto.total) : "—"}
                  </Badge>
                  <Badge className="bg-violet-50 text-violet-700" title="Manager's holistic score">
                    Manager: {man ? Math.round(man.score) : "—"}
                  </Badge>
                  <div className="ml-auto">
                    <RowForm
                      employeeId={e.id}
                      period={period}
                      periodStart={isoStart}
                      initialScore={man?.score ?? null}
                      initialNote={man?.note ?? null}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ))}

      {!employees.length && (
        <Card>
          <p className="text-sm text-slate-400">No one to score yet.</p>
        </Card>
      )}
    </div>
  );
}
