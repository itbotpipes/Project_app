import { redirect } from "next/navigation";
import { getCurrentUser, isManagerLike, canScoreCompanyWide } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { monthStartOf, previousMonthStart } from "@/lib/date";
import { computeAutoScores } from "@/lib/autoscore";
import { Card, SectionTitle, Badge } from "../_components/ui";
import KpiScoreEditor from "./KpiScoreEditor";

export default async function ScoresPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  const companyWide = canScoreCompanyWide(user);
  const manager = isManagerLike(user.systemRole);
  if (!companyWide && !manager) redirect("/");

  const sp = await searchParams;
  const periodStart = sp.date ? monthStartOf(new Date(sp.date)) : previousMonthStart();
  const year = periodStart.getFullYear();
  const month = periodStart.getMonth() + 1;
  const monthEnd = new Date(year, month, 1);
  const monthValue = `${year}-${String(month).padStart(2, "0")}`;
  const monthLabel = periodStart.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  const employees = await prisma.employee.findMany({
    where: companyWide ? { active: true } : { active: true, reportsToId: user.id },
    include: { role: { include: { department: true } } },
    orderBy: [{ role: { level: "asc" } }, { name: "asc" }],
  });
  const empIds = employees.map((e) => e.id);

  const [kpiTemplates, existingScores, tasks, reviews, behaviourReviews] = await Promise.all([
    prisma.kpiTemplate.findMany({
      where: { roleId: { in: [...new Set(employees.map((e) => e.roleId))] } },
      orderBy: { orderIndex: "asc" },
    }),
    prisma.monthlyScore.findMany({ where: { employeeId: { in: empIds }, year, month } }),
    prisma.task.findMany({
      where: { assigneeId: { in: empIds }, createdAt: { gte: periodStart, lt: monthEnd } },
      select: { assigneeId: true, kpiTemplateId: true, status: true, createdAt: true, completedAt: true, carryCount: true },
    }),
    prisma.yearlyReview.findMany({ where: { employeeId: { in: empIds }, year } }),
    prisma.behaviourReview.findMany({ where: { employeeId: { in: empIds }, year, month } }),
  ]);

  const kpisByRole = new Map<string, typeof kpiTemplates>();
  for (const k of kpiTemplates) {
    const arr = kpisByRole.get(k.roleId) ?? [];
    arr.push(k);
    kpisByRole.set(k.roleId, arr);
  }
  const tasksByEmp = new Map<string, typeof tasks>();
  for (const t of tasks) {
    const arr = tasksByEmp.get(t.assigneeId) ?? [];
    arr.push(t);
    tasksByEmp.set(t.assigneeId, arr);
  }
  const scoreKey = (e: string, k: string) => `${e}|${k}`;
  const scoreMap = new Map(existingScores.map((s) => [scoreKey(s.employeeId, s.kpiTemplateId), s]));
  const reviewMap = new Map(reviews.map((r) => [r.employeeId, r]));
  const behaviourMap = new Map(behaviourReviews.map((b) => [b.employeeId, b]));

  const byDept = new Map<string, typeof employees>();
  for (const e of employees) {
    const d = e.role.department?.name ?? "Other";
    const arr = byDept.get(d) ?? [];
    arr.push(e);
    byDept.set(d, arr);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Performance Scoring Panel</h1>
        <p className="text-sm text-slate-500">
          Each KPI is scored <strong>automatically</strong> from the employee&apos;s tasks
          (completion, consistency, no rework). You review and adjust each one — the total rolls up
          to their scorecard and shows on their Performance panel.
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
            Scoring: <strong>{monthLabel}</strong>
          </span>
        </form>
      </Card>

      {[...byDept.entries()].map(([dept, list]) => (
        <Card key={dept}>
          <SectionTitle>{dept}</SectionTitle>
          <div className="space-y-3">
            {list.map((e) => {
              const kpis = kpisByRole.get(e.roleId) ?? [];
              const auto = computeAutoScores(
                kpis.map((k) => ({ id: k.id, weightage: k.weightage })),
                tasksByEmp.get(e.id) ?? [],
              );
              const rows = kpis.map((k) => {
                const existing = scoreMap.get(scoreKey(e.id, k.id));
                const a = auto.get(k.id);
                return {
                  id: k.id,
                  name: k.kpiName,
                  kra: k.kraName,
                  weightage: k.weightage,
                  auto: a?.auto ?? 0,
                  tasks: a?.total ?? 0,
                  current: existing ? existing.score : null,
                  saved: !!existing,
                };
              });
              const autoTotal = rows.reduce((s, r) => s + r.auto, 0);
              const finalTotal = rows.reduce((s, r) => s + (r.current ?? r.auto), 0);
              const anySaved = rows.some((r) => r.saved);
              const review = reviewMap.get(e.id);
              const bh = behaviourMap.get(e.id);

              return (
                <details key={e.id} className="rounded-xl border border-slate-200">
                  <summary className="flex cursor-pointer flex-wrap items-center gap-3 p-3">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700">
                      {e.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                    </div>
                    <div className="min-w-[9rem]">
                      <div className="text-sm font-medium">{e.name}</div>
                      <div className="text-xs text-slate-500">{e.role.title}</div>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                      <Badge className="bg-blue-50 text-blue-700" title="System auto total">
                        Auto {Math.round(autoTotal)}
                      </Badge>
                      <Badge
                        className={anySaved ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-400"}
                        title="Final total after your review"
                      >
                        Final {Math.round(finalTotal)}
                      </Badge>
                      <span className="text-xs text-slate-400">▼</span>
                    </div>
                  </summary>
                  <div className="border-t border-slate-100 p-3">
                    <KpiScoreEditor
                      employeeId={e.id}
                      employeeName={e.name}
                      year={year}
                      month={month}
                      rows={rows}
                      behaviour={
                        bh
                          ? {
                              attendance: bh.attendance,
                              punctuality: bh.punctuality,
                              learning: bh.learning,
                              helpfulness: bh.helpfulness,
                              trust: bh.trust,
                              conduct: bh.conduct,
                              note: bh.note,
                            }
                          : null
                      }
                      targetAchievedPct={review?.targetAchievedPct ?? null}
                    />
                  </div>
                </details>
              );
            })}
          </div>
        </Card>
      ))}

      {!employees.length && (
        <Card>
          <p className="text-sm text-slate-400">No one to score.</p>
        </Card>
      )}
    </div>
  );
}
