"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Building2,
  User,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Card } from "../_components/ui";
import Avatar from "../_components/Avatar";
import DailySummaryTemplateCard from "./DailySummaryTemplateCard";
import DepartmentSummaryCard from "./DepartmentSummaryCard";
import type {
  CompanyDailyWorkSummariesResult,
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

  // Department filter options
  const departments = useMemo(() => {
    const set = new Set<string>();
    data.summaries.forEach((s) => {
      if (s.departmentName) set.add(s.departmentName);
    });
    return ["ALL", ...Array.from(set).sort()];
  }, [data.summaries]);

  // Currently viewed department summary
  const currentDepartmentSummary = useMemo(() => {
    return (
      data.departmentSummaries.find((d) => d.departmentName === selectedDeptName) ||
      data.departmentSummaries[0] ||
      null
    );
  }, [data.departmentSummaries, selectedDeptName]);

  // Filtered individual summaries
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
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Daily Work Summary
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            End-of-day reports, productivity tracking, and task carry forward
          </p>
        </div>

        {/* Date Picker & Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center rounded-xl border border-slate-200 bg-white p-1 shadow-xs">
            <button
              onClick={() => shiftDate(-1)}
              className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 transition"
              title="Previous Day"
            >
              <ChevronLeft size={16} />
            </button>
            <input
              type="date"
              value={data.dateValue}
              onChange={(e) => handleDateChange(e.target.value)}
              className="text-xs font-semibold text-slate-800 bg-transparent border-none cursor-pointer focus:outline-hidden px-2"
            />
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
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition shadow-xs"
            >
              Today
            </button>
          )}
        </div>
      </div>

      {/* View Toggle Bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 border border-slate-200/80">
          <button
            onClick={() => setViewMode("DEPARTMENT")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition",
              viewMode === "DEPARTMENT"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Building2 size={14} className={viewMode === "DEPARTMENT" ? "text-blue-600" : "text-slate-400"} />
            <span>Departments ({data.departmentSummaries.length})</span>
          </button>

          <button
            onClick={() => setViewMode("INDIVIDUAL")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition",
              viewMode === "INDIVIDUAL"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <User size={14} className={viewMode === "INDIVIDUAL" ? "text-blue-600" : "text-slate-400"} />
            <span>Employees ({data.summaries.length})</span>
          </button>
        </div>

        {/* Quick context indicator or selector */}
        {viewMode === "DEPARTMENT" ? (
          <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-0.5">
            {data.departmentSummaries.map((dept) => {
              const isSelected = dept.departmentName === selectedDeptName;
              return (
                <button
                  key={dept.departmentName}
                  onClick={() => setSelectedDeptName(dept.departmentName)}
                  className={cn(
                    "px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition",
                    isSelected
                      ? "bg-slate-900 text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                  )}
                >
                  {dept.departmentName}
                </button>
              );
            })}
          </div>
        ) : (
          data.viewScope !== "SELF" && (
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter members..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1 text-xs rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:border-blue-500 w-44"
                />
              </div>

              {departments.length > 2 && (
                <select
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 focus:outline-hidden"
                >
                  {departments.map((d) => (
                    <option key={d} value={d}>
                      {d === "ALL" ? "All Depts" : d}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )
        )}
      </div>

      {/* DEPARTMENT VIEW */}
      {viewMode === "DEPARTMENT" && (
        <div>
          {currentDepartmentSummary ? (
            <DepartmentSummaryCard
              department={currentDepartmentSummary}
              onSelectEmployee={handleSelectEmployeeFromDept}
            />
          ) : (
            <Card className="p-8 text-center text-xs text-slate-500">
              No department summary available for {selectedDeptName} on this date.
            </Card>
          )}
        </div>
      )}

      {/* INDIVIDUAL VIEW */}
      {viewMode === "INDIVIDUAL" && (
        <div className="space-y-4">
          {/* Employee Selector Bar (if viewing team) */}
          {data.viewScope !== "SELF" && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {filteredSummaries.map((s) => {
                const isSelected = s.employeeId === selectedEmpId;
                return (
                  <button
                    key={s.employeeId}
                    onClick={() => setSelectedEmpId(s.employeeId)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition border",
                      isSelected
                        ? "bg-blue-50 text-blue-800 border-blue-300 shadow-xs"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                    )}
                  >
                    <Avatar name={s.employeeName} url={s.avatarUrl} size={20} />
                    <span>{s.employeeName}</span>
                    <span className="text-[10px] text-slate-400">({s.completedCount}/{s.totalTasks})</span>
                  </button>
                );
              })}
            </div>
          )}

          {currentSummary ? (
            <DailySummaryTemplateCard summary={currentSummary} />
          ) : (
            <Card className="p-8 text-center text-xs text-slate-500">
              No individual work summary found for this date.
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
