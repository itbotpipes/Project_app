import { getCurrentUser, isManagerLike } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { incrementBand } from "@/lib/constants";
import { monthLabel, recentAverage } from "@/lib/scores";
import { Card, StatCard, SectionTitle, Badge } from "../_components/ui";
import { DualTrendLine, Donut, Legend, ScoreBars } from "../_components/Charts";
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
  const myManagerScores = await prisma.managerScore.findMany({
    where: { employeeId: user.id, period: "MONTHLY" },
    orderBy: { periodStart: "asc" },
  });

  // Merge auto + manager scores into one month-by-month trend
  const trendMap = new Map<string, { label: string; auto: number | null; manager: number | null; y: number; m: number }>();
  for (const c of myCards) {
    const key = `${c.year}-${c.month}`;
    trendMap.set(key, { label: monthLabel(c.year, c.month), auto: c.total, manager: null, y: c.year, m: c.month });
  }
  for (const s of myManagerScores) {
    const y = s.periodStart.getFullYear();
    const m = s.periodStart.getMonth() + 1;
    const key = `${y}-${m}`;
    const existing = trendMap.get(key);
    if (existing) existing.manager = s.score;
    else trendMap.set(key, { label: monthLabel(y, m), auto: null, manager: s.score, y, m });
  }
  const trend = [...trendMap.values()].sort((a, b) => (a.y === b.y ? a.m - b.m : a.y - b.y));

  // Manager's holistic score is the number that drives increments when present; else fall back to auto.
  const latestManager = myManagerScores[myManagerScores.length - 1];
  const effectiveCards = myCards.map((c) => {
    const override = myManagerScores.find(
      (s) => s.periodStart.getFullYear() === c.year && s.periodStart.getMonth() + 1 === c.month,
    );
    return { ...c, total: override?.score ?? c.total };
  });
  const avg = recentAverage(effectiveCards.length ? effectiveCards : myCards);
  const band = incrementBand(avg);
  const ready = readiness(avg);

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
          scoresReceived: { where: { period: "MONTHLY" }, orderBy: { periodStart: "desc" }, take: 1 },
        },
        orderBy: { name: "asc" },
      })
    : [];
  // Prefer the manager's holistic score when one exists; fall back to the auto-computed total.
  const teamBars = reports
    .map((r) => ({
      name: r.name,
      score: Math.round(r.scoresReceived[0]?.score ?? r.scorecards[0]?.total ?? 0),
    }))
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
          label="Latest manager score"
          value={latestManager ? Math.round(latestManager.score) : "—"}
          sub={
            latestManager
              ? monthLabel(latestManager.periodStart.getFullYear(), latestManager.periodStart.getMonth() + 1)
              : "not yet scored"
          }
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
        <SectionTitle>🪣 What I&apos;ve actually worked on this month</SectionTitle>
        <BucketFill buckets={bucketFillData} />
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
