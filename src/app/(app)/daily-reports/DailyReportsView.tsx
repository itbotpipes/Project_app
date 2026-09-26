"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RotateCcw,
  Sparkles,
  ChevronDown,
  ChevronUp,
  X,
  Target,
  FileText,
  UserCheck,
  UserX,
  Layers,
  ArrowUpRight,
} from "lucide-react";
import type { DailyReportSummary, PersonDailyReport } from "@/lib/dailyReportService";
import Avatar from "../_components/Avatar";
import TaskLink from "../_components/TaskLink";

export default function DailyReportsView({
  summary,
}: {
  summary: DailyReportSummary;
}) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ATTENTION" | "ON_TRACK" | "IN_PROGRESS" | "NO_ACTIVITY">("ALL");
  const [departmentFilter, setDepartmentFilter] = useState<string>("ALL");
  const [expandedEmpIds, setExpandedEmpIds] = useState<Set<string>>(() => {
    // By default, expand employees needing attention
    const initial = new Set<string>();
    summary.reports.forEach((r) => {
      if (r.status === "ATTENTION") initial.add(r.employee.id);
    });
    // Or expand the first 3 if none have attention
    if (initial.size === 0) {
      summary.reports.slice(0, 3).forEach((r) => initial.add(r.employee.id));
    }
    return initial;
  });

  // Date navigation handlers
  function handleDateChange(newDateStr: string) {
    if (!newDateStr) return;
    router.push(`/daily-reports?date=${newDateStr}`);
  }

  function shiftDate(days: number) {
    const d = new Date(summary.dateValue);
    d.setDate(d.getDate() + days);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    handleDateChange(dateStr);
  }

  // Toggle individual card expansion
  function toggleExpand(id: string) {
    setExpandedEmpIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Expand / collapse all
  function expandAll() {
    setExpandedEmpIds(new Set(summary.reports.map((r) => r.employee.id)));
  }

  function collapseAll() {
    setExpandedEmpIds(new Set());
  }

  // Filtered reports
  const filteredReports = useMemo(() => {
    return summary.reports.filter((r) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          r.employee.name.toLowerCase().includes(q) ||
          r.employee.roleTitle.toLowerCase().includes(q) ||
          r.employee.departmentName.toLowerCase().includes(q) ||
          r.employee.managerName.toLowerCase().includes(q) ||
          r.tasks.some((t) => t.title.toLowerCase().includes(q));
        if (!matches) return false;
      }

      // Department filter
      if (departmentFilter !== "ALL" && r.employee.departmentName !== departmentFilter) {
        return false;
      }

      // Status filter
      if (statusFilter !== "ALL" && r.status !== statusFilter) {
        return false;
      }

      return true;
    });
  }, [summary.reports, searchQuery, departmentFilter, statusFilter]);

  const allExpanded = filteredReports.length > 0 && filteredReports.every((r) => expandedEmpIds.has(r.employee.id));

  return (
    <div className="space-y-6">
      {/* Top Header & Date Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Person-Wise Daily Report</h1>
            {summary.isToday && (
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                Live Today
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500">
            Company-wide individual daily tracking for leadership &amp; management review.
          </p>
        </div>

        {/* Date Selector Controls */}
        <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
          <button
            type="button"
            onClick={() => shiftDate(-1)}
            title="Previous Day"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"
          >
            <ChevronLeft size={16} />
          </button>

          <div className="flex items-center gap-1.5 px-2">
            <Calendar size={14} className="text-blue-600" />
            <span className="text-xs font-semibold text-slate-800">{summary.dateLabel}</span>
          </div>

          <button
            type="button"
            onClick={() => shiftDate(1)}
            title="Next Day"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"
          >
            <ChevronRight size={16} />
          </button>

          <input
            type="date"
            value={summary.dateValue}
            onChange={(e) => handleDateChange(e.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer ml-1"
          />

          {!summary.isToday && (
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
                handleDateChange(todayStr);
              }}
              className="ml-1 rounded-lg bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition"
            >
              Today
            </button>
          )}
        </div>
      </div>

      {/* Higher Authority Executive KPI Dashboard */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Active Reporting */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-slate-400">
            <span>Daily Reporting</span>
            <UserCheck className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-slate-900">{summary.reportedEmployeesCount}</span>
            <span className="text-sm font-medium text-slate-400">/ {summary.totalEmployees} people</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{
                width: `${summary.totalEmployees > 0 ? (summary.reportedEmployeesCount / summary.totalEmployees) * 100 : 0}%`,
              }}
            />
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            {summary.totalEmployees > 0
              ? `${Math.round((summary.reportedEmployeesCount / summary.totalEmployees) * 100)}% active team members`
              : "No team members"}
          </p>
        </div>

        {/* Closed Tasks Today */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-slate-400">
            <span>Tasks Closed Today</span>
            <CheckCircle2 className="h-4 w-4 text-blue-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-blue-700">{summary.totalClosedToday}</span>
            <span className="text-xs font-medium text-slate-400">completed</span>
          </div>
          <p className="mt-3 text-[11px] text-slate-500">
            Across all KPI buckets &amp; sites
          </p>
        </div>

        {/* On-Time Rate */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-slate-400">
            <span>On-Time Delivery</span>
            <Clock className="h-4 w-4 text-violet-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-violet-700">{summary.overallOnTimeRate}%</span>
            <span className="text-xs font-medium text-slate-400">on-time</span>
          </div>
          <p className="mt-3 text-[11px] text-slate-500">
            Commitment &amp; deadline adherence
          </p>
        </div>

        {/* Critical Flags / Attention */}
        <div className={`rounded-xl border p-4 shadow-sm ${summary.attentionCount > 0 ? "border-red-200 bg-red-50/30" : "border-slate-200 bg-white"}`}>
          <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-slate-400">
            <span>Needs Attention</span>
            <AlertTriangle className={`h-4 w-4 ${summary.attentionCount > 0 ? "text-red-600 animate-pulse" : "text-slate-400"}`} />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className={`text-2xl font-bold ${summary.attentionCount > 0 ? "text-red-700" : "text-slate-900"}`}>
              {summary.attentionCount}
            </span>
            <span className="text-xs font-medium text-slate-400">flagged members</span>
          </div>
          <p className="mt-3 text-[11px] text-slate-500">
            {summary.attentionCount > 0 ? "Overdue tasks or rework rejections" : "No active red flags"}
          </p>
        </div>
      </div>

      {/* Control Bar: Search & Status Filters */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Real-time search */}
          <div className="relative min-w-[260px] max-w-sm flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search person, role, department or task..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-8 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Department Filter & Expand/Collapse All */}
          <div className="flex items-center gap-2">
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 focus:border-blue-500 focus:outline-none"
            >
              <option value="ALL">All Departments</option>
              {summary.departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept} ({summary.departmentCounts[dept] ?? 0})
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={allExpanded ? collapseAll : expandAll}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 transition"
            >
              {allExpanded ? "Collapse All" : "Expand All"}
            </button>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={() => setStatusFilter("ALL")}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
              statusFilter === "ALL"
                ? "bg-slate-900 text-white shadow-sm"
                : "bg-slate-50 text-slate-600 hover:bg-slate-100"
            }`}
          >
            All Reports ({summary.totalEmployees})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("ATTENTION")}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
              statusFilter === "ATTENTION"
                ? "bg-red-600 text-white shadow-sm"
                : "bg-red-50 text-red-700 hover:bg-red-100"
            }`}
          >
            🚨 Needs Attention ({summary.attentionCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("ON_TRACK")}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
              statusFilter === "ON_TRACK"
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            }`}
          >
            ✅ Closed Tasks ({summary.reports.filter((r) => r.status === "ON_TRACK").length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("IN_PROGRESS")}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
              statusFilter === "IN_PROGRESS"
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-blue-50 text-blue-700 hover:bg-blue-100"
            }`}
          >
            🔄 In Progress ({summary.reports.filter((r) => r.status === "IN_PROGRESS").length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("NO_ACTIVITY")}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
              statusFilter === "NO_ACTIVITY"
                ? "bg-slate-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            ⚪ No Activity ({summary.noActivityCount})
          </button>

          <span className="ml-auto text-xs text-slate-400">
            Showing <strong>{filteredReports.length}</strong> of {summary.totalEmployees}
          </span>
        </div>
      </div>

      {/* Person-Wise Report Cards List */}
      <div className="space-y-3">
        {filteredReports.map((report) => {
          const emp = report.employee;
          const isExpanded = expandedEmpIds.has(emp.id);
          const hasTasks = report.tasks.length > 0;

          return (
            <div
              key={emp.id}
              className={`rounded-2xl border transition-all duration-200 ${
                report.status === "ATTENTION"
                  ? "border-red-200 bg-white shadow-sm ring-1 ring-red-100"
                  : "border-slate-200 bg-white shadow-sm hover:border-slate-300"
              }`}
            >
              {/* Card Header Row */}
              <div
                onClick={() => toggleExpand(emp.id)}
                className="flex cursor-pointer flex-wrap items-center justify-between gap-3 p-4 select-none"
              >
                {/* Person Profile Info */}
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={emp.name} url={emp.avatarUrl} size={38} />
                  <div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/people/${emp.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-bold text-slate-900 hover:text-blue-600 hover:underline flex items-center gap-1"
                      >
                        {emp.name}
                        <ArrowUpRight size={13} className="text-slate-400" />
                      </Link>
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                        {emp.departmentName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                      <span>{emp.roleTitle}</span>
                      <span>•</span>
                      <span>Manager: <strong className="text-slate-700">{emp.managerName}</strong></span>
                    </div>
                  </div>
                </div>

                {/* Status Badges & Quick Metrics for Higher Authority */}
                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Ritual Indicator */}
                  <div className="hidden md:flex items-center gap-1 text-[11px]">
                    <span
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-medium ${
                        report.ritual.morningPlanned
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-slate-100 text-slate-500"
                      }`}
                      title="Morning Ritual Planning"
                    >
                      {report.ritual.morningPlanned ? "✓ Planned" : "Not planned"}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-medium ${
                        report.ritual.eveningClosed
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-slate-100 text-slate-500"
                      }`}
                      title="Evening Sign-off"
                    >
                      {report.ritual.eveningClosed ? "✓ Signed off" : "Pending sign-off"}
                    </span>
                  </div>

                  {/* Closed Count & On Time */}
                  {report.metrics.closedToday > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200">
                      <CheckCircle2 size={13} />
                      {report.metrics.closedToday} Closed
                      {report.metrics.onTimeRate != null && (
                        <span className="text-[10px] text-emerald-600 font-normal">
                          ({report.metrics.onTimeRate}% on-time)
                        </span>
                      )}
                    </span>
                  )}

                  {/* Overdue alert */}
                  {report.metrics.overdueCount > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-800">
                      <AlertTriangle size={13} />
                      {report.metrics.overdueCount} Overdue
                    </span>
                  )}

                  {/* Rework alert */}
                  {report.metrics.reworkCount > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700 border border-red-200">
                      <RotateCcw size={12} />
                      {report.metrics.reworkCount}× Rework
                    </span>
                  )}

                  {/* In Progress count */}
                  {report.metrics.inProgressToday > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                      {report.metrics.inProgressToday} Active
                    </span>
                  )}

                  {/* Main Status Pill */}
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold border ${report.statusTone}`}>
                    {report.statusLabel}
                  </span>

                  {/* Chevron Toggle */}
                  <div className="text-slate-400 pl-1">
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>
              </div>

              {/* Expanded Details Section */}
              {isExpanded && (
                <div className="border-t border-slate-100 bg-slate-50/60 p-4 space-y-3">
                  {/* Evening reflection if submitted */}
                  {report.ritual.reflection && (
                    <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3 text-xs text-slate-700">
                      <span className="font-semibold text-blue-900 block mb-0.5">📝 Evening Sign-Off Reflection:</span>
                      <p className="italic">{report.ritual.reflection}</p>
                    </div>
                  )}

                  {/* KPIs Worked Today */}
                  {report.metrics.kpisTouched.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="text-slate-400 font-medium">KPI Buckets Worked Today:</span>
                      {report.metrics.kpisTouched.map((kpi) => (
                        <span key={kpi} className="rounded-md bg-violet-100 px-2 py-0.5 font-medium text-violet-800 text-[11px]">
                          {kpi}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Task List Table */}
                  {hasTasks ? (
                    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                            <th className="py-2.5 pl-3 pr-2">Task</th>
                            <th className="px-2 py-2.5">Status</th>
                            <th className="px-2 py-2.5">KPI Bucket</th>
                            <th className="px-2 py-2.5">Priority</th>
                            <th className="px-2 py-2.5">Timeliness</th>
                            <th className="px-2 py-2.5">Notes / Reasons</th>
                            <th className="py-2.5 pl-2 pr-3 text-right">Estimate</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {report.tasks.map((task) => (
                            <tr key={task.id} className="hover:bg-slate-50/70">
                              <td className="py-2.5 pl-3 pr-2 font-medium text-slate-900">
                                <TaskLink taskId={task.id} className="hover:text-blue-600 hover:underline">
                                  {task.title}
                                </TaskLink>
                              </td>
                              <td className="px-2 py-2.5">
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                  task.status === "CLOSED"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : task.status === "REOPENED"
                                    ? "bg-red-100 text-red-800"
                                    : task.status === "ON_HOLD"
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-blue-100 text-blue-800"
                                }`}>
                                  {task.status.replace("_", " ")}
                                </span>
                              </td>
                              <td className="px-2 py-2.5 text-slate-600">
                                {task.kpiName ? (
                                  <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-700">
                                    {task.kpiName}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                              <td className="px-2 py-2.5">
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${task.priorityTone}`}>
                                  {task.priority}
                                </span>
                              </td>
                              <td className="px-2 py-2.5">
                                {task.isOnTime === true ? (
                                  <span className="inline-flex items-center gap-1 font-medium text-emerald-600">
                                    <CheckCircle2 size={12} /> On-time
                                  </span>
                                ) : task.isOnTime === false ? (
                                  <span className="inline-flex items-center gap-1 font-medium text-red-600">
                                    <AlertTriangle size={12} /> Overdue
                                  </span>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                              <td className="px-2 py-2.5 text-slate-600">
                                {task.rejectionReason && (
                                  <span className="text-red-700 font-medium">
                                    ↩ Rework: {task.rejectionReason}
                                  </span>
                                )}
                                {task.holdReason && (
                                  <span className="text-amber-700 font-medium">
                                    On hold: {task.holdReason}
                                  </span>
                                )}
                                {!task.rejectionReason && !task.holdReason && (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                              <td className="py-2.5 pl-2 pr-3 text-right text-slate-500 font-medium">
                                {task.estimatedMins ? `${task.estimatedMins}m` : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-center text-xs text-slate-400">
                      No tasks were created or completed by {emp.name} on this date.
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {filteredReports.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-400">
            No person-wise reports match your filters.
          </div>
        )}
      </div>
    </div>
  );
}
