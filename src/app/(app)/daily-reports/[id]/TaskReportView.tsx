"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RotateCcw,
  Sparkles,
  ArrowLeft,
  ArrowUpRight,
  Layers,
  HelpCircle,
  FileText,
  BarChart3,
  TrendingUp,
  Info,
  SlidersHorizontal,
  X,
  Flame,
  Award,
} from "lucide-react";
import { cn } from "@/lib/cn";
import Avatar from "../../_components/Avatar";
import TaskLink from "../../_components/TaskLink";
import { Card, SectionTitle, Badge } from "../../_components/ui";
import { monthLabel } from "@/lib/scores";
import DirectoryScoreModal from "../../people/DirectoryScoreModal";
import type { EmployeeTaskReportData, TaskReportItem, KpiUsageDetail } from "@/lib/taskReportService";
import type { RangeType } from "@/lib/dateRanges";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDisplayDate(dateInput?: string | Date | null): string {
  if (!dateInput) return "—";
  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return "—";
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

export default function TaskReportView({
  data,
  performanceData,
}: {
  data: EmployeeTaskReportData;
  performanceData?: any;
}) {
  const router = useRouter();
  const { employee, range, summaryCards, qualityExplanations, kpiUsage, mostUsedKpi, leastUsedKpi, statusBreakdown, activityTrend, workInsights, tasks, viewerCanScore } = data;

  // Navigation handlers
  function navigateWithParams(params: Record<string, string>) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v) searchParams.set(k, v);
    });
    router.push(`/daily-reports/${employee.id}?${searchParams.toString()}`);
  }

  function handleRangeChange(newRange: RangeType) {
    if (newRange === "custom") {
      const today = new Date().toISOString().slice(0, 10);
      navigateWithParams({ range: "custom", from: range.fromParam || range.dateParam || today, to: range.toParam || today });
    } else {
      navigateWithParams({ range: newRange, date: range.dateParam });
    }
  }

  // Custom date picker states
  const [customFrom, setCustomFrom] = useState(range.fromParam || range.dateParam);
  const [customTo, setCustomTo] = useState(range.toParam || range.dateParam);

  // KPI drilldown accordion state
  const [expandedKpiId, setExpandedKpiId] = useState<string | null>(kpiUsage[0]?.kpiId || null);
  const maxKpiTasks = useMemo(() => Math.max(1, ...kpiUsage.map((k) => k.totalTasks)), [kpiUsage]);
  const selectedKpi = useMemo(() => kpiUsage.find((k) => k.kpiId === expandedKpiId) || null, [kpiUsage, expandedKpiId]);

  // Detailed task table search & filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [kpiFilter, setKpiFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [timelinessFilter, setTimelinessFilter] = useState("ALL");
  const [reworkOnly, setReworkOnly] = useState(false);
  const [carryOnly, setCarryOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"created" | "due" | "completed" | "title" | "status">("created");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Performance Section states (Weekly vs Monthly switcher & KPI breakdown expansion)
  const [performanceTimeframe, setPerformanceTimeframe] = useState<"monthly" | "weekly">("monthly");
  const [expandedPerformanceKpiId, setExpandedPerformanceKpiId] = useState<string | null>(null);
  const [showCalculationModal, setShowCalculationModal] = useState(false);
  const [showScoringModal, setShowScoringModal] = useState(false);

  // Scoring period derived from range date or current date
  const [scoringYear, scoringMonth, scoringMonthLabel] = useMemo(() => {
    let d = new Date();
    if (range.startDate) {
      const parsed = new Date(range.startDate);
      if (!isNaN(parsed.getTime())) d = parsed;
    }
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    return [y, m, monthLabel(y, m)];
  }, [range.startDate]);

  // Active performance metrics derived from performanceData
  const activePerfAnalytics = performanceData
    ? (performanceTimeframe === "weekly"
        ? (performanceData.weeklyKpiAnalytics ?? performanceData.kpiAnalytics)
        : performanceData.kpiAnalytics)
    : null;

  const perfLiveMeta = activePerfAnalytics?.liveScoreMetadata;
  const perfTotalEarned = perfLiveMeta?.earnedPoints ?? activePerfAnalytics?.totalPointsEarned ?? 0;
  const perfTotalPossible = perfLiveMeta?.possiblePoints ?? ((activePerfAnalytics?.totalPointsMax && activePerfAnalytics.totalPointsMax > 0) ? activePerfAnalytics.totalPointsMax : 100);
  const perfLiveScore = perfLiveMeta?.scorePct ?? (perfTotalPossible > 0 ? Math.max(0, Math.min(100, Math.round((perfTotalEarned / perfTotalPossible) * 1000) / 10)) : 0);

  const perfSortedBuckets = activePerfAnalytics
    ? [...activePerfAnalytics.buckets].sort((a: any, b: any) => {
        if (a.totalTasks > 0 && b.totalTasks === 0) return -1;
        if (a.totalTasks === 0 && b.totalTasks > 0) return 1;
        if (b.pointsEarned !== a.pointsEarned) return b.pointsEarned - a.pointsEarned;
        return b.weightage - a.weightage;
      })
    : [];

  const perfTotalTasks = activePerfAnalytics?.totalTasks ?? (performanceTimeframe === "weekly" ? (performanceData?.weeklyStats?.totalTasks ?? 0) : (performanceData?.monthlyStats?.totalTasks ?? 0));
  const perfCompletedCount = activePerfAnalytics?.completedTasks ?? (performanceTimeframe === "weekly" ? (performanceData?.weeklyStats?.closedCount ?? 0) : (performanceData?.monthlyStats?.closedCount ?? 0));
  const perfCompletionPct = perfTotalTasks > 0 ? Math.round((perfCompletedCount / perfTotalTasks) * 100) : 0;
  const perfActiveDays = activePerfAnalytics?.activeDaysTotal ?? (performanceTimeframe === "weekly" ? (performanceData?.weeklyStats?.activeDays ?? 0) : (performanceData?.monthlyStats?.activeDays ?? 0));
  const perfReworkCount = activePerfAnalytics?.buckets.reduce((sum: number, b: any) => sum + b.reworkCount, 0) ?? (performanceTimeframe === "weekly" ? (performanceData?.weeklyStats?.reworkCount ?? 0) : (performanceData?.monthlyStats?.reworkCount ?? 0));
  const perfActiveKpiCount = activePerfAnalytics?.buckets.filter((b: any) => b.totalTasks > 0).length ?? 0;
  const perfTotalKpiCount = activePerfAnalytics?.buckets.length ?? (performanceTimeframe === "weekly" ? (performanceData?.weeklyStats?.bucketsTotal ?? 0) : 0);

  // Filtered & Sorted Tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches = t.title.toLowerCase().includes(q) || t.kpiName.toLowerCase().includes(q);
        if (!matches) return false;
      }
      if (statusFilter !== "ALL" && t.status !== statusFilter) return false;
      if (kpiFilter !== "ALL" && t.kpiName !== kpiFilter) return false;
      if (priorityFilter !== "ALL" && t.priority !== priorityFilter) return false;
      if (timelinessFilter === "ON_TIME" && t.isOnTime !== true) return false;
      if (timelinessFilter === "LATE" && t.isOnTime !== false) return false;
      if (reworkOnly && t.reworkCount === 0 && t.status !== "REOPENED") return false;
      if (carryOnly && t.carryCount === 0) return false;
      return true;
    }).sort((a, b) => {
      let valA: any = "";
      let valB: any = "";
      if (sortBy === "created") {
        valA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        valB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      } else if (sortBy === "due") {
        valA = a.dueAt ? new Date(a.dueAt).getTime() : 0;
        valB = b.dueAt ? new Date(b.dueAt).getTime() : 0;
      } else if (sortBy === "completed") {
        valA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
        valB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
      } else if (sortBy === "title") {
        valA = a.title.toLowerCase();
        valB = b.title.toLowerCase();
      } else if (sortBy === "status") {
        valA = a.status;
        valB = b.status;
      }
      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [tasks, searchQuery, statusFilter, kpiFilter, priorityFilter, timelinessFilter, reworkOnly, carryOnly, sortBy, sortOrder]);

  const totalPages = Math.ceil(filteredTasks.length / pageSize) || 1;
  const paginatedTasks = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTasks.slice(start, start + pageSize);
  }, [filteredTasks, currentPage, pageSize]);

  // Unique KPIs for filter dropdown
  const allKpiNames = useMemo(() => {
    const set = new Set<string>();
    tasks.forEach((t) => set.add(t.kpiName));
    return Array.from(set).sort();
  }, [tasks]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      {/* ── 1. Top Navigation & Employee Identity ─────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/daily-reports?date=${range.dateParam}`}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-sm"
          >
            <ArrowLeft size={14} />
            Back to Reports
          </Link>
          <span className="text-slate-300">/</span>
          <span className="text-xs font-semibold text-slate-500">Employee Work Report</span>
        </div>

        <div className="flex items-center gap-2">
          {viewerCanScore && (
            <button
              type="button"
              onClick={() => setShowScoringModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 text-xs font-semibold text-violet-800 transition shadow-2xs cursor-pointer"
              title={`Open Scoring Panel for ${employee.name} (${scoringMonthLabel})`}
            >
              <Award size={14} className="text-violet-600" />
              Scoring Panel
            </button>
          )}

          {/* Secondary link to Performance Score */}
          <Link
            href={`/people/${employee.id}`}
            className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
          >
            View Performance Score
            <ArrowUpRight size={13} />
          </Link>
        </div>
      </div>

      {/* Employee Identity Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar name={employee.name} url={employee.avatarUrl} size={52} />
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold tracking-tight text-slate-900">{employee.name}</h1>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                  {employee.departmentName}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {employee.roleTitle} · Manager: <strong className="text-slate-700 font-medium">{employee.managerName}</strong>
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400 block">Report Scope</span>
            <span className="text-sm font-bold text-slate-800">{range.label}</span>
            {range.subLabel && <p className="text-[11px] text-slate-500">{range.subLabel}</p>}
          </div>
        </div>

        {/* ── 2. Date Range Selector Controls ───────────────────────────────── */}
        <div className="mt-5 border-t border-slate-100 pt-4 flex flex-wrap items-center justify-between gap-3">
          {/* Range Mode Tabs */}
          <div className="flex flex-wrap items-center gap-1 rounded-xl bg-slate-100 p-1">
            {(
              [
                { id: "daily", label: "Daily" },
                { id: "specific", label: "Specific Date" },
                { id: "weekly", label: "Weekly" },
                { id: "monthly", label: "Monthly" },
                { id: "quarterly", label: "Quarterly" },
                { id: "yearly", label: "Yearly" },
                { id: "custom", label: "Custom" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleRangeChange(tab.id)}
                className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                  range.rangeType === tab.id
                    ? "bg-white text-blue-700 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Range Navigation Buttons / Date Pickers */}
          <div className="flex items-center gap-2">
            {range.rangeType !== "custom" && (
              <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 shadow-sm">
                <button
                  type="button"
                  onClick={() => navigateWithParams(range.prevParams)}
                  title="Previous Period"
                  className="rounded-lg p-1 text-slate-600 hover:bg-white hover:text-slate-900 transition"
                >
                  <ChevronLeft size={16} />
                </button>

                <div className="flex items-center gap-1.5 px-2">
                  <Calendar size={13} className="text-blue-600" />
                  <span className="text-xs font-bold text-slate-800">{range.label}</span>
                </div>

                <button
                  type="button"
                  onClick={() => navigateWithParams(range.nextParams)}
                  title="Next Period"
                  className="rounded-lg p-1 text-slate-600 hover:bg-white hover:text-slate-900 transition"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}

            {/* Inline Specific Date Picker */}
            {(range.rangeType === "daily" || range.rangeType === "specific") && (
              <input
                type="date"
                value={range.dateParam}
                onChange={(e) => navigateWithParams({ range: range.rangeType, date: e.target.value })}
                className="rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer shadow-sm"
              />
            )}

            {/* Custom Range From/To Pickers */}
            {range.rangeType === "custom" && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 text-xs text-slate-600">
                  <span>From:</span>
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
                  />
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-600">
                  <span>To:</span>
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => navigateWithParams({ range: "custom", from: customFrom, to: customTo })}
                  className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700 transition"
                >
                  Apply
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 2.5. PERFORMANCE SECTIONS (From Performance View) ────────────── */}
      {performanceData && (
        <div className="space-y-6 pt-2">
          {/* Performance Section Header */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-slate-900">Performance</h2>
              <p className="text-xs text-slate-500">
                Objective, month-by-month — the basis for increments and promotions.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {viewerCanScore && (
                <button
                  type="button"
                  onClick={() => setShowScoringModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 text-xs font-semibold text-violet-800 transition shadow-2xs cursor-pointer"
                  title={`Open Scoring Panel for ${employee.name} (${scoringMonthLabel})`}
                >
                  <Award size={14} className="text-violet-600" />
                  Score {employee.name.split(" ")[0]}
                </button>
              )}
              <Link
                href={`/people/${employee.id}`}
                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
              >
                Full Performance Profile
                <ArrowUpRight size={13} />
              </Link>
            </div>
          </div>

          {/* Timeframe Filter Switcher (Weekly vs Monthly) */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-2 sm:p-3 shadow-xs">
            <div className="flex items-center gap-1.5 rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setPerformanceTimeframe("weekly")}
                className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                  performanceTimeframe === "weekly"
                    ? "bg-white text-blue-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span className={performanceTimeframe === "weekly" ? "text-amber-500 font-bold" : "text-slate-400"}>⚡</span>
                Weekly Performance
              </button>
              <button
                type="button"
                onClick={() => setPerformanceTimeframe("monthly")}
                className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                  performanceTimeframe === "monthly"
                    ? "bg-white text-blue-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Calendar size={14} className={performanceTimeframe === "monthly" ? "text-blue-600" : "text-slate-400"} />
                Monthly Performance
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="hidden sm:inline">Viewing:</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">
                {performanceTimeframe === "weekly" ? "⚡ Current Week (Mon–Sun)" : "📅 Current Month Live & 6-Month Review"}
              </span>
            </div>
          </div>

          {/* Top Summary Cards */}
          {performanceTimeframe === "weekly" ? (
            /* Weekly Summary Cards */
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
                    {perfLiveScore.toFixed(1)}
                  </span>
                  <span className="text-xs font-medium text-amber-600">/ 100</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-slate-600">
                  <span>{perfTotalEarned} earned / {perfTotalPossible} possible</span>
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
                    {performanceData.weeklyStats?.weeklyIndex ?? Math.round(perfLiveScore)}
                  </span>
                  <span className="text-xs font-medium text-slate-400">index pts</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {performanceData.weeklyStats?.onTimeRate ?? 0}% on-time · {performanceData.weeklyStats?.closedCount ?? 0} closed
                </p>
              </div>

              {/* Card 3: Work Consistency */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Weekly Consistency
                </div>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold tracking-tight text-slate-900">
                    {performanceData.weeklyStats?.activeDays ?? perfActiveDays}
                  </span>
                  <span className="text-xs font-medium text-slate-400">active day(s)</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {performanceData.weeklyStats?.reworkCount === 0 ? "Zero rework penalties" : `${performanceData.weeklyStats?.reworkCount ?? 0} rework/carries`}
                </p>
              </div>

              {/* Card 4: KPI Coverage */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  KPI Coverage
                </div>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold tracking-tight text-slate-900">
                    {performanceData.weeklyStats?.bucketsCovered ?? perfActiveKpiCount}
                  </span>
                  <span className="text-xs font-medium text-slate-400">/ {performanceData.weeklyStats?.bucketsTotal ?? perfTotalKpiCount} areas</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Distinct KPI areas worked this week
                </p>
              </div>
            </div>
          ) : (
            /* Monthly Summary Cards */
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {/* Card 1: Current Performance */}
              <div className="relative rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/70 to-white p-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-blue-700">
                    CURRENT PERFORMANCE
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-800">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-600" />
                    Live this month
                  </span>
                </div>

                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold tracking-tight text-blue-900">
                    {perfLiveScore.toFixed(1)}
                  </span>
                  <span className="text-xs font-medium text-blue-600">/ 100</span>
                </div>

                <div className="mt-1 flex items-center justify-between text-xs text-slate-600">
                  <span>{perfTotalEarned} earned / {perfTotalPossible} possible</span>
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
                    6-MONTH AVERAGE
                  </span>
                  {performanceData.ready && (
                    <Badge className={performanceData.ready.tone}>{performanceData.ready.label}</Badge>
                  )}
                </div>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold tracking-tight text-slate-900">
                    {(performanceData.avg ?? 0).toFixed(0)}
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
                  INCREMENT STATUS
                </div>
                <div className="mt-2">
                  <span className={`inline-block font-semibold ${performanceData.band?.className ?? "text-blue-700"}`}>
                    {performanceData.band?.label ?? "Evaluating"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  per company policy (aim 75+ for top band)
                </p>
              </div>

              {/* Card 4: Latest Finalized */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  LATEST FINALIZED
                </div>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold tracking-tight text-slate-900">
                    {performanceData.latestFinal ? Math.round(performanceData.latestFinal.total) : "0"}
                  </span>
                  <span className="text-xs font-medium text-slate-400">/ 100</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {performanceData.latestFinal ? monthLabel(performanceData.latestFinal.year, performanceData.latestFinal.month) : "Not yet scored"}
                </p>
              </div>
            </div>
          )}

          {/* Where Your Score Comes From & What Affected Your Score */}
          <div className="grid gap-6 lg:grid-cols-5">
            {/* Left 3 cols: Where your score comes from */}
            <Card className="p-4 sm:p-5 lg:col-span-3">
              <div className="flex items-center justify-between">
                <div>
                  <SectionTitle>
                    {performanceTimeframe === "weekly" ? "Weekly KPI Breakdown" : "WHERE YOUR SCORE COMES FROM"}
                  </SectionTitle>
                  <p className="text-xs text-slate-500">
                    {performanceTimeframe === "weekly"
                      ? "KPI weightage & performance points earned this week. Click any row to expand."
                      : "Current month KPI breakdown by weightage. Click any row to view its exact formula components."}
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                  {perfActiveKpiCount} active of {perfTotalKpiCount}
                </span>
              </div>

              <div className="mt-4 divide-y divide-slate-100">
                {perfSortedBuckets.map((bucket: any) => {
                  const isExpanded = expandedPerformanceKpiId === bucket.kpiId;
                  const pct = bucket.weightage > 0 ? (bucket.pointsEarned / bucket.weightage) * 100 : 0;
                  const meta = bucket.calculationMetadata;

                  return (
                    <div key={bucket.kpiId} className="py-2.5 transition-colors">
                      <button
                        type="button"
                        onClick={() => setExpandedPerformanceKpiId(isExpanded ? null : bucket.kpiId)}
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
                              {meta.components.map((comp: any) => {
                                const maxFactorPts = comp.maxPoints ?? Math.round(bucket.weightage * (comp.weight || comp.weightPct / 100) * 10) / 10;

                                return (
                                  <div key={comp.key} className="rounded-lg bg-white p-2.5 border border-slate-200">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[11px] font-semibold text-slate-700">{comp.label}</span>
                                      <span className="text-[10px] font-medium text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                                        {comp.weightPct}% weight
                                      </span>
                                    </div>
                                    <div className="mt-1 flex items-baseline justify-between">
                                      <span className="text-sm font-bold text-slate-900">{comp.ratePct}%</span>
                                      <div className="text-right">
                                        <span className="text-[11px] font-bold text-violet-700">
                                          {comp.contributionPoints.toFixed(1)}
                                        </span>
                                        <span className="text-[10px] font-medium text-slate-400">
                                          {" "}/ {maxFactorPts.toFixed(1)} pts
                                        </span>
                                      </div>
                                    </div>
                                    <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500">
                                      <span className="truncate" title={comp.rawMetric}>
                                        {comp.rawMetric}
                                      </span>
                                      <span className="shrink-0 text-slate-400 text-[9px] font-medium pl-1">
                                        ({comp.ratePct}% of {maxFactorPts.toFixed(1)})
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : null}

                          {/* Individual Tasks List */}
                          {bucket.tasks?.length > 0 && (
                            <div>
                              <div className="font-semibold text-[11px] text-slate-700 mb-1.5">
                                Individual Tasks in this Bucket ({bucket.tasks.length}):
                              </div>
                              <div className="space-y-1.5">
                                {bucket.tasks.map((t: any) => {
                                  return (
                                    <div
                                      key={t.id}
                                      className="rounded-lg bg-white p-2.5 border border-slate-200 text-xs flex items-center justify-between gap-2"
                                    >
                                      <TaskLink taskId={t.id} className="truncate font-semibold text-blue-600 hover:underline">
                                        {t.title || "Untitled task"}
                                      </TaskLink>
                                      <div className="flex items-center gap-2 shrink-0 text-[11px]">
                                        <span className="text-slate-500 capitalize">{t.status.toLowerCase().replace(/_/g, " ")}</span>
                                        <span className="font-bold text-violet-700">{t.pointsResult.earnedPoints.toFixed(1)} / {t.pointsResult.maxPoints} pts</span>
                                      </div>
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

                {!perfSortedBuckets.length && (
                  <p className="py-4 text-center text-xs text-slate-400">
                    No KPI buckets assigned.
                  </p>
                )}
              </div>
            </Card>

            {/* Right 2 cols: What affected your score */}
            <Card className="p-4 sm:p-5 lg:col-span-2">
              <SectionTitle>
                {performanceTimeframe === "weekly" ? "WHAT AFFECTED THIS WEEK'S SCORE" : "WHAT AFFECTED YOUR SCORE"}
              </SectionTitle>
              <p className="text-xs text-slate-500 mb-3">
                Real performance drivers from {performanceTimeframe === "weekly" ? "this week's" : "current month"} activity.
              </p>

              <div className="space-y-2.5">
                {/* Insight 1: Tasks Completion */}
                <div className="flex items-start gap-2.5 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />
                  <div className="text-xs text-slate-700">
                    <span className="font-semibold text-slate-900">
                      {perfCompletedCount} of {perfTotalTasks} tasks completed
                    </span>
                    <p className="text-slate-500 mt-0.5">
                      {perfTotalTasks > 0 ? `${perfCompletionPct}% task completion rate (drives 60% completion weight).` : "No tasks logged in this timeframe yet."}
                    </p>
                  </div>
                </div>

                {/* Insight 2: Work Consistency */}
                <div className="flex items-start gap-2.5 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                  <Clock size={16} className="mt-0.5 shrink-0 text-blue-600" />
                  <div className="text-xs text-slate-700">
                    <span className="font-semibold text-slate-900">
                      {perfActiveDays} active work day{perfActiveDays === 1 ? "" : "s"}
                    </span>
                    <p className="text-slate-500 mt-0.5">
                      {performanceTimeframe === "weekly" ? "Daily activity logged throughout the current work week." : "Working across 6+ distinct days maximizes the 25% consistency factor."}
                    </p>
                  </div>
                </div>

                {/* Insight 3: Rework status */}
                <div className="flex items-start gap-2.5 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                  {perfReworkCount > 0 ? (
                    <>
                      <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
                      <div className="text-xs text-slate-700">
                        <span className="font-semibold text-amber-900">
                          {perfReworkCount} task(s) had rework/carries
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
                  <span className="mt-0.5 shrink-0 text-violet-600 text-sm">🎯</span>
                  <div className="text-xs text-slate-700">
                    <span className="font-semibold text-slate-900">
                      {perfActiveKpiCount} of {perfTotalKpiCount} KPI areas active
                    </span>
                    <p className="text-slate-500 mt-0.5">
                      {perfActiveKpiCount < perfTotalKpiCount
                        ? `${perfTotalKpiCount - perfActiveKpiCount} KPI bucket(s) unworked in this timeframe.`
                        : "Activity logged across all assigned KPI areas."}
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ── 3. Main Summary Cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {/* Total Tasks */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-medium uppercase tracking-wider text-slate-400">Total Tasks</div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{summaryCards.totalTasks}</div>
          <p className="mt-1 text-[11px] text-slate-500">Qualifying period volume</p>
        </div>

        {/* Completed */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wider text-slate-400">
            <span>Completed</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-emerald-700">{summaryCards.completedTasks}</span>
            <span className="text-xs font-semibold text-emerald-600">({summaryCards.completionRate}%)</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">Fully closed in period</p>
        </div>

        {/* On-Time */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wider text-slate-400">
            <span>On-Time</span>
            <Clock className="h-4 w-4 text-blue-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-blue-700">{summaryCards.onTimeCompletedTasks}</span>
            {summaryCards.onTimeRate != null && (
              <span className="text-xs font-semibold text-blue-600">({summaryCards.onTimeRate}%)</span>
            )}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">Met committed deadline</p>
        </div>

        {/* Active / In Progress */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wider text-slate-400">
            <span>Active / Open</span>
            <Layers className="h-4 w-4 text-violet-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-violet-700">{summaryCards.activeTasks}</div>
          <p className="mt-1 text-[11px] text-slate-500">Ongoing or in review</p>
        </div>

        {/* Reworked */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wider text-slate-400">
            <span>Reworked</span>
            <RotateCcw className="h-4 w-4 text-red-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-red-700">{summaryCards.reworkTasks}</span>
            <span className="text-xs font-semibold text-red-600">({summaryCards.reworkRate}%)</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">Quality rejections</p>
        </div>

        {/* Carried Forward */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wider text-slate-400">
            <span>Carried</span>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-amber-700">{summaryCards.carryTasks}</span>
            <span className="text-xs font-semibold text-amber-600">({summaryCards.carryRate}%)</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">Deferred past deadline</p>
        </div>
      </div>

      {/* ── 4. Work Summary Insights & Activity Trend ─────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Factual Work Summary */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-blue-600" />
            <h2 className="text-sm font-bold text-slate-900">Work Summary &amp; Key Observations</h2>
          </div>
          <div className="space-y-2.5">
            {workInsights.length > 0 ? (
              workInsights.map((insight, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs text-slate-700">
                  <span className="text-blue-500 font-bold">•</span>
                  <span>{insight}</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 italic">No qualifying task data recorded in this period.</p>
            )}
          </div>
        </div>

        {/* Task Activity Trend Chart */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              <h2 className="text-sm font-bold text-slate-900">Task Activity Trend ({range.label})</h2>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-medium text-slate-500">
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm bg-blue-500 inline-block" /> Created
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500 inline-block" /> Completed
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm bg-red-400 inline-block" /> Overdue
              </span>
            </div>
          </div>

          {/* Simple compact bar chart visualization */}
          <div className="pt-2">
            {activityTrend.length > 0 ? (
              <div className="grid grid-flow-col gap-2 items-end h-36 border-b border-slate-200 pb-2">
                {activityTrend.map((bucket, idx) => {
                  const maxVal = Math.max(1, ...activityTrend.map((b) => Math.max(b.created, b.completed, b.overdue)));
                  const hCreated = (bucket.created / maxVal) * 100;
                  const hCompleted = (bucket.completed / maxVal) * 100;
                  const hOverdue = (bucket.overdue / maxVal) * 100;

                  return (
                    <div key={idx} className="flex flex-col items-center justify-end h-full gap-1 group">
                      <div className="flex items-end gap-1 h-full w-full justify-center">
                        {/* Created bar */}
                        <div
                          title={`Created: ${bucket.created}`}
                          className="w-3 rounded-t bg-blue-500 transition-all hover:opacity-80"
                          style={{ height: `${Math.max(4, hCreated)}%` }}
                        />
                        {/* Completed bar */}
                        <div
                          title={`Completed: ${bucket.completed}`}
                          className="w-3 rounded-t bg-emerald-500 transition-all hover:opacity-80"
                          style={{ height: `${Math.max(4, hCompleted)}%` }}
                        />
                        {/* Overdue bar */}
                        {bucket.overdue > 0 && (
                          <div
                            title={`Overdue: ${bucket.overdue}`}
                            className="w-2.5 rounded-t bg-red-400 transition-all hover:opacity-80"
                            style={{ height: `${Math.max(4, hOverdue)}%` }}
                          />
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 font-medium truncate max-w-[60px] text-center">
                        {bucket.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex h-36 items-center justify-center text-xs text-slate-400">
                No trend activity recorded for this period.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 5. KPI Usage Analysis & Breakdown ─────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">KPI Usage &amp; Operational Focus</h2>
            <p className="text-xs text-slate-500">
              Distribution of actual task work across role KPI buckets in {range.label}.
            </p>
          </div>

          {mostUsedKpi && (
            <div className="rounded-xl border border-violet-100 bg-violet-50 px-3 py-1.5 text-xs text-violet-900">
              <span className="font-semibold text-violet-700">Top Focus Area:</span> {mostUsedKpi.kpiName} (
              <strong>{mostUsedKpi.totalTasks} tasks</strong> · {mostUsedKpi.usagePct}% of work)
            </div>
          )}
        </div>

        {/* ── KPI Usage Fire-Pipes & Water Buckets UI ────────────────────── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Each bucket represents an operational KPI. Water level indicates task volume relative to peak focus.</span>
            <span className="hidden sm:inline-block text-[11px] text-slate-400">Click a bucket to inspect tasks</span>
          </div>

          {/* Buckets Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
            {kpiUsage.map((kpi) => {
              const isSelected = expandedKpiId === kpi.kpiId;
              const fillPct = kpi.totalTasks > 0 ? Math.max(12, Math.round((kpi.totalTasks / maxKpiTasks) * 100)) : 0;
              const isTopFocus = mostUsedKpi?.kpiId === kpi.kpiId;

              return (
                <div
                  key={kpi.kpiId}
                  onClick={() => setExpandedKpiId(isSelected ? null : kpi.kpiId)}
                  className={cn(
                    "group relative flex flex-col justify-between rounded-2xl border bg-white p-3.5 transition-all duration-300 cursor-pointer select-none",
                    isSelected
                      ? "border-blue-500 bg-gradient-to-b from-blue-50/40 via-white to-white shadow-md ring-2 ring-blue-400/40"
                      : "border-slate-200/90 hover:border-slate-300 hover:shadow-md hover:bg-slate-50/30"
                  )}
                >
                  {/* Top badges */}
                  <div className="flex items-center justify-between gap-1 mb-2">
                    {isTopFocus ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-800">
                        <Flame size={10} className="fill-violet-600 text-violet-600" />
                        Top
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                        Bucket
                      </span>
                    )}

                    <span className="rounded-md bg-blue-50 border border-blue-100/80 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
                      {kpi.usagePct}% of work
                    </span>
                  </div>

                  {/* Physical Fire GI Pipe Water Bucket */}
                  <div className="py-2 flex justify-center">
                    <div className="relative" style={{ height: 130, width: 52 }}>
                      {/* top coupling / flange */}
                      <div
                        className="absolute -top-1 left-1/2 z-20 h-2.5 -translate-x-1/2 rounded-[3px] bg-gradient-to-r from-red-700 via-red-500 to-red-800 shadow-[0_1px_3px_rgba(0,0,0,0.3)] border border-red-900/30"
                        style={{ width: 58 }}
                      />
                      {/* bottom coupling / flange */}
                      <div
                        className="absolute -bottom-1 left-1/2 z-20 h-2.5 -translate-x-1/2 rounded-[3px] bg-gradient-to-r from-red-800 via-red-600 to-red-900 shadow-[0_1px_3px_rgba(0,0,0,0.3)] border border-red-950/30"
                        style={{ width: 58 }}
                      />

                      {/* pipe body: red rim, transparent glassy window */}
                      <div
                        className={cn(
                          "absolute inset-0 z-10 overflow-hidden rounded-[10px] border-[3px] bg-gradient-to-r from-slate-50/15 via-white/5 to-slate-100/15 backdrop-blur-[2px] shadow-[inset_0_2px_8px_rgba(0,0,0,0.2)] transition-all duration-300",
                          isSelected
                            ? "border-red-600 ring-2 ring-amber-400 ring-offset-1 shadow-[0_0_12px_rgba(239,68,68,0.5),inset_0_2px_8px_rgba(0,0,0,0.2)]"
                            : "border-red-600/85 ring-1 ring-red-800/20 shadow-[0_2px_6px_rgba(0,0,0,0.05),inset_0_2px_8px_rgba(0,0,0,0.2)] group-hover:border-red-600 group-hover:shadow-[0_4px_10px_rgba(239,68,68,0.25),inset_0_2px_8px_rgba(0,0,0,0.2)]"
                        )}
                        style={{ height: 130, width: 52 }}
                      >
                        {/* calibration ticks */}
                        <div className="absolute inset-y-2 left-1 z-25 flex flex-col justify-between w-1 opacity-40 pointer-events-none">
                          <div className="h-[1px] w-full bg-red-600" />
                          <div className="h-[1px] w-2/3 bg-red-600" />
                          <div className="h-[1px] w-full bg-red-600" />
                          <div className="h-[1px] w-2/3 bg-red-600" />
                          <div className="h-[1px] w-full bg-red-600" />
                        </div>
                        <div className="absolute inset-y-2 right-1 z-25 flex flex-col justify-between w-1 opacity-40 pointer-events-none">
                          <div className="h-[1px] w-full bg-red-600" />
                          <div className="h-[1px] w-2/3 bg-red-600" />
                          <div className="h-[1px] w-full bg-red-600" />
                          <div className="h-[1px] w-2/3 bg-red-600" />
                          <div className="h-[1px] w-full bg-red-600" />
                        </div>

                        {/* water column */}
                        <div
                          className={cn("absolute inset-x-0 bottom-0", kpi.totalTasks > 0 && "animate-waterBob")}
                          style={{ height: `${fillPct}%`, transition: "height 700ms cubic-bezier(0.22,1,0.36,1)" }}
                        >
                          <div
                            className={cn(
                              "absolute inset-0 transition-all duration-300",
                              kpi.totalTasks === 0
                                ? "bg-slate-200/10"
                                : "bg-gradient-to-t from-sky-600 via-sky-500 to-cyan-400 shadow-[inset_0_0_8px_rgba(14,165,233,0.5)]"
                            )}
                          />
                          {kpi.totalTasks > 0 && (
                            <>
                              <div className="absolute -top-1 left-0 h-2 w-[200%] animate-waterWave bg-gradient-to-r from-cyan-200/0 via-cyan-100/80 to-cyan-200/0" />
                              <div className="absolute top-0 inset-x-0 h-[3px] bg-cyan-200/80" />
                              <span className="animate-bubble absolute bottom-1 left-[25%] h-1.5 w-1.5 rounded-full bg-white/70" style={{ animationDelay: "0s" }} />
                              <span className="animate-bubble absolute bottom-2 left-[55%] h-1 w-1 rounded-full bg-white/60" style={{ animationDelay: "0.9s" }} />
                              <span className="animate-bubble absolute bottom-1 left-[70%] h-1.5 w-1.5 rounded-full bg-white/60" style={{ animationDelay: "1.6s" }} />
                            </>
                          )}
                        </div>

                        {/* glossy highlight */}
                        <div className="animate-pipeSheen pointer-events-none absolute inset-y-2 left-1 w-1 rounded-full bg-white/50" />
                        <div className="pointer-events-none absolute inset-y-0 right-0 w-2 bg-gradient-to-l from-red-900/15 to-transparent z-15" />

                        {/* count badge */}
                        <div className="absolute inset-0 grid place-items-center z-30 pointer-events-none">
                          <span
                            className={cn(
                              "flex items-center justify-center rounded-full font-bold tabular-nums border transition-all duration-300 shadow-sm h-7 w-7 text-xs",
                              kpi.totalTasks === 0
                                ? "bg-slate-100/90 border-slate-300 text-slate-500"
                                : "bg-white/95 border-cyan-200 text-cyan-900 shadow-cyan-100/50"
                            )}
                          >
                            {kpi.totalTasks}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bucket Name & summary */}
                  <div className="text-center mt-1">
                    <h3
                      className="font-bold text-xs text-slate-900 line-clamp-2 min-h-[32px] flex items-center justify-center leading-snug"
                      title={kpi.kpiName}
                    >
                      {kpi.kpiName}
                    </h3>
                    <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
                      {kpi.totalTasks} task{kpi.totalTasks === 1 ? "" : "s"}
                    </p>
                  </div>

                  {/* Metrics box */}
                  <div className="mt-2.5 rounded-xl bg-slate-50 border border-slate-100/80 p-2 space-y-1 text-[11px]">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Closed</span>
                      <span className="font-bold text-emerald-700">
                        {kpi.completedTasks}{" "}
                        <span className="text-[10px] font-normal text-slate-400">({kpi.completionRate}%)</span>
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">On-time</span>
                      <span className="font-bold text-blue-700">
                        {kpi.onTimeRate}%{" "}
                        <span className="text-[10px] font-normal text-slate-400">({kpi.onTimeTasks})</span>
                      </span>
                    </div>

                    {kpi.reworkTasks > 0 && (
                      <div className="flex justify-between items-center pt-0.5 text-red-600">
                        <span className="text-slate-500">Rework</span>
                        <span className="rounded-full bg-red-100 px-1.5 py-0.2 text-[10px] font-bold text-red-700">
                          {kpi.reworkTasks}×
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Expand button footer */}
                  <div className="mt-2.5 pt-1.5 border-t border-slate-100 flex items-center justify-center gap-1 text-[11px] font-semibold text-blue-600 group-hover:text-blue-700">
                    <span>{isSelected ? "Hide tasks" : "View tasks"}</span>
                    {isSelected ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Expanded Selected Bucket Inspection Drawer */}
          {selectedKpi && (
            <div className="rounded-2xl border-2 border-blue-200/90 bg-white p-4 shadow-sm space-y-3 transition-all duration-300">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-600 inline-block animate-pulse" />
                  <h3 className="font-bold text-sm text-slate-900">
                    Tasks in bucket: <span className="text-blue-700">{selectedKpi.kpiName}</span>
                  </h3>
                  <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-800">
                    {selectedKpi.tasks.length} task{selectedKpi.tasks.length === 1 ? "" : "s"}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 font-semibold text-emerald-800">
                    {selectedKpi.completedTasks} closed ({selectedKpi.completionRate}%)
                  </span>
                  <span className="rounded-md bg-blue-50 border border-blue-200 px-2 py-0.5 font-semibold text-blue-700">
                    {selectedKpi.onTimeRate}% on-time
                  </span>
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
                    {selectedKpi.usagePct}% of work
                  </span>

                  <button
                    type="button"
                    onClick={() => setExpandedKpiId(null)}
                    className="ml-2 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                    title="Close tasks list"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden bg-slate-50/30">
                {selectedKpi.tasks.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">
                    No tasks found in this bucket for this period.
                  </div>
                ) : (
                  selectedKpi.tasks.map((task) => (
                    <div key={task.id} className="flex items-center justify-between p-3 hover:bg-white transition text-xs">
                      <div className="min-w-0 flex-1 pr-3">
                        <TaskLink taskId={task.id} className="font-semibold text-slate-900 hover:text-blue-600 hover:underline">
                          {task.title}
                        </TaskLink>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1">
                          <span className="rounded bg-slate-200/70 px-1.5 py-0.2 font-medium">Priority: {task.priority}</span>
                          {task.dueAt && <span>• Due: {formatDisplayDate(task.dueAt)}</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                            task.status === "CLOSED"
                              ? "bg-emerald-100 text-emerald-800"
                              : task.status === "REOPENED"
                              ? "bg-red-100 text-red-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {task.status.replace("_", " ")}
                        </span>

                        {task.isOnTime === true && (
                          <span className="text-emerald-600 font-semibold text-[11px] flex items-center gap-0.5">
                            <CheckCircle2 size={12} /> On-time
                          </span>
                        )}
                        {task.isOnTime === false && (
                          <span className="text-red-600 font-semibold text-[11px] flex items-center gap-0.5">
                            <AlertTriangle size={12} /> Late
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {kpiUsage.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400">
              No KPI tasks were assigned or worked during this period.
            </div>
          )}
        </div>

        {/* ── PREVIOUS KPI LIST CODE (KEPT COMMENTED AS REQUESTED) ────────── */}
        {/*
        <div className="space-y-3">
          {kpiUsage.map((kpi) => {
            const isExpanded = expandedKpiId === kpi.kpiId;

            return (
              <div
                key={kpi.kpiId}
                className="rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition overflow-hidden"
              >
                <div
                  onClick={() => setExpandedKpiId(isExpanded ? null : kpi.kpiId)}
                  className="flex cursor-pointer flex-wrap items-center justify-between gap-3 p-3.5 select-none"
                >
                  <div className="min-w-[200px] flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">{kpi.kpiName}</span>
                      <span className="rounded-md bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-800">
                        {kpi.totalTasks} task{kpi.totalTasks === 1 ? "" : "s"}
                      </span>
                      <span className="text-xs font-semibold text-slate-500">({kpi.usagePct}% of work)</span>
                    </div>

                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-blue-600 transition-all duration-500"
                        style={{ width: `${Math.min(100, kpi.usagePct)}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs">
                    <div className="text-right">
                      <span className="font-semibold text-emerald-700">{kpi.completedTasks} closed</span>
                      <span className="text-slate-400 block text-[11px]">{kpi.completionRate}% completion</span>
                    </div>

                    <div className="text-right">
                      <span className="font-semibold text-blue-700">{kpi.onTimeRate}% on-time</span>
                      <span className="text-slate-400 block text-[11px]">{kpi.onTimeTasks} on schedule</span>
                    </div>

                    {kpi.reworkTasks > 0 && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700">
                        {kpi.reworkTasks}× rework
                      </span>
                    )}

                    <div className="text-slate-400 pl-1">
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-slate-200 bg-white p-3 space-y-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Tasks in {kpi.kpiName} ({kpi.tasks.length})
                    </div>
                    <div className="divide-y divide-slate-100 rounded-lg border border-slate-100 overflow-hidden">
                      {kpi.tasks.map((task) => (
                        <div key={task.id} className="flex items-center justify-between p-2.5 hover:bg-slate-50 text-xs">
                          <div className="min-w-0 flex-1 pr-3">
                            <TaskLink taskId={task.id} className="font-medium text-slate-900 hover:text-blue-600 hover:underline">
                              {task.title}
                            </TaskLink>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                              <span>Priority: {task.priority}</span>
                              {task.dueAt && <span>• Due: {formatDisplayDate(task.dueAt)}</span>}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                task.status === "CLOSED"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : task.status === "REOPENED"
                                  ? "bg-red-100 text-red-800"
                                  : "bg-blue-100 text-blue-800"
                              }`}
                            >
                              {task.status.replace("_", " ")}
                            </span>

                            {task.isOnTime === true && (
                              <span className="text-emerald-600 font-medium text-[11px] flex items-center gap-0.5">
                                <CheckCircle2 size={11} /> On-time
                              </span>
                            )}
                            {task.isOnTime === false && (
                              <span className="text-red-600 font-medium text-[11px] flex items-center gap-0.5">
                                <AlertTriangle size={11} /> Late
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {kpiUsage.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
              No KPI tasks were assigned or worked during this period.
            </div>
          )}
        </div>
        */}
      </div>

      {/* ── 6. Delivery Quality & Status Breakdown ─────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Delivery Quality Metrics with Dynamic Formulas */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <h2 className="text-sm font-bold text-slate-900">Delivery Quality &amp; Precision</h2>
          <div className="grid grid-cols-2 gap-3">
            {/* Completion Rate */}
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <span className="text-xs text-slate-500 font-medium">Completion Rate</span>
              <div className="mt-1 text-xl font-bold text-slate-900">{qualityExplanations.completion.rate}%</div>
              <p className="mt-1.5 text-[11px] text-slate-600 font-mono bg-white p-1 rounded border border-slate-200">
                {qualityExplanations.completion.formula}
              </p>
            </div>

            {/* On-Time Rate */}
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <span className="text-xs text-slate-500 font-medium">On-Time Rate</span>
              <div className="mt-1 text-xl font-bold text-blue-700">
                {qualityExplanations.onTime.rate != null ? `${qualityExplanations.onTime.rate}%` : "—"}
              </div>
              <p className="mt-1.5 text-[11px] text-slate-600 font-mono bg-white p-1 rounded border border-slate-200">
                {qualityExplanations.onTime.formula}
              </p>
            </div>

            {/* Rework Rate */}
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <span className="text-xs text-slate-500 font-medium">Rework Rate</span>
              <div className="mt-1 text-xl font-bold text-red-700">{qualityExplanations.rework.rate}%</div>
              <p className="mt-1.5 text-[11px] text-slate-600 font-mono bg-white p-1 rounded border border-slate-200">
                {qualityExplanations.rework.formula}
              </p>
            </div>

            {/* Carry-Forward Rate */}
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <span className="text-xs text-slate-500 font-medium">Carry-Forward Rate</span>
              <div className="mt-1 text-xl font-bold text-amber-700">{qualityExplanations.carry.rate}%</div>
              <p className="mt-1.5 text-[11px] text-slate-600 font-mono bg-white p-1 rounded border border-slate-200">
                {qualityExplanations.carry.formula}
              </p>
            </div>
          </div>
        </div>

        {/* Task Status Breakdown */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <h2 className="text-sm font-bold text-slate-900">Task Status Distribution</h2>
          <div className="space-y-2.5">
            {statusBreakdown.map((item) => (
              <div key={item.status} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-slate-800">{item.label}</span>
                  <span className="text-slate-500">
                    {item.count} tasks ({item.pct}%)
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div className={`h-full rounded-full ${item.tone}`} style={{ width: `${item.pct}%` }} />
                </div>
              </div>
            ))}

            {statusBreakdown.length === 0 && (
              <p className="text-xs text-slate-400 italic">No task statuses to display.</p>
            )}
          </div>
        </div>
      </div>

      {/* ── 7. Detailed Tasks Table in Period ─────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Tasks in this Period</h2>
            <p className="text-xs text-slate-500">
              Showing <strong>{filteredTasks.length}</strong> of {tasks.length} tasks
            </p>
          </div>

          {/* Table Search Input */}
          <div className="relative min-w-[240px]">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search task title..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-700"
          >
            <option value="ALL">All Statuses</option>
            <option value="CLOSED">Closed</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="PENDING_REVIEW">Pending Review</option>
            <option value="ON_HOLD">On Hold</option>
            <option value="REOPENED">Rework / Reopened</option>
            <option value="TODO">To Do</option>
          </select>

          {/* KPI Filter */}
          <select
            value={kpiFilter}
            onChange={(e) => {
              setKpiFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-700"
          >
            <option value="ALL">All KPI Areas</option>
            {allKpiNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => {
              setPriorityFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-700"
          >
            <option value="ALL">All Priorities</option>
            <option value="Do First">Do First (Urgent & Important)</option>
            <option value="Schedule">Schedule (Important)</option>
            <option value="Delegate">Delegate (Urgent)</option>
            <option value="Eliminate">Eliminate (Low)</option>
          </select>

          {/* Timeliness Filter */}
          <select
            value={timelinessFilter}
            onChange={(e) => {
              setTimelinessFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-700"
          >
            <option value="ALL">All Timeliness</option>
            <option value="ON_TIME">On-Time Delivery</option>
            <option value="LATE">Overdue / Late</option>
          </select>

          {/* Toggle Rework Only */}
          <button
            type="button"
            onClick={() => {
              setReworkOnly(!reworkOnly);
              setCurrentPage(1);
            }}
            className={`rounded-lg px-2.5 py-1 font-medium transition ${
              reworkOnly ? "bg-red-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            ↩ Reworked
          </button>

          {/* Toggle Carry Only */}
          <button
            type="button"
            onClick={() => {
              setCarryOnly(!carryOnly);
              setCurrentPage(1);
            }}
            className={`rounded-lg px-2.5 py-1 font-medium transition ${
              carryOnly ? "bg-amber-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            ↻ Carried Forward
          </button>
        </div>

        {/* Task Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-2.5 pl-3 pr-2">Task</th>
                <th className="px-2 py-2.5">KPI</th>
                <th className="px-2 py-2.5">Status</th>
                <th className="px-2 py-2.5">Priority</th>
                <th className="px-2 py-2.5">Due Date</th>
                <th className="px-2 py-2.5">Completed</th>
                <th className="px-2 py-2.5">Timeliness</th>
                <th className="px-2 py-2.5">Notes / Reasons</th>
                <th className="py-2.5 pl-2 pr-3 text-right">Planned Load</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedTasks.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50/70 transition">
                  <td className="py-2.5 pl-3 pr-2 font-medium text-slate-900">
                    <TaskLink taskId={t.id} className="hover:text-blue-600 hover:underline">
                      {t.title}
                    </TaskLink>
                  </td>
                  <td className="px-2 py-2.5">
                    <span className="rounded bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700">
                      {t.kpiName}
                    </span>
                  </td>
                  <td className="px-2 py-2.5">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        t.status === "CLOSED"
                          ? "bg-emerald-100 text-emerald-800"
                          : t.status === "REOPENED"
                          ? "bg-red-100 text-red-800"
                          : t.status === "ON_HOLD"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {t.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-2 py-2.5">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${t.priorityTone}`}>
                      {t.priority}
                    </span>
                  </td>
                  <td className="px-2 py-2.5 text-slate-600">
                    {formatDisplayDate(t.dueAt)}
                  </td>
                  <td className="px-2 py-2.5 text-slate-600">
                    {formatDisplayDate(t.completedAt)}
                  </td>
                  <td className="px-2 py-2.5">
                    {t.isOnTime === true ? (
                      <span className="inline-flex items-center gap-1 font-medium text-emerald-600">
                        <CheckCircle2 size={12} /> On-time
                      </span>
                    ) : t.isOnTime === false ? (
                      <span className="inline-flex items-center gap-1 font-medium text-red-600">
                        <AlertTriangle size={12} /> Overdue
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-2 py-2.5 text-slate-600">
                    {t.rejectionReason && (
                      <span className="text-red-700 font-medium block">
                        ↩ Rework: {t.rejectionReason}
                      </span>
                    )}
                    {t.holdReason && (
                      <span className="text-amber-700 font-medium block">
                        On hold: {t.holdReason}
                      </span>
                    )}
                    {t.carryCount > 0 && (
                      <span className="text-amber-600 font-medium block">
                        ↻ Carried {t.carryCount}×
                      </span>
                    )}
                    {!t.rejectionReason && !t.holdReason && t.carryCount === 0 && (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="py-2.5 pl-2 pr-3 text-right text-slate-500 font-medium">
                    {t.estimatedMins ? `${t.estimatedMins}m` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredTasks.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400">
            No tasks match your selected filters.
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2 text-xs">
            <span className="text-slate-500">
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1 font-medium text-slate-700 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1 font-medium text-slate-700 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Calculation Explanation Modal ──────────────────────── */}
      {showCalculationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-semibold text-slate-900">
                {performanceTimeframe === "weekly" ? "Weekly Score Calculation" : "Live Score Calculation"}
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
                  {performanceTimeframe === "weekly" ? "Weekly Normalization Formula" : "Live Normalization Formula"}
                </div>
                <div className="mt-2 text-sm font-semibold text-blue-900">
                  {perfTotalEarned} earned points ÷ {perfTotalPossible} possible points
                </div>
                <div className="text-xl font-bold text-blue-700 mt-1">
                  = {perfLiveScore.toFixed(1)}% (out of 100)
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-slate-600">
                  • <b>Earned Points ({perfTotalEarned} pts):</b> Sum of points calculated across active KPI buckets using the formula:
                </p>
                <div className="bg-slate-50 rounded-lg p-2 font-mono text-[11px] text-slate-700 border border-slate-200">
                  Weightage × (60% Completion + 25% Consistency + 15% Quality)
                </div>
                <p className="text-slate-600">
                  • <b>Assigned Targets &amp; Goals:</b> Any periodic targets assigned by authority appear in your Targets section and directly feed into the Target vs Actual component (Max 10% appraisal weight).
                </p>
              </div>

              <p className="text-[11px] text-slate-500 italic">
                {performanceTimeframe === "weekly"
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

      {/* ── Scoring Panel Popup Modal (Same as Directory) ──────────── */}
      {showScoringModal && (
        <DirectoryScoreModal
          employee={{
            id: employee.id,
            name: employee.name,
            email: employee.email,
            avatarUrl: employee.avatarUrl,
            roleTitle: employee.roleTitle,
            departmentName: employee.departmentName,
            managerName: employee.managerName,
            monthScore: performanceData?.latestFinal?.total ?? null,
            monthAutoScore: Math.round(perfLiveScore),
            avg6Months: performanceData?.avg ?? 0,
            monthsCount6Mo: 6,
            increment: {
              pct: performanceData?.incrementTotal ?? 0,
              label: performanceData?.band?.label ?? "Evaluating",
              tier: "STANDARD",
              tone: performanceData?.ready?.tone ?? "bg-blue-100 text-blue-700",
            },
            canScore: true,
          }}
          year={scoringYear}
          month={scoringMonth}
          monthLabel={scoringMonthLabel}
          onClose={() => setShowScoringModal(false)}
          onScoreUpdated={() => {
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
