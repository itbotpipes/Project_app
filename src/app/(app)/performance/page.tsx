import { getCurrentUser, isManagerLike } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { incrementBand } from "@/lib/constants";
import { monthLabel, recentAverage } from "@/lib/scores";
import { behaviourPct, behaviourPctFromMany } from "@/lib/behaviour";
import { Card, StatCard, SectionTitle, Badge } from "../_components/ui";
import { DualTrendLine, Donut, Legend, ScoreBars, IncrementBar } from "../_components/Charts";
import BucketFill from "../_components/BucketFill";

function readiness(avg: number) {
  if (avg >= 75) return { label: "Ready for promotion", tone: "bg-emerald-100 text-emerald-700" };
  if (avg >= 65) return { label: "Developing — on track", tone: "bg-blue-100 text-blue-700" };
  if (avg >= 45) return { label: "Needs improvement", tone: "bg-amber-100 text-amber-700" };
  return { label: "Below expectations", tone: "bg-red-100 text-red-700" };
}

export default async function PerformancePage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const manager = isManagerLike(user.systemRole);

  const myCards = await prisma.monthlyScorecard.findMany({
    where: { employeeId: user.id },
    orderBy: [{ year: "asc" }, { month: "asc" }],
  });

  // Trend: system auto total vs the manager-approved final total, month by month
  const trend = myCards.map((c) => ({
    label: monthLabel(c.year, c.month),
    auto: c.autoTotal || null,
    manager: c.total,
  }));

  const latestFinal = myCards[myCards.length - 1];
  const avg = recentAverage(myCards);
  const band = incrementBand(avg);
  const ready = readiness(avg);

  // Annual increment projection (behaviour from HOD/HR/COO reviews + target from yearly review)
  const nowYear = new Date().getFullYear();
  const [review, behaviourAll] = await Promise.all([
    prisma.yearlyReview.findUnique({
      where: { employeeId_year: { employeeId: user.id, year: nowYear } },
    }),
    prisma.behaviourReview.findMany({
      where: { employeeId: user.id },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    }),
  ]);
  const behaviourThisYear = behaviourAll.filter((b) => b.year === nowYear);
  const behaviourYearPct = behaviourPctFromMany(behaviourThisYear); // 0-100 or null
  const behaviourByMonth = new Map(behaviourAll.map((b) => [`${b.year}-${b.month}`, b]));

  const kpiComponent = Math.round((Math.min(100, avg) / 100) * 5 * 10) / 10; // max 5%
  const behaviourComponent =
    behaviourYearPct != null ? Math.round((behaviourYearPct / 100) * 5 * 10) / 10 : null; // max 5%
  const targetComponent =
    review?.targetAchievedPct != null ? Math.round((review.targetAchievedPct / 100) * 10 * 10) / 10 : null; // max 10%
  const incrementTotal =
    kpiComponent + (behaviourComponent ?? 0) + (targetComponent ?? 0);

  // Monthly score history (newest first) — visible to the employee themselves
  const history = [...myCards].reverse().map((c) => {
    const bh = behaviourByMonth.get(`${c.year}-${c.month}`);
    return {
      key: `${c.year}-${c.month}`,
      label: monthLabel(c.year, c.month),
      auto: c.autoTotal,
      total: c.total,
      behaviour: bh ? behaviourPct(bh) / 10 : null, // out of 10
    };
  });

  const myKpis = await prisma.kpiTemplate.findMany({
    where: { roleId: user.roleId },
    orderBy: { orderIndex: "asc" },
  });
  // KPI buckets grouped by KRA for the weightage donut
  const kraMap = new Map<string, number>();
  for (const k of myKpis) kraMap.set(k.kraName, (kraMap.get(k.kraName) ?? 0) + k.weightage);
  const bucketData = [...kraMap.entries()].map(([name, value]) => ({ name, value }));

  // Bucket water-fill: how many tasks landed in each bucket this month
  const startOfMonthKpi = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const monthTasksForFill = await prisma.task.findMany({
    where: { assigneeId: user.id, createdAt: { gte: startOfMonthKpi } },
    select: { kpiTemplateId: true },
  });
  const countByKpi = new Map<string, number>();
  for (const t of monthTasksForFill) {
    if (!t.kpiTemplateId) continue;
    countByKpi.set(t.kpiTemplateId, (countByKpi.get(t.kpiTemplateId) ?? 0) + 1);
  }
  const bucketFillData = myKpis.map((k) => ({ id: k.id, name: k.kpiName, count: countByKpi.get(k.id) ?? 0 }));

  // Team scores (managers) — latest period
  const latestPeriod = await prisma.monthlyScorecard.findFirst({
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });
  const reports = manager
    ? await prisma.employee.findMany({
        where: { reportsToId: user.id, active: true },
        include: {
          role: true,
          scorecards: { orderBy: [{ year: "desc" }, { month: "desc" }], take: 1 },
        },
        orderBy: { name: "asc" },
      })
    : [];
  const teamBars = reports
    .map((r) => ({ name: r.name, score: Math.round(r.scorecards[0]?.total ?? 0) }))
    .filter((r) => r.score > 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Performance</h1>
        <p className="text-sm text-slate-500">
          Objective, month-by-month — the basis for increments and promotions.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="6-month average" value={avg.toFixed(0)} tone="blue" />
        <StatCard
          label="Increment band"
          value={<span className={band.className}>{band.label}</span>}
          sub="per company policy"
        />
        <StatCard
          label="Latest score"
          value={latestFinal ? Math.round(latestFinal.total) : "—"}
          sub={latestFinal ? monthLabel(latestFinal.year, latestFinal.month) : "not yet scored"}
          tone="blue"
        />
        <Card>
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Promotion readiness
          </div>
          <div className="mt-2">
            <Badge className={ready.tone}>{ready.label}</Badge>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Consistency over 6 months drives the band. Aim 75+ for a raise.
          </p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionTitle>Score trend — Auto vs Manager</SectionTitle>
          {trend.length ? (
            <DualTrendLine data={trend} />
          ) : (
            <div className="grid h-[220px] place-items-center text-sm text-slate-400">
              No scores yet.
            </div>
          )}
        </Card>

        <Card>
          <SectionTitle>My KPI buckets (weightage)</SectionTitle>
          <Donut data={bucketData} />
          <Legend data={bucketData} />
        </Card>
      </div>

      <Card>
        <SectionTitle>📅 Monthly score history</SectionTitle>
        {history.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="pb-1 font-medium">Month</th>
                  <th className="pb-1 text-center font-medium">Auto</th>
                  <th className="pb-1 text-center font-medium">Final</th>
                  <th className="pb-1 text-center font-medium">Behaviour</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((h) => (
                  <tr key={h.key}>
                    <td className="py-1.5 font-medium text-slate-700">{h.label}</td>
                    <td className="py-1.5 text-center text-blue-600">{h.auto ? Math.round(h.auto) : "—"}</td>
                    <td className="py-1.5 text-center font-semibold text-violet-700">{Math.round(h.total)}</td>
                    <td className="py-1.5 text-center text-amber-700">
                      {h.behaviour != null ? `${h.behaviour.toFixed(1)}/10` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-400">No monthly scores recorded yet.</p>
        )}
        <p className="mt-3 text-xs text-slate-500">
          Every month is kept on record — this is your full journey. On the 1st you can see the
          previous month&apos;s auto scores; your manager finalises them by the 5th.
        </p>
      </Card>

      <Card>
        <SectionTitle>🔥 What I&apos;ve actually worked on this month</SectionTitle>
        <BucketFill buckets={bucketFillData} />
      </Card>

      <Card>
        <SectionTitle>📈 Annual increment projection ({nowYear})</SectionTitle>
        <IncrementBar
          kpi={kpiComponent}
          behaviour={behaviourComponent ?? 0}
          target={targetComponent ?? 0}
          maxTotal={20}
        />
        <p className="mt-3 text-xs text-slate-500">
          A structured, minimum-increment guide reviewed after a year of data: <b>5%</b> on
          task/KPI performance (from your average score), <b>5%</b> on behaviour, and <b>10%</b> on
          target vs. actual.{" "}
          {behaviourComponent == null || targetComponent == null ? (
            <span className="text-amber-600">
              Behaviour and/or target still need to be set by your manager in the Scoring Panel — until
              then only the KPI portion is shown.
            </span>
          ) : (
            <>
              Your projected minimum increment is{" "}
              <b className="text-slate-800">{Math.round(incrementTotal * 10) / 10}%</b>.
            </>
          )}
        </p>
      </Card>

      {manager && (
        <Card>
          <SectionTitle>
            Team scores {latestPeriod ? `· ${monthLabel(latestPeriod.year, latestPeriod.month)}` : ""}
          </SectionTitle>
          {teamBars.length ? (
            <ScoreBars data={teamBars} />
          ) : (
            <p className="text-sm text-slate-400">No team scores recorded yet.</p>
          )}
          <p className="mt-3 text-xs text-slate-500">
            Green ≥ 65 (increment band) · Amber 40–64 · Red &lt; 40. Scores come from monthly
            KRA scorecards, replacing the manual Excel.
          </p>
        </Card>
      )}
    </div>
  );
}
