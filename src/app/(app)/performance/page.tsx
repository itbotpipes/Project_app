import { getCurrentUser, isManagerLike } from "@/lib/auth";
import { adminDb } from "@/lib/firebase/admin";
import { monthLabel } from "@/lib/scores";
import { loadEmployeePerformance } from "@/lib/employeePerformance";
import { Card, SectionTitle } from "../_components/ui";
import { ScoreBars } from "../_components/Charts";
import SimplifiedPerformanceView from "../_components/SimplifiedPerformanceView";
import { batchFetchByIds } from "@/lib/cache";

export default async function PerformancePage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const manager = isManagerLike(user.systemRole);

  const [
    performanceData,
    allScorecardsSnap,
    reportsSnap
  ] = await Promise.all([
    loadEmployeePerformance(user.id),
    adminDb.collection("MonthlyScorecard")
      .orderBy("year", "desc")
      .orderBy("month", "desc")
      .limit(1)
      .get(),
    manager ? adminDb.collection("Employee").where("reportsToIds", "array-contains", user.id).where("active", "==", true).get() : Promise.resolve(null)
  ]);

  // Team scores (managers) — latest period
  const allScoresDocs = allScorecardsSnap.docs.sort((a, b) => (b.data().year - a.data().year) || (b.data().month - a.data().month));
  const latestPeriodSnap = { empty: allScoresDocs.length === 0, docs: allScoresDocs.slice(0, 1) };
  const latestPeriod = latestPeriodSnap.empty ? null : latestPeriodSnap.docs[0].data();
  
  let reports: any[] = [];
  if (manager && reportsSnap) {
    const reportIds = reportsSnap.docs ? reportsSnap.docs.map((d: any) => d.id) : [];
    const roleIds = reportsSnap.docs ? reportsSnap.docs.map((d: any) => d.data().roleId).filter(Boolean) as string[] : [];
    
    const [rolesMap, scorecardsSnap] = await Promise.all([
      batchFetchByIds('Role', roleIds, adminDb),
      reportIds.length > 0 ? adminDb.collection("MonthlyScorecard").where("employeeId", "in", reportIds).get() : Promise.resolve({ docs: [] } as any),
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
      const sorted = cards.sort((a: any, b: any) => (b.year - a.year) || (b.month - a.month));
      if (sorted.length > 0) latestScorecards.set(empId, sorted[0]);
    });
    
    reports = reportsSnap.docs ? reportsSnap.docs.map((doc) => {
      const emp = doc.data() as any;
      const roleData = emp.roleId ? (rolesMap.get(emp.roleId) as any) : null;
      const latestScorecard = latestScorecards.get(doc.id) || null;
      return { id: doc.id, name: emp.name, role: roleData, scorecards: latestScorecard ? [latestScorecard] : [] };
    }) : [];
    reports.sort((a: any, b: any) => a.name.localeCompare(b.name));
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

      <SimplifiedPerformanceView
        performanceData={performanceData}
        isManagerOrAdmin={manager}
      />

      {manager && teamBars.length > 0 && (
        <Card className="p-4 sm:p-5">
          <SectionTitle>
            Team scores {latestPeriod ? `· ${monthLabel(latestPeriod.year, latestPeriod.month)}` : ""}
          </SectionTitle>
          <div className="mt-3">
            <ScoreBars data={teamBars} />
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Green ≥ 65 (increment band) · Amber 40–64 · Red &lt; 40.
          </p>
        </Card>
      )}
    </div>
  );
}
