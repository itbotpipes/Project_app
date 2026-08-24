import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser, isManagerLike, canScoreCompanyWide, hasPermission } from "@/lib/auth";
import { adminDb } from "@/lib/firebase/admin";
import { monthLabel } from "@/lib/scores";
import { loadEmployeePerformance } from "@/lib/employeePerformance";
import { Card, StatCard, SectionTitle, Badge } from "../../_components/ui";
import { DualTrendLine, Donut, Legend, IncrementBar } from "../../_components/Charts";
import BucketFill from "../../_components/BucketFill";

export default async function EmployeePerformancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return null;
  if (!hasPermission(user, "people")) redirect("/");

  const empDoc = await adminDb.collection("Employee").doc(id).get();
  if (!empDoc.exists) notFound();
  
  let roleData: any = { title: "Unknown", department: null };
  let reportsToName: string | null = null;
  const rawEmp = empDoc.data()!;

  const [roleDoc, reportsToDoc] = await Promise.all([
    rawEmp.roleId ? adminDb.collection("Role").doc(rawEmp.roleId).get() : Promise.resolve(null),
    rawEmp.reportsToId ? adminDb.collection("Employee").doc(rawEmp.reportsToId).get() : Promise.resolve(null),
  ]);

  if (roleDoc?.exists) {
    const role = roleDoc.data()!;
    roleData.title = role.title;
    if (role.departmentId) {
      const deptDoc = await adminDb.collection("Department").doc(role.departmentId).get();
      if (deptDoc.exists) roleData.department = { name: deptDoc.data()!.name };
    }
  }
  if (reportsToDoc?.exists) reportsToName = reportsToDoc.data()!.name;

  const employee: any = { id: empDoc.id, ...rawEmp, role: roleData, reportsToId: rawEmp.reportsToId, reportsTo: reportsToName ? { name: reportsToName } : null };

  // Admin/CEO/HR see anyone; a plain manager only sees their own direct reports.
  const allowed = canScoreCompanyWide(user) || employee.reportsToId === user.id || employee.id === user.id;
  if (!allowed) redirect("/people");

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
  } = await loadEmployeePerformance(id);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Link href="/people" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft size={15} /> Directory
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-slate-200 text-sm font-semibold text-slate-700">
          {employee.name.split(" ").map((p: string) => p[0]).slice(0, 2).join("").toUpperCase()}
        </div>
        <div>
          <h1 className="text-2xl font-semibold">{employee.name}</h1>
          <p className="text-sm text-slate-500">
            {employee.role.title}
            {employee.role.department && <> · {employee.role.department.name}</>}
            {employee.reportsTo && <> · reports to {employee.reportsTo.name}</>}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="6-month average" value={avg.toFixed(0)} tone="blue" />
        <StatCard label="Increment band" value={<span className={band.className}>{band.label}</span>} sub="per company policy" />
        <StatCard
          label="Latest score"
          value={latestFinal ? Math.round(latestFinal.total) : "—"}
          sub={latestFinal ? monthLabel(latestFinal.year, latestFinal.month) : "not yet scored"}
          tone="blue"
        />
        <Card>
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Promotion readiness</div>
          <div className="mt-2">
            <Badge className={ready.tone}>{ready.label}</Badge>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionTitle>Score trend — Auto vs Manager</SectionTitle>
          {trend.length ? (
            <DualTrendLine data={trend} />
          ) : (
            <div className="grid h-[220px] place-items-center text-sm text-slate-400">No scores yet.</div>
          )}
        </Card>
        <Card>
          <SectionTitle>KPI buckets (weightage)</SectionTitle>
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
                    <td className="py-1.5 text-center text-amber-700">{h.behaviour != null ? `${h.behaviour.toFixed(1)}/10` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-400">No monthly scores recorded yet.</p>
        )}
        <p className="mt-3 text-xs text-slate-500">
          Every past month is kept on record — nothing is ever cleared. Use the{" "}
          <Link href="/scores" className="text-blue-600 hover:underline">
            Scoring Panel
          </Link>{" "}
          to adjust any specific month&apos;s figures.
        </p>
      </Card>

      <Card>
        <SectionTitle>🔥 What they&apos;ve worked on this month</SectionTitle>
        <BucketFill buckets={bucketFillData} />
      </Card>

      <Card>
        <SectionTitle>📈 Annual increment projection ({nowYear})</SectionTitle>
        <IncrementBar kpi={kpiComponent} behaviour={behaviourComponent ?? 0} target={targetComponent ?? 0} maxTotal={20} />
        <p className="mt-3 text-xs text-slate-500">
          <b>5%</b> task/KPI performance, <b>5%</b> behaviour, <b>10%</b> target vs. actual.{" "}
          {behaviourComponent == null || targetComponent == null ? (
            <span className="text-amber-600">Behaviour and/or target not yet set for this year.</span>
          ) : (
            <>
              Projected minimum increment: <b className="text-slate-800">{Math.round(incrementTotal * 10) / 10}%</b>.
            </>
          )}
        </p>
      </Card>
    </div>
  );
}
