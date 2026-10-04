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
  Search,
  CheckCircle,
  Zap,
  Filter,
  ArrowUpRight,
} from "lucide-react";
import { DualTrendLine, IncrementBar, type TrendPoint } from "./Charts";
import BucketFill from "./BucketFill";
import TaskLink from "./TaskLink";
import { Card, SectionTitle, Badge } from "./ui";
import { monthLabel } from "@/lib/scores";
import type { KpiPerformanceAnalyticsSummary, KpiBucketAnalytics } from "@/lib/kpiPoints";

type CompletedTaskItem = {
  id: string;
  title: string;
  status: string;
  sizeLabel?: string | null;
  estimatedMins?: number | null;
  kpiTemplateId?: string | null;
  kpiName?: string;
  kraName?: string | null;
  urgent?: boolean;
  important?: boolean;
  carryCount?: number;
  reworkCount?: number;
  createdAt?: string | Date | null;
  completedAt?: string | Date | null;
  dueAt?: string | Date | null;
  isOnTime?: boolean | null;
  earnedPoints?: number;
  maxPoints?: number;
};

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
    weeklyKpiAnalytics?: KpiPerformanceAnalyticsSummary | null;
    weeklyStats?: {
      closedCount: number;
      totalTasks: number;
      onTimeRate: number;
      activeDays: number;
      reworkCount: number;
      bucketsCovered: number;
      bucketsTotal: number;
      weeklyIndex: number;
      earnedPoints: number;
      possiblePoints: number;
      liveScore: number;
    };
    monthlyStats?: {
      closedCount: number;
      totalTasks: number;
      onTimeRate: number;
      activeDays: number;
      reworkCount: number;
      earnedPoints: number;
      possiblePoints: number;
      liveScore: number;
    };
    completedTasks?: {
      thisWeek: CompletedTaskItem[];
      thisMonth: CompletedTaskItem[];
      all: CompletedTaskItem[];
    };
  };
  isManagerOrAdmin?: boolean;
};

function formatCompletedDate(dateVal: any): string {
  if (!dateVal) return "Recently";
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return "Recently";
  return d.toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

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
    weeklyKpiAnalytics,
    weeklyStats,
    monthlyStats,
    completedTasks,
  } = performanceData;

  // View mode filter: Monthly vs. Weekly
  const [timeframe, setTimeframe] = useState<"monthly" | "weekly">("monthly");

  // Completed tasks filter controls
  const [taskScope, setTaskScope] = useState<"current" | "thisWeek" | "thisMonth" | "all">("current");
  const [taskSearch, setTaskSearch] = useState("");
  const [taskKpiFilter, setTaskKpiFilter] = useState("ALL");
  const [taskTimelinessFilter, setTaskTimelinessFilter] = useState<"ALL" | "ON_TIME" | "LATE">("ALL");

  // Calculation explanation modal state
  const [showCalculationModal, setShowCalculationModal] = useState(false);

  // Accordion states for secondary sections
  const [expandedKpiId, setExpandedKpiId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showIncrement, setShowIncrement] = useState(false);
  const [showBucketFill, setShowBucketFill] = useState(false);
  const [showRules, setShowRules] = useState(false);

  // Derive active KPI analytics based on current timeframe
  const activeAnalytics = timeframe === "weekly" ? (weeklyKpiAnalytics ?? kpiAnalytics) : kpiAnalytics;

  // Live Score Calculation derived from Analytics metadata
  const liveMeta = activeAnalytics?.liveScoreMetadata;
  const totalEarned = liveMeta?.earnedPoints ?? activeAnalytics?.totalPointsEarned ?? 0;
  const totalPossible = liveMeta?.possiblePoints ?? ((activeAnalytics?.totalPointsMax && activeAnalytics.totalPointsMax > 0) ? activeAnalytics.totalPointsMax : 100);
  const liveScore = liveMeta?.scorePct ?? (totalPossible > 0 ? Math.max(0, Math.min(100, Math.round((totalEarned / totalPossible) * 1000) / 10)) : 0);

  // Sort KPI buckets: Active/worked KPIs first, then by weightage
  const sortedBuckets = activeAnalytics
    ? [...activeAnalytics.buckets].sort((a, b) => {
        if (a.totalTasks > 0 && b.totalTasks === 0) return -1;
        if (a.totalTasks === 0 && b.totalTasks > 0) return 1;
        if (b.pointsEarned !== a.pointsEarned) return b.pointsEarned - a.pointsEarned;
        return b.weightage - a.weightage;
      })
    : [];

  // Score Drivers (Derived from real active components)
  const totalTasks = activeAnalytics?.totalTasks ?? (timeframe === "weekly" ? (weeklyStats?.totalTasks ?? 0) : (monthlyStats?.totalTasks ?? 0));
  const completedCount = activeAnalytics?.completedTasks ?? (timeframe === "weekly" ? (weeklyStats?.closedCount ?? 0) : (monthlyStats?.closedCount ?? 0));
  const completionPct = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;
  const activeDays = activeAnalytics?.activeDaysTotal ?? (timeframe === "weekly" ? (weeklyStats?.activeDays ?? 0) : (monthlyStats?.activeDays ?? 0));
  const reworkCount = activeAnalytics?.buckets.reduce((sum, b) => sum + b.reworkCount, 0) ?? (timeframe === "weekly" ? (weeklyStats?.reworkCount ?? 0) : (monthlyStats?.reworkCount ?? 0));
  const activeKpiCount = activeAnalytics?.buckets.filter((b) => b.totalTasks > 0).length ?? 0;
  const totalKpiCount = activeAnalytics?.buckets.length ?? (timeframe === "weekly" ? (weeklyStats?.bucketsTotal ?? 0) : 0);

  // Determine tasks to display in the Completed Tasks section
  const effectiveTaskScope = taskScope === "current" ? (timeframe === "weekly" ? "thisWeek" : "thisMonth") : taskScope;

  const baseTasksList =
    effectiveTaskScope === "thisWeek"
      ? (completedTasks?.thisWeek ?? [])
      : effectiveTaskScope === "thisMonth"
      ? (completedTasks?.thisMonth ?? [])
      : (completedTasks?.all ?? []);

  // Filter completed tasks
  const filteredCompletedTasks = baseTasksList.filter((t) => {
    if (taskSearch.trim()) {
      const q = taskSearch.toLowerCase();
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchKpi = t.kpiName?.toLowerCase().includes(q);
      if (!matchTitle && !matchKpi) return false;
    }
    if (taskKpiFilter !== "ALL") {
      if (t.kpiTemplateId !== taskKpiFilter && t.kpiName !== taskKpiFilter) return false;
    }
    if (taskTimelinessFilter === "ON_TIME" && !t.isOnTime) return false;
    if (taskTimelinessFilter === "LATE" && t.isOnTime) return false;
    return true;
  });

  // Completed tasks aggregate metrics
  const completedTasksCount = filteredCompletedTasks.length;
  const onTimeTasksCount = filteredCompletedTasks.filter((t) => t.isOnTime).length;
  const onTimePercentage = completedTasksCount > 0 ? Math.round((onTimeTasksCount / completedTasksCount) * 100) : 100;
  const totalPointsEarnedFromDone = Math.round(filteredCompletedTasks.reduce((sum, t) => sum + (t.earnedPoints ?? 0), 0) * 10) / 10;
  const zeroReworkCount = filteredCompletedTasks.filter((t) => !t.reworkCount && !t.carryCount).length;
  const zeroReworkPct = completedTasksCount > 0 ? Math.round((zeroReworkCount / completedTasksCount) * 100) : 100;

  // Extract unique KPI options for dropdown filter
  const uniqueKpis = Array.from(
    new Set(baseTasksList.map((t) => t.kpiName || "General").filter(Boolean))
  );

  return (
    <div className="space-y-6">
      {/* ── 0. Timeframe Filter Switcher (Weekly vs Monthly) ─────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-2 sm:p-3 shadow-xs">
        <div className="flex items-center gap-1.5 rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setTimeframe("weekly")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
              timeframe === "weekly"
                ? "bg-white text-blue-700 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Zap size={14} className={timeframe === "weekly" ? "text-amber-500 fill-amber-400" : "text-slate-400"} />
            Weekly Performance
          </button>
          <button
            type="button"
            onClick={() => setTimeframe("monthly")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
              timeframe === "monthly"
                ? "bg-white text-blue-700 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Calendar size={14} className={timeframe === "monthly" ? "text-blue-600" : "text-slate-400"} />
            Monthly Performance
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="hidden sm:inline">Viewing:</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">
            {timeframe === "weekly" ? "⚡ Current Week (Mon–Sun)" : "📅 Current Month Live & 6-Month Review"}
          </span>
        </div>
      </div>

      {/* ── 1. Top Summary Cards ────────────────────────────────────────── */}
      {timeframe === "weekly" ? (
        /* WEEKLY SUMMARY CARDS */
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Weekly Score */}
          <div className="relative rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50/70 to-white p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">
                Weekly Score
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-600" />
                This Week
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold tracking-tight text-amber-900">
                {liveScore.toFixed(1)}
              </span>
              <span className="text-xs font-medium text-amber-600">/ 100</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-slate-600">
              <span>{totalEarned} earned / {totalPossible} possible</span>
              <button
                type="button"
                onClick={() => setShowCalculationModal(true)}
                className="inline-flex items-center gap-0.5 text-[11px] font-medium text-amber-700 hover:text-amber-900 hover:underline"
              >
                <HelpCircle size={12} />
                Formula
              </button>
            </div>
          </div>

          {/* Card 2: Weekly Star Index */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Weekly Star Index
              </span>
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                Leaderboard
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold tracking-tight text-slate-900">
                {weeklyStats?.weeklyIndex ?? Math.round(liveScore)}
              </span>
              <span className="text-xs font-medium text-slate-400">index pts</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {weeklyStats?.onTimeRate ?? 0}% on-time · {weeklyStats?.closedCount ?? 0} closed
            </p>
          </div>

          {/* Card 3: Work Consistency */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Weekly Consistency
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold tracking-tight text-slate-900">
                {weeklyStats?.activeDays ?? activeDays}
              </span>
              <span className="text-xs font-medium text-slate-400">active day(s)</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {weeklyStats?.reworkCount === 0 ? "Zero rework penalties" : `${weeklyStats?.reworkCount ?? 0} rework/carries`}
            </p>
          </div>

          {/* Card 4: KPI Coverage */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              KPI Coverage
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold tracking-tight text-slate-900">
                {weeklyStats?.bucketsCovered ?? activeKpiCount}
              </span>
              <span className="text-xs font-medium text-slate-400">/ {weeklyStats?.bucketsTotal ?? totalKpiCount} areas</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Distinct KPI areas worked this week
            </p>
          </div>
        </div>
      ) : (
        /* MONTHLY SUMMARY CARDS */
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
      )}

      {/* ── 2. Performance Trend (Monthly Only) ─────────────────────────── */}
      {timeframe === "monthly" && (
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
      )}

      {/* ── 3. Where Score Comes From & What Affected Score ──────────────── */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left 3 cols: Where your score comes from */}
        <Card className="p-4 sm:p-5 lg:col-span-3">
          <div className="flex items-center justify-between">
            <div>
              <SectionTitle>
                {timeframe === "weekly" ? "Weekly KPI Breakdown" : "Where your score comes from"}
              </SectionTitle>
              <p className="text-xs text-slate-500">
                {timeframe === "weekly"
                  ? "KPI weightage & performance points earned this week. Click any row to expand."
                  : "Current month KPI breakdown by weightage. Click any row to view its exact formula components."}
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
          <SectionTitle>
            {timeframe === "weekly" ? "What affected this week's score" : "What affected your score"}
          </SectionTitle>
          <p className="text-xs text-slate-500 mb-3">
            Real performance drivers from {timeframe === "weekly" ? "this week's" : "current month"} activity.
          </p>

          <div className="space-y-2.5">
            {/* Insight 1: Tasks Completion */}
            <div className="flex items-start gap-2.5 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />
              <div className="text-xs text-slate-700">
                <span className="font-semibold text-slate-900">
                  {completedCount} of {totalTasks} tasks completed
                </span>
                <p className="text-slate-500 mt-0.5">
                  {totalTasks > 0 ? `${completionPct}% task completion rate (drives 60% completion weight).` : "No tasks logged in this timeframe yet."}
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
                  {timeframe === "weekly" ? "Daily activity logged throughout the current work week." : "Working across 6+ distinct days maximizes the 25% consistency factor."}
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
                    ? `${totalKpiCount - activeKpiCount} KPI bucket(s) unworked in this timeframe.`
                    : "Activity logged across all assigned KPI areas."}
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* ── 4. PROMINENT COMPLETED TASKS / TASKS DONE SECTION ──────────── */}
      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <CheckCircle size={18} className="text-emerald-600" />
              <SectionTitle className="mb-0">Tasks Done &amp; Completed Work</SectionTitle>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Detailed breakdown of completed tasks, timeliness status, and KPI points earned.
            </p>
          </div>

          {/* Scope switch pills */}
          <div className="flex flex-wrap items-center gap-1 rounded-xl bg-slate-100 p-1 text-xs">
            <button
              type="button"
              onClick={() => setTaskScope("thisWeek")}
              className={`rounded-lg px-2.5 py-1 font-medium transition ${
                effectiveTaskScope === "thisWeek"
                  ? "bg-white text-blue-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              This Week ({completedTasks?.thisWeek?.length ?? 0})
            </button>
            <button
              type="button"
              onClick={() => setTaskScope("thisMonth")}
              className={`rounded-lg px-2.5 py-1 font-medium transition ${
                effectiveTaskScope === "thisMonth"
                  ? "bg-white text-blue-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              This Month ({completedTasks?.thisMonth?.length ?? 0})
            </button>
            <button
              type="button"
              onClick={() => setTaskScope("all")}
              className={`rounded-lg px-2.5 py-1 font-medium transition ${
                effectiveTaskScope === "all"
                  ? "bg-white text-blue-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All Recent ({completedTasks?.all?.length ?? 0})
            </button>
          </div>
        </div>

        {/* Task Summary Stat Strip */}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Tasks Completed</span>
            <div className="mt-1 text-lg font-bold text-slate-900">{completedTasksCount}</div>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">On-Time Rate</span>
            <div className="mt-1 text-lg font-bold text-emerald-700">{onTimePercentage}%</div>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Points Earned</span>
            <div className="mt-1 text-lg font-bold text-violet-700">+{totalPointsEarnedFromDone} pts</div>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Zero Rework Rate</span>
            <div className="mt-1 text-lg font-bold text-blue-700">{zeroReworkPct}%</div>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          {/* Search box */}
          <div className="relative min-w-[200px] flex-1">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search completed tasks..."
              value={taskSearch}
              onChange={(e) => setTaskSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
            />
            {taskSearch && (
              <button
                type="button"
                onClick={() => setTaskSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* KPI Filter dropdown */}
          {uniqueKpis.length > 1 && (
            <select
              value={taskKpiFilter}
              onChange={(e) => setTaskKpiFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-blue-500 focus:outline-none"
            >
              <option value="ALL">All KPI Buckets</option>
              {uniqueKpis.map((kpi) => (
                <option key={kpi} value={kpi}>
                  {kpi}
                </option>
              ))}
            </select>
          )}

          {/* Timeliness filter */}
          <select
            value={taskTimelinessFilter}
            onChange={(e) => setTaskTimelinessFilter(e.target.value as any)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-blue-500 focus:outline-none"
          >
            <option value="ALL">All Deadlines</option>
            <option value="ON_TIME">✓ On Time Only</option>
            <option value="LATE">⚠ Overdue Only</option>
          </select>
        </div>

        {/* Tasks List */}
        <div className="mt-4 space-y-2">
          {filteredCompletedTasks.length > 0 ? (
            filteredCompletedTasks.map((t) => (
              <div
                key={t.id}
                className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 hover:border-blue-200 hover:bg-slate-50/50 transition shadow-2xs"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <TaskLink taskId={t.id} className="font-semibold text-slate-900 group-hover:text-blue-600 transition hover:underline">
                      {t.title}
                    </TaskLink>
                    {t.urgent && <Badge className="bg-red-50 text-red-700">Urgent</Badge>}
                    {t.important && <Badge className="bg-amber-50 text-amber-700">Important</Badge>}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-700">
                      {t.kpiName || "General"}
                    </span>
                    {t.kraName && <span className="text-[11px] text-slate-400">· {t.kraName}</span>}
                    {t.sizeLabel && (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                        Effort: {t.sizeLabel}
                      </span>
                    )}
                    <span className="text-[11px] text-slate-400">
                      Closed {formatCompletedDate(t.completedAt)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                  {/* On-Time Status */}
                  {t.isOnTime ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                      <CheckCircle2 size={12} className="text-emerald-600" />
                      On Time
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                      <AlertTriangle size={12} className="text-amber-600" />
                      Late
                    </span>
                  )}

                  {/* Quality / Rework */}
                  {(t.reworkCount ?? 0) > 0 ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                      {t.reworkCount} rework
                    </span>
                  ) : (
                    <span className="hidden sm:inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                      Clean
                    </span>
                  )}

                  {/* Points Earned */}
                  <div className="text-right">
                    <span className="text-sm font-bold text-violet-700">
                      +{t.earnedPoints ?? 0}
                    </span>
                    <span className="text-[10px] text-slate-400"> / {t.maxPoints ?? 0} pts</span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="grid place-items-center rounded-xl border border-dashed border-slate-200 p-8 text-center">
              <CheckCircle size={32} className="text-slate-300 mb-2" />
              <p className="text-sm font-medium text-slate-700">No completed tasks match the current filter</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                Tasks completed during this period will automatically appear here with their earned KPI points and timeliness metrics.
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* ── 5. Expandable Secondary Details (History, Increment, etc.) ── */}
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
              Dynamic Scoring Methodology &amp; All Formulas Guide (in Words)
            </span>
            <span className="text-xs font-medium text-blue-600">
              {showRules ? "Hide guide ▲" : "View guide ▼"}
            </span>
          </button>

          {showRules && (
            <div className="border-t border-slate-100 p-4 text-xs text-slate-600 space-y-4">
              {/* Formula 1 */}
              <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200">
                <span className="font-semibold text-slate-900 block text-xs">
                  1. KPI Bucket Auto Score Formula (In Words):
                </span>
                <p className="mt-1 font-mono text-[11px] font-semibold text-blue-800">
                  KPI Bucket Score = Assigned Weightage × (60% × Completion Rate + 25% × Work Consistency + 15% × Quality Factor)
                </p>
                <div className="mt-2 space-y-1 text-[11px]">
                  <p>• <b>Completion Rate (60% weight):</b> Calculated as (Closed Tasks ÷ Total Tasks Logged in Bucket). Reflects task completion lifecycle.</p>
                  <p>• <b>Work Consistency (25% weight):</b> Calculated as (Distinct Active Work Days Logged ÷ 6 Days Monthly Target), capped at 100% (1.0).</p>
                  <p>• <b>Quality Factor (15% weight):</b> Calculated as 1 − (Tasks with Rework or Carryovers ÷ Total Tasks). Zero rework achieves 100% (1.0).</p>
                </div>
              </div>

              {/* Formula 2 */}
              <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200">
                <span className="font-semibold text-slate-900 block text-xs">
                  2. Individual Task Points Formula (In Words):
                </span>
                <p className="mt-1 font-mono text-[11px] font-semibold text-blue-800">
                  Task Points = Task Max Points × (60% × Status Factor × Checklist Factor + 25% × Timeliness Factor × (1 − Carry Penalty) + 15% × Quality Factor)
                </p>
                <div className="mt-2 space-y-1 text-[11px]">
                  <p>• <b>Task Max Points:</b> Proportional share of the parent KPI weightage based on task effort size (XS = 0.5×, S = 0.75×, M = 1.0×, L = 1.5×, XL = 2.0× or estimated minutes).</p>
                  <p>• <b>Status Factor (60% weight):</b> Closed = 100% (1.0), Pending Review = 80% (0.8), In Progress / Accepted = 40% (0.4), On Hold = 20% (0.2).</p>
                  <p>• <b>Checklist Factor:</b> (Completed Checklist Items ÷ Total Checklist Items). Defaults to 1.0 if no checklist exists.</p>
                  <p>• <b>Timeliness Factor (25% weight):</b> On-time completion = 100% (1.0). Overdue delivery deducts 10% per day late (minimum floor 60%).</p>
                  <p>• <b>Carry Penalty:</b> Deducts 8% per carry forward iteration (maximum deduction 30%).</p>
                  <p>• <b>Quality Factor (15% weight):</b> Clean completion = 100% (1.0). Rework iteration deducts 25% per iteration. Reopened task = 30% (0.3).</p>
                </div>
              </div>

              {/* Formula 3 */}
              <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200">
                <span className="font-semibold text-slate-900 block text-xs">
                  3. Live Normalized Performance Score (In Words):
                </span>
                <p className="mt-1 font-mono text-[11px] font-semibold text-blue-800">
                  Live Score (%) = (Sum of Points Earned Across All Active KPI Buckets ÷ Total Possible KPI Weightage) × 100
                </p>
                <div className="mt-2 text-[11px]">
                  <p>Normalizes raw earned points against the total weightage of all KPI areas configured for the employee&apos;s role (100 points maximum), providing a live progress percentage between 0 and 100.</p>
                </div>
              </div>

              {/* Formula 4 */}
              <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200">
                <span className="font-semibold text-slate-900 block text-xs">
                  4. Weekly Star Index Formula (In Words):
                </span>
                <p className="mt-1 font-mono text-[11px] font-semibold text-blue-800">
                  Weekly Star Index = (50% × On-Time Delivery Rate) + (30% × Volume Score) + (20% × KPI Bucket Coverage)
                </p>
                <div className="mt-2 space-y-1 text-[11px]">
                  <p>• <b>On-Time Delivery Rate (50% weight):</b> (Tasks completed on or before deadline ÷ Total closed tasks this week) × 100.</p>
                  <p>• <b>Volume Score (30% weight):</b> Min(100, (Total tasks closed this week ÷ 8 target tasks) × 100).</p>
                  <p>• <b>KPI Bucket Coverage (20% weight):</b> (Distinct KPI buckets worked on this week ÷ Total KPI buckets assigned to role) × 100.</p>
                </div>
              </div>

              {/* Formula 5 */}
              <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200">
                <span className="font-semibold text-slate-900 block text-xs">
                  5. Department Productivity Index Formula (In Words):
                </span>
                <p className="mt-1 font-mono text-[11px] font-semibold text-blue-800">
                  Productivity Index = (50% × Department Average Score) + (25% × Department Task Completion Rate) + (25% × Department Work Consistency)
                </p>
                <div className="mt-2 space-y-1 text-[11px]">
                  <p>• <b>Department Average Score (50% weight):</b> Average monthly scorecard total of active members in the department.</p>
                  <p>• <b>Task Completion Rate (25% weight):</b> (Total closed tasks ÷ Total tasks logged across department) × 100.</p>
                  <p>• <b>Work Consistency (25% weight):</b> (Total active member-days logged ÷ Possible working days in period) × 100.</p>
                </div>
              </div>

              {/* Formula 6 */}
              <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200">
                <span className="font-semibold text-slate-900 block text-xs">
                  6. Rolling 6-Month Average &amp; Promotion Readiness (In Words):
                </span>
                <p className="mt-1 font-mono text-[11px] font-semibold text-blue-800">
                  6-Month Average = Sum of the last 6 finalized monthly total scores ÷ Number of months (max 6)
                </p>
                <div className="mt-2 space-y-1 text-[11px]">
                  <p>• <b>Score ≥ 75:</b> Ready for promotion (Top performance tier).</p>
                  <p>• <b>Score 65–74:</b> Developing — on track (Increment eligible).</p>
                  <p>• <b>Score 45–64:</b> Needs improvement (Below standard increment threshold).</p>
                  <p>• <b>Score &lt; 45:</b> Below expectations.</p>
                </div>
              </div>

              {/* Formula 7 */}
              <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200">
                <span className="font-semibold text-slate-900 block text-xs">
                  7. Annual Increment Policy Formula (In Words):
                </span>
                <p className="mt-1 font-mono text-[11px] font-semibold text-blue-800">
                  Projected Annual Increment (%) = KPI Performance Component (Max 5%) + Behaviour Review Component (Max 5%) + Target vs Actual Component (Max 10%)
                </p>
                <div className="mt-2 space-y-1 text-[11px]">
                  <p>• <b>KPI Component (Max 5%):</b> 5% × (6-Month Average Score ÷ 100).</p>
                  <p>• <b>Behaviour Review (Max 5%):</b> 5% × (Annual Behaviour Assessment % ÷ 100).</p>
                  <p>• <b>Target vs Actual (Max 10%):</b> 10% × (Annual Target Achievement % ÷ 100).</p>
                  <p>• <b>Total Maximum Increment:</b> 20% per company policy.</p>
                </div>
              </div>

              {/* Formula 8 */}
              <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200">
                <span className="font-semibold text-slate-900 block text-xs">
                  8. Behaviour Assessment Review Formula (In Words):
                </span>
                <p className="mt-1 font-mono text-[11px] font-semibold text-blue-800">
                  Behaviour Average (0–10) = (Attendance + Punctuality + Continuous Learning + Teamwork + Trust/Commitment + Positive Conduct) ÷ 6
                </p>
                <div className="mt-2 text-[11px]">
                  <p>Scored across 6 human-judged qualitative criteria (each 0–10). Multiplied by 10 to produce a 0–100% assessment percentage used in annual increment calculations.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 6. Dynamic How Is This Calculated Modal ──────────────────────── */}
      {showCalculationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-semibold text-slate-900">
                {timeframe === "weekly" ? "Weekly Score Calculation" : "Live Score Calculation"}
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
                  {timeframe === "weekly" ? "Weekly Normalization Formula" : "Live Normalization Formula"}
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
                {timeframe === "weekly"
                  ? "Note: Weekly performance tracks progress for the current Monday–Sunday window and feeds into Weekly Star leaderboard."
                  : "Note: This is your live progress during the current month. Final scorecards are finalized after month-end."}
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
