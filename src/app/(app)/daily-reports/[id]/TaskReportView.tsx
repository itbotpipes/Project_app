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
} from "lucide-react";
import Avatar from "../../_components/Avatar";
import TaskLink from "../../_components/TaskLink";
import type { EmployeeTaskReportData, TaskReportItem, KpiUsageDetail } from "@/lib/taskReportService";
import type { RangeType } from "@/lib/dateRanges";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDisplayDate(dateInput?: string | Date | null): string {
  if (!dateInput) return "—";
  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return "—";
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

export default function TaskReportView({ data }: { data: EmployeeTaskReportData }) {
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

        {/* Secondary link to Performance Score */}
        <Link
          href={`/people/${employee.id}`}
          className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
        >
          View Performance Score
          <ArrowUpRight size={13} />
        </Link>
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

        {/* KPI Usage Bars List */}
        <div className="space-y-3">
          {kpiUsage.map((kpi) => {
            const isExpanded = expandedKpiId === kpi.kpiId;

            return (
              <div
                key={kpi.kpiId}
                className="rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition overflow-hidden"
              >
                {/* Header row */}
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

                    {/* Horizontal usage bar */}
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-blue-600 transition-all duration-500"
                        style={{ width: `${Math.min(100, kpi.usagePct)}%` }}
                      />
                    </div>
                  </div>

                  {/* Summary badges for KPI */}
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

                {/* Expanded KPI Task List */}
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
    </div>
  );
}
