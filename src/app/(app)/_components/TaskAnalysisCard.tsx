import Link from "next/link";
import { Card, SectionTitle, Badge } from "./ui";
import type { DailyTaskAnalysis } from "@/lib/dailyAnalysis";

export default function TaskAnalysisCard({ data }: { data: DailyTaskAnalysis }) {
  const { onTimeToday, lateToday, closedToday, weekOnTimeRate, weekClosed, reworkToday, reworkWeek, openRework,
    urgentImportantOpen, urgentImportantDueToday, mostWorked, leastWorked } = data;

  return (
    <Card>
      <SectionTitle
        action={
          <span className="text-[11px] font-normal normal-case text-slate-400">
            resets daily · based on today&apos;s + this week&apos;s activity
          </span>
        }
      >
        📊 Today&apos;s Task Analysis
      </SectionTitle>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 p-3">
          <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">On time — today</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">
            {onTimeToday}
            <span className="text-sm font-normal text-slate-400">/{closedToday || 0}</span>
          </div>
          {lateToday > 0 && <p className="mt-0.5 text-xs text-red-600">{lateToday} closed late</p>}
          {closedToday === 0 && <p className="mt-0.5 text-xs text-slate-400">nothing closed yet today</p>}
        </div>

        <div className="rounded-xl border border-slate-200 p-3">
          <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">On-time rate — this week</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">
            {weekOnTimeRate != null ? `${weekOnTimeRate}%` : "—"}
          </div>
          <p className="mt-0.5 text-xs text-slate-400">{weekClosed} closed this week</p>
        </div>

        <div className="rounded-xl border border-slate-200 p-3">
          <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Sent back for rework</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">
            {reworkWeek}
            <span className="text-sm font-normal text-slate-400"> this week</span>
          </div>
          {reworkToday > 0 && <p className="mt-0.5 text-xs text-red-600">{reworkToday} today</p>}
          {openRework > 0 && (
            <p className="mt-0.5 text-xs text-amber-600">{openRework} still open, needs redo</p>
          )}
          {reworkWeek === 0 && <p className="mt-0.5 text-xs text-emerald-600">clean record this week 🎯</p>}
        </div>

        <div className="rounded-xl border border-slate-200 p-3">
          <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Urgent &amp; important</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">{urgentImportantOpen}</div>
          <p className="mt-0.5 text-xs text-slate-400">
            open now{urgentImportantDueToday > 0 ? ` · ${urgentImportantDueToday} due today` : ""}
          </p>
        </div>
      </div>

      {(mostWorked || leastWorked) && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-sm">
          <span className="text-slate-500">This week&apos;s KPI focus:</span>
          {mostWorked && (
            <Badge className="bg-blue-100 text-blue-700" title="Most-worked KPI this week">
              💪 Most: {mostWorked.name} ({mostWorked.count})
            </Badge>
          )}
          {leastWorked && (
            <Badge className="bg-amber-100 text-amber-700" title="Least-worked KPI this week — you might be lagging here">
              ⚠️ Lacking: {leastWorked.name} ({leastWorked.count})
            </Badge>
          )}
          <Link href="/board" className="ml-auto text-xs font-medium text-blue-600 hover:underline">
            Open board →
          </Link>
        </div>
      )}
    </Card>
  );
}
