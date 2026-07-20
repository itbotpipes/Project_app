import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { mondayOf } from "@/lib/date";
import { computeWeeklyInsights } from "@/lib/insights";
import { Card, SectionTitle } from "../_components/ui";
import Chat from "./Chat";

export default async function InsightsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const weekStart = mondayOf();
  const [tasks, buckets] = await Promise.all([
    prisma.task.findMany({
      where: { assigneeId: user.id, createdAt: { gte: weekStart } },
      select: { status: true, createdAt: true, completedAt: true, carryCount: true, kpiTemplate: { select: { kpiName: true } } },
    }),
    prisma.kpiTemplate.count({ where: { roleId: user.roleId } }),
  ]);

  const insights = computeWeeklyInsights(
    tasks.map((t) => ({
      status: t.status,
      createdAt: t.createdAt,
      completedAt: t.completedAt,
      carryCount: t.carryCount,
      kpiName: t.kpiTemplate?.kpiName ?? null,
    })),
    buckets,
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">AI Insights</h1>
        <p className="text-sm text-slate-500">
          Your week, reviewed automatically from your tasks — and a coach you can talk to.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-emerald-100 bg-emerald-50/40">
          <SectionTitle>✅ What went well</SectionTitle>
          <ul className="space-y-2 text-sm text-slate-700">
            {insights.wentWell.map((w, i) => (
              <li key={i} className="flex gap-2"><span className="text-emerald-500">•</span>{w}</li>
            ))}
          </ul>
        </Card>
        <Card className="border-amber-100 bg-amber-50/40">
          <SectionTitle>⚠️ What to work on</SectionTitle>
          <ul className="space-y-2 text-sm text-slate-700">
            {insights.needsAttention.length ? (
              insights.needsAttention.map((w, i) => (
                <li key={i} className="flex gap-2"><span className="text-amber-500">•</span>{w}</li>
              ))
            ) : (
              <li className="text-slate-500">Nothing flagged — great week!</li>
            )}
          </ul>
        </Card>
      </div>

      <Card>
        <div className="grid grid-cols-3 gap-3 text-center sm:grid-cols-6">
          {[
            ["Created", insights.stats.created],
            ["Completed", insights.stats.completed],
            ["Carried", insights.stats.carried],
            ["Reopened", insights.stats.rework],
            ["KPI areas", insights.stats.bucketsWorked],
            ["Active days", insights.stats.activeDays],
          ].map(([label, val]) => (
            <div key={label as string}>
              <div className="text-2xl font-semibold">{val as number}</div>
              <div className="text-[11px] uppercase tracking-wide text-slate-400">{label}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle>💬 Talk to your AI coach</SectionTitle>
        <Chat />
      </Card>
    </div>
  );
}
