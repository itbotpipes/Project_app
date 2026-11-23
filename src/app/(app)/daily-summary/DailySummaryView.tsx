"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Search,
  CheckCircle2,
  Clock,
  PauseCircle,
  FileCheck,
  ArrowRight,
  TrendingUp,
  Users,
  RotateCw,
  Sparkles,
  Layers,
  Check,
  AlertCircle,
  FileSpreadsheet,
  Building2,
  User,
  Share2,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Card, SectionTitle, Badge } from "../_components/ui";
import Avatar from "../_components/Avatar";
import DailySummaryTemplateCard from "./DailySummaryTemplateCard";
import DepartmentSummaryCard from "./DepartmentSummaryCard";
import { triggerEndOfDaySummaryAction } from "@/lib/actions/dailyWorkSummary";
import type {
  CompanyDailyWorkSummariesResult,
  EmployeeDailyWorkSummary,
  DepartmentDailyWorkSummary,
} from "@/lib/dailyWorkSummaryTypes";

export default function DailySummaryView({
  data,
  currentUserId,
  isAdminOrManager,
  initialView = "DEPARTMENT",
  initialDept,
}: {
  data: CompanyDailyWorkSummariesResult;
  currentUserId: string;
  isAdminOrManager: boolean;
  initialView?: "DEPARTMENT" | "INDIVIDUAL";
  initialDept?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Mode: Department Summaries vs Individual Summaries
  const [viewMode, setViewMode] = useState<"DEPARTMENT" | "INDIVIDUAL">(initialView);

  // Selected Department
  const [selectedDeptName, setSelectedDeptName] = useState<string>(() => {
    if (initialDept) {
      const match = data.departmentSummaries.find(
        (d) => d.departmentName.toLowerCase() === initialDept.toLowerCase()
      );
      if (match) return match.departmentName;
    }
    // Default to viewer's department or "Design" or first available
    if (data.userDepartmentName) {
      const match = data.departmentSummaries.find(
        (d) => d.departmentName === data.userDepartmentName
      );
      if (match) return match.departmentName;
    }
    const designMatch = data.departmentSummaries.find(
      (d) => d.departmentName.toLowerCase() === "design"
    );
    if (designMatch) return designMatch.departmentName;
    return data.departmentSummaries[0]?.departmentName || "Design";
  });

  // Selected Employee (for Individual view)
  const [selectedEmpId, setSelectedEmpId] = useState<string>(
    data.selectedSummary?.employeeId || currentUserId
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("ALL");
  const [actionMessage, setActionMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Date handlers
  function handleDateChange(newDateStr: string) {
    if (!newDateStr) return;
    router.push(
      `/daily-summary?date=${newDateStr}&view=${viewMode.toLowerCase()}&dept=${encodeURIComponent(
        selectedDeptName
      )}&emp=${selectedEmpId}`
    );
  }

  function shiftDate(days: number) {
    const parts = data.dateValue.split("-");
    if (parts.length === 3) {
      const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      d.setDate(d.getDate() + days);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      handleDateChange(`${y}-${m}-${day}`);
    }
  }

  function handleSelectToday() {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    handleDateChange(`${y}-${m}-${day}`);
  }

  // Trigger End of Day Process
  function handleRunEndOfDay() {
    if (isPending) return;
    setActionMessage(null);
    startTransition(async () => {
      const res = await triggerEndOfDaySummaryAction({
        date: data.dateValue,
        employeeId: !isAdminOrManager ? currentUserId : undefined,
      });
      if (res.success) {
        setActionMessage({
          type: "success",
          text: `End-of-day summary generated for ${res.processedCount} employee(s). Next working day: ${res.nextWorkingDay}`,
        });
        router.refresh();
      } else {
        setActionMessage({
          type: "error",
          text: res.error || "Failed to run end-of-day process.",
        });
      }
    });
  }

  // Filtered department list for individual filter
  const departments = useMemo(() => {
    const set = new Set<string>();
    data.summaries.forEach((s) => {
      if (s.departmentName) set.add(s.departmentName);
    });
    return ["ALL", ...Array.from(set).sort()];
  }, [data.summaries]);

  // Filtered department summaries for department search
  const filteredDepartmentSummaries = useMemo(() => {
    if (!searchQuery.trim()) return data.departmentSummaries;
    const q = searchQuery.toLowerCase();
    return data.departmentSummaries.filter(
      (d) =>
        d.departmentName.toLowerCase().includes(q) ||
        d.members.some((m) => m.employeeName.toLowerCase().includes(q))
    );
  }, [data.departmentSummaries, searchQuery]);

  // Currently viewed department summary
  const currentDepartmentSummary = useMemo(() => {
    return (
      data.departmentSummaries.find((d) => d.departmentName === selectedDeptName) ||
      data.departmentSummaries[0] ||
      null
    );
  }, [data.departmentSummaries, selectedDeptName]);

  // Filtered summaries for the manager/admin table in Individual mode
  const filteredSummaries = useMemo(() => {
    return data.summaries.filter((s) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          s.employeeName.toLowerCase().includes(q) ||
          s.roleTitle.toLowerCase().includes(q) ||
          s.departmentName.toLowerCase().includes(q);
        if (!match) return false;
      }
      if (departmentFilter !== "ALL" && s.departmentName !== departmentFilter) {
        return false;
      }
      return true;
    });
  }, [data.summaries, searchQuery, departmentFilter]);

  // Currently viewed individual summary
  const currentSummary = useMemo(() => {
    return (
      data.summaries.find((s) => s.employeeId === selectedEmpId) ||
      data.selectedSummary ||
      data.summaries[0] ||
      null
    );
  }, [data.summaries, data.selectedSummary, selectedEmpId]);

  function handleSelectEmployeeFromDept(empId: string) {
    setSelectedEmpId(empId);
    setViewMode("INDIVIDUAL");
    window.scrollTo({ top: 300, behavior: "smooth" });
  }

  function handleJumpToDepartment(deptName: string) {
    setSelectedDeptName(deptName);
    setViewMode("DEPARTMENT");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="space-y-6">
      {/* Top Bar: Title & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-600 text-white rounded-xl shadow-xs">
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Daily Work Summary
              </h1>
              <p className="text-xs text-slate-500">
                Official department & employee daily work reports, productivity tracking & automatic task carry forward
              </p>
            </div>
          </div>
        </div>

        {/* Date Picker & Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Previous / Next Date Controls */}
          <div className="flex items-center rounded-xl border border-slate-200 bg-white p-1 shadow-xs">
            <button
              onClick={() => shiftDate(-1)}
              className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 transition"
              title="Previous Day"
            >
              <ChevronLeft size={16} />
            </button>

            <div className="relative flex items-center px-2">
              <input
                type="date"
                value={data.dateValue}
                onChange={(e) => handleDateChange(e.target.value)}
                className="text-xs font-semibold text-slate-800 bg-transparent border-none cursor-pointer focus:outline-hidden"
              />
            </div>

            <button
              onClick={() => shiftDate(1)}
              className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 transition"
              title="Next Day"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {!data.isToday && (
            <button
              onClick={handleSelectToday}
              className="px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 transition"
            >
              Today
            </button>
          )}

          {/* Run EOD Summary Button */}
          <button
            onClick={handleRunEndOfDay}
            disabled={isPending}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-xs active:scale-95 transition disabled:opacity-50"
            title="Generate summary snapshot and carry forward unfinished tasks"
          >
            <RotateCw size={14} className={cn(isPending && "animate-spin")} />
            {isPending ? "Generating..." : "Run End-of-Day Summary"}
          </button>
        </div>
      </div>

      {/* Action Notification Message */}
      {actionMessage && (
        <div
          className={cn(
            "p-4 rounded-xl text-xs font-medium flex items-center justify-between border transition",
            actionMessage.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-red-50 text-red-800 border-red-200"
          )}
        >
          <div className="flex items-center gap-2">
            {actionMessage.type === "success" ? (
              <Check size={16} className="text-emerald-600" />
            ) : (
              <AlertCircle size={16} className="text-red-600" />
            )}
            <span>{actionMessage.text}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="text-xs opacity-70 hover:opacity-100 font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* View Mode Segmented Control: Department vs Individual */}
      <div className="flex items-center justify-between flex-wrap gap-3 p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200/80">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setViewMode("DEPARTMENT")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition shadow-2xs",
              viewMode === "DEPARTMENT"
                ? "bg-white text-slate-900 shadow-xs border border-slate-200/80"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
            )}
          >
            <Building2 size={15} className={cn(viewMode === "DEPARTMENT" ? "text-blue-600" : "text-slate-400")} />
            <span>Department Summaries</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              {data.departmentSummaries.length} Depts
            </span>
          </button>

          <button
            onClick={() => setViewMode("INDIVIDUAL")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition shadow-2xs",
              viewMode === "INDIVIDUAL"
                ? "bg-white text-slate-900 shadow-xs border border-slate-200/80"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
            )}
          >
            <User size={15} className={cn(viewMode === "INDIVIDUAL" ? "text-blue-600" : "text-slate-400")} />
            <span>Individual Summaries</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-slate-200 text-slate-700">
              {data.summaries.length} Members
            </span>
          </button>
        </div>

        <div className="text-xs text-slate-500 font-medium px-2">
          {viewMode === "DEPARTMENT"
            ? "Consolidated department-wide daily reports for sharing to all"
            : "Individual daily work reports & productivity cards"}
        </div>
      </div>

      {/* ============================================================== */}
      {/* MODE 1: DEPARTMENT SUMMARIES                                    */}
      {/* ============================================================== */}
      {viewMode === "DEPARTMENT" && (
        <div className="space-y-6">
          {/* Department Selector Ribbon */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
              <span>Select Department</span>
              <span className="text-slate-400">
                Click any department to generate & share its daily work summary
              </span>
            </div>

            {/* Department Quick Switcher Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1.5">
              {data.departmentSummaries.map((dept) => {
                const isSelected = dept.departmentName === selectedDeptName;
                return (
                  <button
                    key={dept.departmentName}
                    onClick={() => setSelectedDeptName(dept.departmentName)}
                    className={cn(
                      "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition border shadow-2xs",
                      isSelected
                        ? "bg-blue-600 text-white border-blue-600 shadow-xs ring-2 ring-blue-600/20"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                    )}
                  >
                    <Building2 size={14} className={isSelected ? "text-white" : "text-slate-400"} />
                    <span>{dept.departmentName}</span>
                    <span
                      className={cn(
                        "px-1.5 py-0.2 rounded-full text-[10px] font-bold",
                        isSelected
                          ? "bg-blue-700 text-white"
                          : "bg-slate-100 text-slate-600"
                      )}
                    >
                      {dept.totalEmployees}
                    </span>
                    <span
                      className={cn(
                        "px-1.5 py-0.2 rounded-full text-[10px] font-bold",
                        isSelected
                          ? "bg-blue-500 text-white"
                          : dept.productivityPercentage !== null && dept.productivityPercentage >= 80
                          ? "bg-emerald-100 text-emerald-800"
                          : dept.productivityPercentage !== null && dept.productivityPercentage >= 50
                          ? "bg-blue-50 text-blue-800"
                          : "bg-slate-100 text-slate-600"
                      )}
                    >
                      {dept.productivityLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Department Work Summary Card */}
          {currentDepartmentSummary ? (
            <DepartmentSummaryCard
              department={currentDepartmentSummary}
              onSelectEmployee={handleSelectEmployeeFromDept}
            />
          ) : (
            <Card className="p-8 text-center text-slate-500">
              No department work summary available for {selectedDeptName} on this date.
            </Card>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* MODE 2: INDIVIDUAL SUMMARIES                                    */}
      {/* ============================================================== */}
      {viewMode === "INDIVIDUAL" && (
        <div className="space-y-6">
          {/* TEAM OVERVIEW (If Admin or Manager) */}
          {data.viewScope !== "SELF" && (
            <div className="space-y-4">
              <SectionTitle
                action={
                  <span className="text-xs font-semibold text-slate-500">
                    {filteredSummaries.length} Member{filteredSummaries.length === 1 ? "" : "s"}
                  </span>
                }
              >
                Team Daily Overview – {data.dateLabel}
              </SectionTitle>

              {/* Summary Stat Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <Card className="p-4 border-slate-200/90 shadow-2xs">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Team Productivity</span>
                    <TrendingUp size={14} className="text-blue-600" />
                  </div>
                  <div className="text-2xl font-bold text-slate-900 mt-1">
                    {data.teamMetrics.averageProductivityLabel}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Task completion rate</div>
                </Card>

                <Card className="p-4 border-slate-200/90 shadow-2xs">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Total Planned</span>
                    <Layers size={14} className="text-slate-400" />
                  </div>
                  <div className="text-2xl font-bold text-slate-900 mt-1">
                    {data.teamMetrics.totalPlannedTasks}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Across all members</div>
                </Card>

                <Card className="p-4 border-emerald-200/60 bg-emerald-50/20 shadow-2xs">
                  <div className="flex items-center justify-between text-xs text-emerald-700">
                    <span>Completed</span>
                    <CheckCircle2 size={14} className="text-emerald-600" />
                  </div>
                  <div className="text-2xl font-bold text-emerald-700 mt-1">
                    {data.teamMetrics.totalCompletedTasks}
                  </div>
                  <div className="text-[11px] text-emerald-600/80 mt-0.5">Finished today</div>
                </Card>

                <Card className="p-4 border-sky-200/60 bg-sky-50/20 shadow-2xs">
                  <div className="flex items-center justify-between text-xs text-sky-700">
                    <span>Pending</span>
                    <Clock size={14} className="text-sky-600" />
                  </div>
                  <div className="text-2xl font-bold text-sky-700 mt-1">
                    {data.teamMetrics.totalPendingTasks}
                  </div>
                  <div className="text-[11px] text-sky-600/80 mt-0.5">Still in progress</div>
                </Card>

                <Card className="p-4 border-amber-200/60 bg-amber-50/20 shadow-2xs">
                  <div className="flex items-center justify-between text-xs text-amber-700">
                    <span>On Hold</span>
                    <PauseCircle size={14} className="text-amber-600" />
                  </div>
                  <div className="text-2xl font-bold text-amber-700 mt-1">
                    {data.teamMetrics.totalOnHoldTasks}
                  </div>
                  <div className="text-[11px] text-amber-600/80 mt-0.5">Paused with reason</div>
                </Card>

                <Card className="p-4 border-orange-200/60 bg-orange-50/20 shadow-2xs">
                  <div className="flex items-center justify-between text-xs text-orange-700">
                    <span>Carrying Forward</span>
                    <ArrowRight size={14} className="text-orange-600" />
                  </div>
                  <div className="text-2xl font-bold text-orange-700 mt-1">
                    {data.teamMetrics.totalCarryForwardTasks}
                  </div>
                  <div className="text-[11px] text-orange-600/80 mt-0.5">To next working day</div>
                </Card>
              </div>

              {/* Search, Filter & Member Selection Grid */}
              <Card className="p-4 border-slate-200 space-y-4">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  {/* Search */}
                  <div className="relative w-full sm:w-72">
                    <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search employee, role, or team..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:border-blue-500"
                    />
                  </div>

                  {/* Department Filter Pills */}
                  <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto py-1">
                    {departments.map((dept) => (
                      <button
                        key={dept}
                        onClick={() => setDepartmentFilter(dept)}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition",
                          departmentFilter === dept
                            ? "bg-blue-600 text-white"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        )}
                      >
                        {dept}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Employee Quick Selector Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-72 overflow-y-auto pr-1">
                  {filteredSummaries.map((s) => {
                    const isSelected = s.employeeId === selectedEmpId;
                    const pct = s.productivityPercentage;
                    const badgeColor =
                      pct === null
                        ? "bg-slate-100 text-slate-600 border-slate-200"
                        : pct >= 80
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                        : pct >= 50
                        ? "bg-blue-50 text-blue-800 border-blue-200"
                        : "bg-amber-50 text-amber-800 border-amber-200";

                    return (
                      <div
                        key={s.employeeId}
                        onClick={() => setSelectedEmpId(s.employeeId)}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-xl border cursor-pointer transition text-left",
                          isSelected
                            ? "border-blue-600 bg-blue-50/50 ring-2 ring-blue-600/20"
                            : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/60"
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Avatar name={s.employeeName} url={s.avatarUrl} size={32} />
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-900 truncate">
                              {s.employeeName}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate">
                              {s.roleTitle} · {s.departmentName}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1 shrink-0 ml-2">
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded-full text-[11px] font-bold border",
                              badgeColor
                            )}
                          >
                            {s.productivityLabel}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">
                            {s.completedCount}/{s.totalTasks} done
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          )}

          {/* INDIVIDUAL DAILY WORK SUMMARY TEMPLATE */}
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              {data.viewScope !== "SELF" && (
                <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <span>Viewing Report for:</span>
                  <span className="text-blue-600">{currentSummary?.employeeName}</span>
                </h3>
              )}

              {currentSummary?.departmentName && (
                <button
                  onClick={() => handleJumpToDepartment(currentSummary.departmentName)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold text-blue-600 hover:text-blue-800 hover:bg-blue-50 border border-blue-200 transition"
                >
                  <Building2 size={13} />
                  <span>View {currentSummary.departmentName} Department Summary →</span>
                </button>
              )}
            </div>

            {currentSummary ? (
              <DailySummaryTemplateCard summary={currentSummary} />
            ) : (
              <Card className="p-8 text-center text-slate-500">
                No work summary found for this date.
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
