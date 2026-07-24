import { getCurrentUser, isManagerLike } from "@/lib/auth";
import { adminDb } from "@/lib/firebase/admin";
import { monthLabel } from "@/lib/scores";
import { loadEmployeePerformance } from "@/lib/employeePerformance";
import { Card, StatCard, SectionTitle, Badge } from "../_components/ui";
import { DualTrendLine, Donut, Legend, ScoreBars, IncrementBar } from "../_components/Charts";
import BucketFill from "../_components/BucketFill";

export default async function PerformancePage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const manager = isManagerLike(user.systemRole);

  const {
    trend,
    latestFinal,
    avg,
    band,
    ready,
    nowYear,
    kpiComponent,
    behaviourComponent,
    targetComponent,
    incrementTotal,
    history,
    bucketData,
    bucketFillData,
  } = await loadEmployeePerformance(user.id);

  // Team scores (managers) — latest period
  // Team scores (managers) — latest period
  const allScorecardsSnap = await adminDb.collection("MonthlyScorecard").get();
  const allScoresDocs = allScorecardsSnap.docs.sort((a, b) => (b.data().year - a.data().year) || (b.data().month - a.data().month));
  const latestPeriodSnap = { empty: allScoresDocs.length === 0, docs: allScoresDocs.slice(0, 1) };
  const latestPeriod = latestPeriodSnap.empty ? null : latestPeriodSnap.docs[0].data();
  
  let reports: any[] = [];
  if (manager) {
    const reportsSnap = await adminDb.collection("Employee").where("reportsToId", "==", user.id).where("active", "==", true).get();
    reports = await Promise.all(
      reportsSnap.docs.map(async (doc) => {
        const emp = doc.data() as any;
        let roleData = null;
        let latestScorecard = null;
        const [roleDoc, scorecardsSnap] = await Promise.all([
          emp.roleId ? adminDb.collection("Role").doc(emp.roleId).get() : Promise.resolve(null),
          adminDb.collection("MonthlyScorecard").where("employeeId", "==", doc.id).get(),
        ]);
        if (roleDoc?.exists) roleData = roleDoc.data();
        if (!scorecardsSnap.empty) {
          // Sort in JS and get the latest one
          const sorted = scorecardsSnap.docs.sort((a, b) => (b.data().year - a.data().year) || (b.data().month - a.data().month));
          latestScorecard = sorted[0].data();
        }
        return { id: doc.id, name: emp.name, role: roleData, scorecards: latestScorecard ? [latestScorecard] : [] };
      })
    );
    reports.sort((a, b) => a.name.localeCompare(b.name));
  }
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
