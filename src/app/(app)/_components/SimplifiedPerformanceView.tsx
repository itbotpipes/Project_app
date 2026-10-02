"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Target,
  TrendingUp,
  Calendar,
  Flame,
  BookOpen,
  HelpCircle,
  X,
  Layers,
} from "lucide-react";
import { DualTrendLine, IncrementBar, type TrendPoint } from "./Charts";
import BucketFill from "./BucketFill";
import TaskLink from "./TaskLink";
import { Card, SectionTitle, Badge } from "./ui";
import { monthLabel } from "@/lib/scores";
import type { KpiPerformanceAnalyticsSummary, KpiBucketAnalytics } from "@/lib/kpiPoints";

type SimplifiedPerformanceProps = {
  employeeName?: string;
  roleTitle?: string;
  departmentName?: string | null;
  reportsToName?: string | null;
  performanceData: {
    employee: any;
    trend: TrendPoint[];
    latestFinal: any;
    avg: number;
    band: { label: string; className: string };
    ready: { label: string; tone: string };
    nowYear: number;
    kpiComponent: number;
    behaviourComponent: number | null;
    targetComponent: number | null;
    incrementTotal: number;
    incrementMetadata?: {
      scoringModel: string;
      maxTotalPct: number;
      projectedTotalPct: number;
      components: Array<{
        key: string;
        label: string;
        maxPct: number;
        valuePct: number | null;
        formula: string;
        basis: string;
      }>;
    };
    history: Array<{
      key: string;
      label: string;
      auto: number;
      total: number;
      behaviour: number | null;
    }>;
    bucketData: Array<{ name: string; value: number }>;
    bucketFillData: Array<{ id: string; name: string; count: number }>;
    kpiAnalytics: KpiPerformanceAnalyticsSummary | null;
  };
  isManagerOrAdmin?: boolean;
};

export default function SimplifiedPerformanceView({
  employeeName,
  roleTitle,
  departmentName,
  reportsToName,
  performanceData,
  isManagerOrAdmin = false,
}: SimplifiedPerformanceProps) {
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
    incrementMetadata,
    history,
    bucketFillData,
    kpiAnalytics,
  } = performanceData;

  // Calculation explanation modal/popover state
  const [showCalculationModal, setShowCalculationModal] = useState(false);

  // Accordion states for secondary sections
  const [expandedKpiId, setExpandedKpiId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showIncrement, setShowIncrement] = useState(false);
  const [showBucketFill, setShowBucketFill] = useState(false);
  const [showRules, setShowRules] = useState(false);

  // Live Score Calculation derived from Analytics metadata
  const liveMeta = kpiAnalytics?.liveScoreMetadata;
  const totalEarned = liveMeta?.earnedPoints ?? kpiAnalytics?.totalPointsEarned ?? 0;
  const totalPossible = liveMeta?.possiblePoints ?? ((kpiAnalytics?.totalPointsMax && kpiAnalytics.totalPointsMax > 0) ? kpiAnalytics.totalPointsMax : 100);
  const liveScore = liveMeta?.scorePct ?? (totalPossible > 0 ? Math.max(0, Math.min(100, Math.round((totalEarned / totalPossible) * 1000) / 10)) : 0);

  // Sort KPI buckets: Active/worked KPIs first, then by weightage
  const sortedBuckets = kpiAnalytics
    ? [...kpiAnalytics.buckets].sort((a, b) => {
        if (a.totalTasks > 0 && b.totalTasks === 0) return -1;
        if (a.totalTasks === 0 && b.totalTasks > 0) return 1;
        if (b.pointsEarned !== a.pointsEarned) return b.pointsEarned - a.pointsEarned;
        return b.weightage - a.weightage;
      })
    : [];

  // Plain-English Score Drivers (Derived from real active components)
  const totalTasks = kpiAnalytics?.totalTasks ?? 0;
  const completedTasks = kpiAnalytics?.completedTasks ?? 0;
  const completionPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const activeDays = kpiAnalytics?.activeDaysTotal ?? 0;
  const reworkCount = kpiAnalytics?.buckets.reduce((sum, b) => sum + b.reworkCount, 0) ?? 0;
  const activeKpiCount = kpiAnalytics?.buckets.filter((b) => b.totalTasks > 0).length ?? 0;
  const totalKpiCount = kpiAnalytics?.buckets.length ?? 0;

  return (
    <div className="space-y-6">
      {/* ── 1. Top Summary Cards ────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Current Performance */}
        <div className="relative rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/70 to-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-700">
              Current Performance
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-800">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-600" />
              Live this month
            </span>
          </div>

          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold tracking-tight text-blue-900">
              {liveScore.toFixed(1)}
            </span>
            <span className="text-xs font-medium text-blue-600">/ 100</span>
          </div>

          <div className="mt-1 flex items-center justify-between text-xs text-slate-600">
            <span>{totalEarned} earned / {totalPossible} possible</span>
            <button
              type="button"
              onClick={() => setShowCalculationModal(true)}
              className="inline-flex items-center gap-0.5 text-[11px] font-medium text-blue-600 hover:text-blue-800 hover:underline"
            >
              <HelpCircle size={12} />
              How calculated?
            </button>
          </div>
        </div>

        {/* Card 2: 6-Month Average */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              6-Month Average
            </span>
            <Badge className={ready.tone}>{ready.label}</Badge>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold tracking-tight text-slate-900">
              {avg.toFixed(0)}
            </span>
            <span className="text-xs font-medium text-slate-400">/ 100</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Average of last 6 finalized months
          </p>
        </div>

        {/* Card 3: Increment Status */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Increment Status
          </div>
          <div className="mt-2">
            <span className={`inline-block font-semibold ${band.className}`}>
              {band.label}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            per company policy (aim 75+ for top band)
          </p>
        </div>

        {/* Card 4: Latest Finalized */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Latest Finalized
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold tracking-tight text-slate-900">
              {latestFinal ? Math.round(latestFinal.total) : "—"}
            </span>
            {latestFinal && <span className="text-xs font-medium text-slate-400">/ 100</span>}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {latestFinal ? monthLabel(latestFinal.year, latestFinal.month) : "Not yet scored"}
          </p>
        </div>
      </div>

      {/* ── 2. Performance Trend ────────────────────────────────────────── */}
      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionTitle>Performance Trend</SectionTitle>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-600" /> Auto / Live
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-violet-500" /> Finalized
            </span>
          </div>
        </div>

        <div className="mt-3">
          {trend.length ? (
            <DualTrendLine data={trend} />
          ) : (
            <div className="grid h-[200px] place-items-center text-sm text-slate-400">
              No performance data yet.
            </div>
          )}
        </div>
      </Card>

      {/* ── 3. Where Score Comes From & What Affected Score ──────────────── */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left 3 cols: Where your score comes from */}
        <Card className="p-4 sm:p-5 lg:col-span-3">
          <div className="flex items-center justify-between">
            <div>
              <SectionTitle>Where your score comes from</SectionTitle>
              <p className="text-xs text-slate-500">
                Current month KPI breakdown by weightage. Click any row to view its exact formula components.
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
              {activeKpiCount} active of {totalKpiCount}
            </span>
          </div>

          <div className="mt-4 divide-y divide-slate-100">
            {sortedBuckets.map((bucket) => {
              const isExpanded = expandedKpiId === bucket.kpiId;
              const pct = bucket.weightage > 0 ? (bucket.pointsEarned / bucket.weightage) * 100 : 0;
              const meta = bucket.calculationMetadata;

              return (
                <div key={bucket.kpiId} className="py-2.5 transition-colors">
                  <button
                    type="button"
                    onClick={() => setExpandedKpiId(isExpanded ? null : bucket.kpiId)}
                    className="flex w-full items-center justify-between gap-3 text-left hover:bg-slate-50/70 p-1.5 rounded-lg"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </span>
                        <span className="truncate text-sm font-medium text-slate-800">
                          {bucket.kpiName}
                        </span>
                        {bucket.kraName && (
                          <span className="hidden sm:inline-block rounded bg-slate-100 px-1.5 py-0.2 text-[10px] text-slate-500">
                            {bucket.kraName}
                          </span>
                        )}
                      </div>

                      {/* Progress Bar */}
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              pct >= 75
                                ? "bg-emerald-500"
                                : pct >= 40
                                ? "bg-blue-500"
                                : pct > 0
                                ? "bg-amber-500"
                                : "bg-slate-200"
                            }`}
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Score value */}
                    <div className="text-right shrink-0">
                      <span className="text-xs font-semibold text-slate-800">
                        {bucket.pointsEarned.toFixed(1)}
                      </span>
                      <span className="text-[11px] text-slate-400"> / {bucket.weightage}</span>
                    </div>
                  </button>

                  {/* Expandable Details for this KPI */}
                  {isExpanded && (
                    <div className="mt-2 rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-xs space-y-3">
                      {/* Formula Header */}
                      {meta?.formulaDescription && (
                        <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600 bg-white p-2 rounded-lg border border-slate-200">
                          <Layers size={13} className="text-blue-600 shrink-0" />
                          <span>Formula: {meta.formulaDescription}</span>
                        </div>
                      )}

                      {/* Dynamic Component Factor Breakdown */}
                      {meta?.components?.length ? (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          {meta.components.map((comp) => (
                            <div key={comp.key} className="rounded-lg bg-white p-2.5 border border-slate-200">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-semibold text-slate-700">{comp.label}</span>
                                <span className="text-[10px] font-medium text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                                  {comp.weightPct}% weight
                                </span>
                              </div>
                              <div className="mt-1 flex items-baseline justify-between">
                                <span className="text-sm font-bold text-slate-900">{comp.ratePct}%</span>
                                <span className="text-[11px] font-semibold text-violet-700">{comp.contributionPoints.toFixed(1)} pts</span>
                              </div>
                              <p className="mt-1 text-[10px] text-slate-500 truncate" title={comp.rawMetric}>
                                {comp.rawMetric}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {/* Individual Tasks List */}
                      {bucket.tasks.length > 0 && (
                        <div>
                          <div className="font-semibold text-[11px] text-slate-700 mb-1.5">
                            Individual Tasks in this Bucket ({bucket.tasks.length}):
                          </div>
                          <div className="space-y-1.5">
                            {bucket.tasks.map((t) => {
                              const tMeta = t.pointsResult.calculationMetadata;

                              return (
                                <div
                                  key={t.id}
                                  className="rounded-lg bg-white p-2.5 border border-slate-200 text-xs space-y-1.5"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <TaskLink taskId={t.id} className="truncate font-semibold text-blue-600 hover:underline">
                                      {t.title || "Untitled task"}
                                    </TaskLink>
                                    <div className="flex items-center gap-2 shrink-0 text-[11px]">
                                      <span className="text-slate-500 capitalize">{t.status.toLowerCase().replace(/_/g, " ")}</span>
                                      <span className="font-bold text-violet-700">{t.pointsResult.earnedPoints.toFixed(1)} / {t.pointsResult.maxPoints} pts</span>
                                    </div>
                                  </div>

                                  {/* Dynamic Task Component Breakdown */}
                                  {tMeta?.components?.length ? (
                                    <div className="flex flex-wrap gap-1.5 text-[10px]">
                                      {tMeta.components.map((tc) => (
                                        <span
                                          key={tc.key}
                                          className="inline-flex items-center gap-1 rounded bg-slate-50 px-2 py-0.5 border border-slate-200 text-slate-600"
                                          title={tc.description}
                                        >
                                          <span className="font-medium text-slate-700">{tc.label} ({tc.weightPct}%):</span>
                                          <span className="font-semibold text-slate-900">{tc.contributionPoints.toFixed(1)} pts</span>
                                          <span className="text-slate-400">({tc.rawMetric})</span>
                                        </span>
                                      ))}
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {!sortedBuckets.length && (
              <p className="py-4 text-center text-xs text-slate-400">
                No KPI buckets assigned.
              </p>
            )}
          </div>
        </Card>

        {/* Right 2 cols: What affected your score */}
        <Card className="p-4 sm:p-5 lg:col-span-2">
          <SectionTitle>What affected your score</SectionTitle>
          <p className="text-xs text-slate-500 mb-3">
            Real performance drivers from current month activity.
          </p>

          <div className="space-y-2.5">
            {/* Insight 1: Tasks Completion */}
            <div className="flex items-start gap-2.5 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />
              <div className="text-xs text-slate-700">
                <span className="font-semibold text-slate-900">
                  {completedTasks} of {totalTasks} tasks completed
                </span>
                <p className="text-slate-500 mt-0.5">
                  {totalTasks > 0 ? `${completionPct}% task completion rate (drives 60% completion weight).` : "No tasks logged this month yet."}
                </p>
              </div>
            </div>

            {/* Insight 2: Work Consistency */}
            <div className="flex items-start gap-2.5 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
              <Clock size={16} className="mt-0.5 shrink-0 text-blue-600" />
              <div className="text-xs text-slate-700">
                <span className="font-semibold text-slate-900">
                  {activeDays} active work day{activeDays === 1 ? "" : "s"}
                </span>
                <p className="text-slate-500 mt-0.5">
                  Working across 6+ distinct days maximizes the 25% consistency factor.
                </p>
              </div>
            </div>

            {/* Insight 3: Rework status */}
            <div className="flex items-start gap-2.5 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
              {reworkCount > 0 ? (
                <>
                  <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
                  <div className="text-xs text-slate-700">
                    <span className="font-semibold text-amber-900">
                      {reworkCount} task(s) had rework/carries
                    </span>
                    <p className="text-amber-700 mt-0.5">
                      Rework or carrying over tasks reduces the 15% quality factor.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />
                  <div className="text-xs text-slate-700">
                    <span className="font-semibold text-slate-900">Zero rework penalties</span>
                    <p className="text-slate-500 mt-0.5">
                      100% quality factor achieved with no tasks reopened.
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Insight 4: KPI coverage */}
            <div className="flex items-start gap-2.5 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
              <Target size={16} className="mt-0.5 shrink-0 text-violet-600" />
              <div className="text-xs text-slate-700">
                <span className="font-semibold text-slate-900">
                  {activeKpiCount} of {totalKpiCount} KPI areas active
                </span>
                <p className="text-slate-500 mt-0.5">
                  {activeKpiCount < totalKpiCount
                    ? `${totalKpiCount - activeKpiCount} KPI bucket(s) currently unworked.`
                    : "Activity logged across all assigned KPI areas."}
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* ── 4. Expandable Secondary Details ──────────────────────────────── */}
      <div className="space-y-3">
        {/* Accordion 1: Monthly Score History */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            className="flex w-full items-center justify-between p-4 text-left font-medium text-slate-800 hover:bg-slate-50"
          >
            <span className="flex items-center gap-2 text-sm font-semibold">
              <Calendar size={16} className="text-slate-500" />
              Monthly Score History ({history.length} month{history.length === 1 ? "" : "s"})
            </span>
            <span className="text-xs font-medium text-blue-600">
              {showHistory ? "Hide history ▲" : "View history ▼"}
            </span>
          </button>

          {showHistory && (
            <div className="border-t border-slate-100 p-4">
              {history.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                        <th className="pb-2 font-medium">Month</th>
                        <th className="pb-2 text-center font-medium">Auto</th>
                        <th className="pb-2 text-center font-medium">Final</th>
                        <th className="pb-2 text-center font-medium">Behaviour</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {history.map((h) => (
                        <tr key={h.key}>
                          <td className="py-2 font-medium text-slate-700">{h.label}</td>
                          <td className="py-2 text-center text-blue-600">
                            {h.auto ? Math.round(h.auto) : "—"}
                          </td>
                          <td className="py-2 text-center font-semibold text-violet-700">
                            {Math.round(h.total)}
                          </td>
                          <td className="py-2 text-center text-amber-700">
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
            </div>
          )}
        </div>

        {/* Accordion 2: Annual Increment Projection */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          <button
            type="button"
            onClick={() => setShowIncrement(!showIncrement)}
            className="flex w-full items-center justify-between p-4 text-left font-medium text-slate-800 hover:bg-slate-50"
          >
            <span className="flex items-center gap-2 text-sm font-semibold">
              <TrendingUp size={16} className="text-slate-500" />
              Annual Increment Projection ({nowYear})
            </span>
            <span className="text-xs font-medium text-blue-600">
              {showIncrement ? "Hide projection ▲" : "View projection ▼"}
            </span>
          </button>

          {showIncrement && (
            <div className="border-t border-slate-100 p-4 space-y-3">
              <IncrementBar
                kpi={kpiComponent}
                behaviour={behaviourComponent ?? 0}
                target={targetComponent ?? 0}
                maxTotal={incrementMetadata?.maxTotalPct ?? 20}
              />
              {incrementMetadata?.components?.length ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
                  {incrementMetadata.components.map((ic) => (
                    <div key={ic.key} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-800">{ic.label}</span>
                        <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-700">
                          Max {ic.maxPct}%
                        </span>
                      </div>
                      <div className="mt-1.5 text-base font-bold text-blue-900">
                        {ic.valuePct != null ? `${ic.valuePct}%` : "—"}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500">{ic.basis}</div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Accordion 3: Bucket Work Distribution */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          <button
            type="button"
            onClick={() => setShowBucketFill(!showBucketFill)}
            className="flex w-full items-center justify-between p-4 text-left font-medium text-slate-800 hover:bg-slate-50"
          >
            <span className="flex items-center gap-2 text-sm font-semibold">
              <Flame size={16} className="text-slate-500" />
              Task Volume per Bucket (This Month)
            </span>
            <span className="text-xs font-medium text-blue-600">
              {showBucketFill ? "Hide distribution ▲" : "View distribution ▼"}
            </span>
          </button>

          {showBucketFill && (
            <div className="border-t border-slate-100 p-4">
              <BucketFill buckets={bucketFillData} />
            </div>
          )}
        </div>

        {/* Accordion 4: Calculation Rules Guide */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          <button
            type="button"
            onClick={() => setShowRules(!showRules)}
            className="flex w-full items-center justify-between p-4 text-left font-medium text-slate-800 hover:bg-slate-50"
          >
            <span className="flex items-center gap-2 text-sm font-semibold">
              <BookOpen size={16} className="text-slate-500" />
              Dynamic Scoring Methodology &amp; Formula Guide
            </span>
            <span className="text-xs font-medium text-blue-600">
              {showRules ? "Hide guide ▲" : "View guide ▼"}
            </span>
          </button>

          {showRules && (
            <div className="border-t border-slate-100 p-4 text-xs text-slate-600 space-y-3">
              <div className="rounded-xl bg-slate-50 p-3 border border-slate-200">
                <span className="font-semibold text-slate-900 block text-xs">1. KPI Bucket Auto Score Formula:</span>
                <p className="mt-1 font-mono text-[11px] text-blue-800">
                  Points Earned = Weightage × (60% × Completion Rate + 25% × Consistency Rate + 15% × Quality Rate)
                </p>
                <ul className="list-disc pl-5 mt-1.5 space-y-0.5 text-[11px]">
                  <li><b>Completion Rate (60%):</b> Closed tasks ÷ total tasks logged in bucket.</li>
                  <li><b>Consistency Rate (25%):</b> Active days logged in bucket ÷ 6 days target.</li>
                  <li><b>Quality Rate (15%):</b> 1 - (tasks with rework or carryovers ÷ total tasks).</li>
                </ul>
              </div>

              <div className="rounded-xl bg-slate-50 p-3 border border-slate-200">
                <span className="font-semibold text-slate-900 block text-xs">2. Task-Level Points Formula:</span>
                <p className="mt-1 font-mono text-[11px] text-blue-800">
                  Task Points = Max Points × (60% × Status + 25% × Timeliness + 15% × Quality)
                </p>
                <ul className="list-disc pl-5 mt-1.5 space-y-0.5 text-[11px]">
                  <li><b>Status (60%):</b> Closed (100%), In Progress / Review (40–80%) × Checklist completion rate.</li>
                  <li><b>Timeliness (25%):</b> On-time completion minus carryover deductions.</li>
                  <li><b>Quality (15%):</b> Deduction applied if reopened or rework was required.</li>
                </ul>
              </div>

              <div className="rounded-xl bg-slate-50 p-3 border border-slate-200">
                <span className="font-semibold text-slate-900 block text-xs">3. Normalized Live Score:</span>
                <p className="mt-1 font-mono text-[11px] text-blue-800">
                  Live Score = (Total KPI Points Earned ÷ Total KPI Possible Weightage) × 100
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-3 border border-slate-200">
                <span className="font-semibold text-slate-900 block text-xs">4. Promotion &amp; Increment Policy:</span>
                <p className="mt-1 text-[11px]">
                  Rolling 6-month average score drives the increment band (75+ top band). Annual increment combines KPI performance (max 5%), Behaviour assessment (max 5%), and Target achievement (max 10%).
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 5. Dynamic How Is This Calculated Modal ──────────────────────── */}
      {showCalculationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-semibold text-slate-900">
                Live Score Calculation
              </h3>
              <button
                type="button"
                onClick={() => setShowCalculationModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs text-slate-700">
              <div className="rounded-xl bg-blue-50/70 p-3.5 border border-blue-100 text-center">
                <div className="text-slate-500 font-medium text-[11px] uppercase tracking-wide">
                  Live Normalization Formula
                </div>
                <div className="mt-2 text-sm font-semibold text-blue-900">
                  {totalEarned} earned points ÷ {totalPossible} possible points
                </div>
                <div className="text-xl font-bold text-blue-700 mt-1">
                  = {liveScore.toFixed(1)}% (out of 100)
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-slate-600">
                  • <b>Earned Points ({totalEarned} pts):</b> Sum of points calculated across active KPI buckets using the formula:
                </p>
                <div className="bg-slate-50 rounded-lg p-2 font-mono text-[11px] text-slate-700 border border-slate-200">
                  Weightage × (60% Completion + 25% Consistency + 15% Quality)
                </div>
                <p className="text-slate-600">
                  • <b>Possible Points ({totalPossible} pts):</b> Total weightage of all KPI areas assigned to your role.
                </p>
              </div>

              <p className="text-[11px] text-slate-500 italic">
                Note: This is your live progress during the current month. Final scorecards are finalized after month-end.
              </p>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setShowCalculationModal(false)}
                className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-medium text-white hover:bg-slate-900"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
