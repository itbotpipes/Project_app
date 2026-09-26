"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Award, CheckCircle2, AlertCircle, Clock, RotateCcw, Target, Sparkles, TrendingUp } from "lucide-react";
import type { KpiPerformanceAnalyticsSummary, KpiBucketAnalytics } from "@/lib/kpiPoints";
import TaskLink from "./TaskLink";
import { Badge } from "./ui";

const STATUS_COLOR: Record<string, string> = {
  NEW: "bg-slate-100 text-slate-600",
  ACCEPTED: "bg-sky-100 text-sky-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  ON_HOLD: "bg-amber-100 text-amber-700",
  PENDING_REVIEW: "bg-violet-100 text-violet-700",
  CLOSED: "bg-emerald-100 text-emerald-700",
  REOPENED: "bg-red-100 text-red-700",
};

export default function KpiAnalyticsSection({
  analytics,
}: {
  analytics: KpiPerformanceAnalyticsSummary;
}) {
  const [expandedKpiId, setExpandedKpiId] = useState<string | null>(
    analytics.buckets.find((b) => b.totalTasks > 0)?.kpiId ?? analytics.buckets[0]?.kpiId ?? null
  );
  const [searchQuery, setSearchQuery] = useState("");

  const filteredBuckets = analytics.buckets.filter((b) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      b.kpiName.toLowerCase().includes(q) ||
      b.kraName.toLowerCase().includes(q) ||
      b.tasks.some((t) => t.title?.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Overview Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-slate-400">
            <span>KPI Points Earned</span>
            <Target className="h-4 w-4 text-violet-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-violet-700">{analytics.totalPointsEarned}</span>
            <span className="text-sm font-medium text-slate-400">/ {analytics.totalPointsMax} pts</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-violet-600 transition-all duration-500"
              style={{ width: `${Math.min(100, (analytics.totalPointsEarned / analytics.totalPointsMax) * 100)}%` }}
            />
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            {analytics.overallEfficiencyPct}% point yield this month
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-slate-400">
            <span>Tasks Completed</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-slate-900">{analytics.completedTasks}</span>
            <span className="text-sm font-medium text-slate-400">/ {analytics.totalTasks} tasks</span>
          </div>
          <p className="mt-3 text-[11px] text-slate-500">
            {analytics.totalTasks > 0
              ? `${Math.round((analytics.completedTasks / analytics.totalTasks) * 100)}% completion rate`
              : "No tasks logged yet"}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-slate-400">
            <span>Active Work Days</span>
            <Clock className="h-4 w-4 text-blue-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-blue-600">{analytics.activeDaysTotal}</span>
            <span className="text-sm font-medium text-slate-400">days active</span>
          </div>
          <p className="mt-3 text-[11px] text-slate-500">
            Consistent daily task rhythm
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-slate-400">
            <span>Top Performing KPI</span>
            <Award className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 truncate font-semibold text-slate-800">
            {analytics.topPerformingKpi ? analytics.topPerformingKpi.name : "—"}
          </div>
          <p className="mt-3 text-[11px] text-slate-500">
            {analytics.topPerformingKpi
              ? `${analytics.topPerformingKpi.points} / ${analytics.topPerformingKpi.weightage} pts earned`
              : "Keep working buckets"}
          </p>
        </div>
      </div>

      {/* KPI Buckets & Tasks Drilldown */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              KPI Buckets &amp; Individual Task Points Breakdown
            </h2>
            <p className="text-xs text-slate-500">
              Click any KPI bucket to expand and see exact points awarded per individual task.
            </p>
          </div>
          <div>
            <input
              type="text"
              placeholder="Search KPI or task..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-violet-500 focus:bg-white focus:outline-none"
            />
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {filteredBuckets.map((bucket) => {
            const isExpanded = expandedKpiId === bucket.kpiId;
            const hasTasks = bucket.tasks.length > 0;
            const yieldPct = bucket.weightage > 0 ? (bucket.pointsEarned / bucket.weightage) * 100 : 0;

            return (
              <div key={bucket.kpiId} className="transition-colors hover:bg-slate-50/50">
                {/* KPI Bucket Summary Row */}
                <button
                  type="button"
                  onClick={() => setExpandedKpiId(isExpanded ? null : bucket.kpiId)}
                  className="flex w-full items-center justify-between gap-3 p-4 text-left transition-all"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="text-slate-400">
                      {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">{bucket.kpiName}</span>
                        {bucket.kraName && (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                            {bucket.kraName}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span>{bucket.totalTasks} task{bucket.totalTasks === 1 ? "" : "s"}</span>
                        <span>•</span>
                        <span className="text-emerald-600 font-medium">{bucket.completedTasks} completed</span>
                        {bucket.reworkCount > 0 && (
                          <>
                            <span>•</span>
                            <span className="text-red-500 font-medium">{bucket.reworkCount} rework/carried</span>
                          </>
                        )}
                        <span>•</span>
                        <span>{bucket.activeDays} active day{bucket.activeDays === 1 ? "" : "s"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Points & Progress */}
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="hidden sm:block text-right">
                      <div className="flex items-baseline justify-end gap-1">
                        <span className="text-base font-bold text-violet-700">{bucket.pointsEarned}</span>
                        <span className="text-xs text-slate-400">/ {bucket.weightage} pts</span>
                      </div>
                      <div className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className={`h-full rounded-full ${
                            yieldPct >= 75 ? "bg-emerald-500" : yieldPct >= 50 ? "bg-blue-500" : yieldPct > 0 ? "bg-amber-500" : "bg-slate-300"
                          }`}
                          style={{ width: `${Math.min(100, yieldPct)}%` }}
                        />
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                        yieldPct >= 75
                          ? "bg-emerald-100 text-emerald-800"
                          : yieldPct >= 50
                          ? "bg-blue-100 text-blue-800"
                          : yieldPct > 0
                          ? "bg-amber-100 text-amber-800"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {bucket.pointsEarned} / {bucket.weightage} pts
                    </span>
                  </div>
                </button>

                {/* Expanded Individual Tasks List */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/80 px-4 py-3">
                    {/* Bucket Factors Breakdown */}
                    <div className="mb-3 grid grid-cols-3 gap-2 rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-600">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-medium">Completion (60%)</span>
                        <span className="font-semibold text-slate-800">
                          {bucket.totalTasks > 0 ? `${Math.round((bucket.completedTasks / bucket.totalTasks) * 100)}%` : "0%"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-medium">Consistency (25%)</span>
                        <span className="font-semibold text-slate-800">{bucket.consistencyScore}% ({bucket.activeDays}/6 days)</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-medium">Quality/No Rework (15%)</span>
                        <span className="font-semibold text-slate-800">
                          {bucket.totalTasks > 0 ? `${Math.round(Math.max(0, 1 - bucket.reworkCount / bucket.totalTasks) * 100)}%` : "100%"}
                        </span>
                      </div>
                    </div>

                    {hasTasks ? (
                      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                              <th className="py-2.5 pl-3 pr-2">Task Name</th>
                              <th className="px-2 py-2.5">Status</th>
                              <th className="px-2 py-2.5">Size / Effort</th>
                              <th className="px-2 py-2.5">Timeliness</th>
                              <th className="px-2 py-2.5">Quality / Rework</th>
                              <th className="py-2.5 pl-2 pr-3 text-right">Task KPI Points</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {bucket.tasks.map((t) => {
                              const res = t.pointsResult;
                              const isCompleted = t.status === "CLOSED";

                              return (
                                <tr key={t.id} className="hover:bg-slate-50/60">
                                  <td className="py-2 pl-3 pr-2 font-medium text-slate-900">
                                    <TaskLink
                                      taskId={t.id}
                                      className="hover:text-blue-600 hover:underline"
                                    >
                                      {t.title || "Untitled Task"}
                                    </TaskLink>
                                  </td>
                                  <td className="px-2 py-2">
                                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_COLOR[t.status] ?? "bg-slate-100 text-slate-700"}`}>
                                      {t.status.replace("_", " ")}
                                    </span>
                                  </td>
                                  <td className="px-2 py-2 text-slate-600">
                                    {t.sizeLabel ? (
                                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] uppercase font-medium">
                                        {t.sizeLabel}
                                      </span>
                                    ) : t.estimatedMins ? (
                                      <span>{t.estimatedMins}m</span>
                                    ) : (
                                      <span className="text-slate-400">Medium</span>
                                    )}
                                  </td>
                                  <td className="px-2 py-2">
                                    {res.isOnTime === true ? (
                                      <span className="inline-flex items-center gap-1 font-medium text-emerald-600">
                                        <CheckCircle2 size={12} /> On-time
                                      </span>
                                    ) : res.isOnTime === false ? (
                                      <span className="inline-flex items-center gap-1 font-medium text-amber-600">
                                        <AlertCircle size={12} /> Delayed
                                      </span>
                                    ) : (
                                      <span className="text-slate-400">—</span>
                                    )}
                                  </td>
                                  <td className="px-2 py-2">
                                    {(t.reworkCount ?? 0) > 0 || t.status === "REOPENED" ? (
                                      <span className="inline-flex items-center gap-1 font-medium text-red-600">
                                        <RotateCcw size={11} /> {t.reworkCount}× rework
                                      </span>
                                    ) : (t.carryCount ?? 0) > 0 ? (
                                      <span className="inline-flex items-center gap-1 font-medium text-amber-600">
                                        ↻ {t.carryCount}× carried
                                      </span>
                                    ) : (
                                      <span className="text-emerald-600 font-medium">Clean</span>
                                    )}
                                  </td>
                                  <td className="py-2 pl-2 pr-3 text-right">
                                    <div className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-0.5 border border-violet-100">
                                      <Sparkles size={11} className="text-violet-600" />
                                      <span className="font-bold text-violet-700">{res.earnedPoints}</span>
                                      <span className="text-[10px] text-slate-400">/ {res.maxPoints} pts</span>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
                        No tasks logged in this KPI bucket yet for this month.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
