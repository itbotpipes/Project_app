"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, TrendingUp, Award, Users, Filter, Calendar, ArrowUpDown, CheckCircle2, ChevronRight, X } from "lucide-react";
import Avatar from "../_components/Avatar";
import { Badge } from "../_components/ui";

export type DirectoryEmployee = {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string | null;
  roleTitle: string;
  departmentName: string;
  managerName: string;
  monthScore: number | null;
  monthAutoScore: number | null;
  avg6Months: number;
  monthsCount6Mo: number;
  increment: {
    pct: number;
    label: string;
    tier: "TOP" | "HIGH" | "STANDARD" | "LOW" | "NONE";
    tone: string;
  };
};

type SortField = "name" | "score" | "avg6Mo" | "increment";
type SortOrder = "asc" | "desc";

export default function DirectoryView({
  employees,
  selectedMonthValue,
  selectedMonthLabel,
  availableMonths,
}: {
  employees: DirectoryEmployee[];
  selectedMonthValue: string;
  selectedMonthLabel: string;
  availableMonths: Array<{ value: string; label: string }>;
}) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTier, setFilterTier] = useState<"ALL" | "ELIGIBLE" | "TOP" | "REVIEW">("ALL");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  // Filter and sort employees in the single unified list
  const filteredEmployees = useMemo(() => {
    return employees
      .filter((e) => {
        // Name / Role / Dept Search
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matches =
            e.name.toLowerCase().includes(q) ||
            e.roleTitle.toLowerCase().includes(q) ||
            e.departmentName.toLowerCase().includes(q) ||
            e.managerName.toLowerCase().includes(q);
          if (!matches) return false;
        }

        // Eligibility / Tier Filter
        if (filterTier === "ELIGIBLE") return e.avg6Months >= 65;
        if (filterTier === "TOP") return e.avg6Months >= 85;
        if (filterTier === "REVIEW") return e.avg6Months < 65;

        return true;
      })
      .sort((a, b) => {
        let diff = 0;
        if (sortField === "name") {
          diff = a.name.localeCompare(b.name);
        } else if (sortField === "score") {
          diff = (a.monthScore ?? 0) - (b.monthScore ?? 0);
        } else if (sortField === "avg6Mo") {
          diff = a.avg6Months - b.avg6Months;
        } else if (sortField === "increment") {
          diff = a.increment.pct - b.increment.pct;
        }
        return sortOrder === "asc" ? diff : -diff;
      });
  }, [employees, searchQuery, filterTier, sortField, sortOrder]);

  // Overall Statistics
  const totalEmployees = employees.length;
  const eligibleCount = employees.filter((e) => e.avg6Months >= 65).length;
  const topCount = employees.filter((e) => e.avg6Months >= 85).length;
  const company6MoAvg =
    employees.length > 0
      ? Math.round(
          (employees.reduce((acc, e) => acc + e.avg6Months, 0) /
            employees.filter((e) => e.avg6Months > 0).length || 1) * 10
        ) / 10
      : 0;

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder(field === "name" ? "asc" : "desc");
    }
  }

  function handleMonthChange(newMonthValue: string) {
    router.push(`/people?month=${newMonthValue}`);
  }

  return (
    <div className="space-y-6">
      {/* Header and Month Filter */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Company Directory</h1>
          <p className="text-sm text-slate-500">
            All team members in one place with month performance &amp; 6-month expected increment projections.
          </p>
        </div>

        {/* Month Selector Filter */}
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
          <Calendar className="ml-2 h-4 w-4 text-slate-400 shrink-0" />
          <span className="text-xs font-medium text-slate-600">Month:</span>
          <select
            value={selectedMonthValue}
            onChange={(e) => handleMonthChange(e.target.value)}
            className="rounded-lg border-0 bg-transparent py-1 pl-1 pr-6 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-0 cursor-pointer"
          >
            {availableMonths.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <input
            type="month"
            value={selectedMonthValue}
            onChange={(e) => e.target.value && handleMonthChange(e.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer"
            title="Pick custom month"
          />
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-slate-400">
            <span>Total Team</span>
            <Users className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{totalEmployees}</div>
          <p className="mt-1 text-xs text-slate-500">Active company members</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-slate-400">
            <span>Eligible for Increment</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-600">
            {eligibleCount}
            <span className="text-xs font-normal text-slate-400 ml-1.5">
              ({totalEmployees > 0 ? Math.round((eligibleCount / totalEmployees) * 100) : 0}%)
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">6-Mo average score ≥ 65</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-slate-400">
            <span>Top Performers (≥85)</span>
            <Award className="h-4 w-4 text-violet-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-violet-700">{topCount}</div>
          <p className="mt-1 text-xs text-slate-500">20% bonus category</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-slate-400">
            <span>Company 6-Mo Avg</span>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-blue-600">{company6MoAvg}</div>
          <p className="mt-1 text-xs text-slate-500">Average consistency score</p>
        </div>
      </div>

      {/* Single Unified List Controls */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4 bg-slate-50/50">
          {/* Real-time Name Search */}
          <div className="relative min-w-[280px] max-w-sm flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, role, department..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-8 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm"
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

          {/* Quick Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setFilterTier("ALL")}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                filterTier === "ALL"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              All ({totalEmployees})
            </button>
            <button
              type="button"
              onClick={() => setFilterTier("ELIGIBLE")}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                filterTier === "ELIGIBLE"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              Eligible for Increment (≥65)
            </button>
            <button
              type="button"
              onClick={() => setFilterTier("TOP")}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                filterTier === "TOP"
                  ? "bg-violet-600 text-white shadow-sm"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              Top Performers (≥85)
            </button>
            <button
              type="button"
              onClick={() => setFilterTier("REVIEW")}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                filterTier === "REVIEW"
                  ? "bg-amber-600 text-white shadow-sm"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              Developing (&lt;65)
            </button>
          </div>
        </div>

        {/* Results Count Banner */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 bg-slate-50/30 text-[11px] text-slate-500">
          <span>
            Showing <strong className="text-slate-800">{filteredEmployees.length}</strong> of{" "}
            <strong>{totalEmployees}</strong> employees in single list
          </span>
          <span>Period: <strong>{selectedMonthLabel}</strong></span>
        </div>

        {/* Single Unified Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th
                  onClick={() => toggleSort("name")}
                  className="cursor-pointer py-3 pl-4 pr-3 hover:text-slate-800 select-none"
                >
                  <div className="flex items-center gap-1">
                    <span>Employee</span>
                    <ArrowUpDown size={12} className={sortField === "name" ? "text-blue-600" : "text-slate-400"} />
                  </div>
                </th>
                <th className="px-3 py-3">Role</th>
                <th className="px-3 py-3">Department</th>
                <th className="px-3 py-3">Reports To</th>
                <th
                  onClick={() => toggleSort("score")}
                  className="cursor-pointer px-3 py-3 text-center hover:text-slate-800 select-none"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>{selectedMonthLabel} Score</span>
                    <ArrowUpDown size={12} className={sortField === "score" ? "text-blue-600" : "text-slate-400"} />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort("avg6Mo")}
                  className="cursor-pointer px-3 py-3 text-center hover:text-slate-800 select-none"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>6-Mo Avg Score</span>
                    <ArrowUpDown size={12} className={sortField === "avg6Mo" ? "text-blue-600" : "text-slate-400"} />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort("increment")}
                  className="cursor-pointer px-3 py-3 text-right hover:text-slate-800 select-none"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Expected Increment (6-Mo)</span>
                    <ArrowUpDown size={12} className={sortField === "increment" ? "text-blue-600" : "text-slate-400"} />
                  </div>
                </th>
                <th className="py-3 pl-2 pr-4 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredEmployees.map((e) => {
                const isTop = e.avg6Months >= 85;
                const isEligible = e.avg6Months >= 65;

                return (
                  <tr key={e.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Employee Name & Avatar */}
                    <td className="py-3 pl-4 pr-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={e.name} url={e.avatarUrl} size={32} />
                        <div>
                          <Link
                            href={`/people/${e.id}`}
                            className="font-semibold text-slate-900 hover:text-blue-600 hover:underline block"
                          >
                            {e.name}
                          </Link>
                          {e.email && <span className="text-[11px] text-slate-400">{e.email}</span>}
                        </div>
                      </div>
                    </td>

                    {/* Role Title */}
                    <td className="px-3 py-3 font-medium text-slate-700">
                      {e.roleTitle}
                    </td>

                    {/* Department */}
                    <td className="px-3 py-3">
                      <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                        {e.departmentName}
                      </span>
                    </td>

                    {/* Reports To */}
                    <td className="px-3 py-3 text-slate-500">
                      {e.managerName || "—"}
                    </td>

                    {/* Selected Month Score */}
                    <td className="px-3 py-3 text-center">
                      {e.monthScore != null ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 font-bold text-slate-800">
                          {Math.round(e.monthScore)}
                          <span className="text-[10px] font-normal text-slate-400">pts</span>
                        </span>
                      ) : e.monthAutoScore != null ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700" title="Auto score (pending review)">
                          ~{Math.round(e.monthAutoScore)}
                          <span className="text-[10px] font-normal text-blue-400">auto</span>
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>

                    {/* 6-Month Average Score */}
                    <td className="px-3 py-3 text-center">
                      {e.avg6Months > 0 ? (
                        <div className="inline-flex flex-col items-center">
                          <span
                            className={`font-bold text-sm ${
                              isTop
                                ? "text-violet-700"
                                : isEligible
                                ? "text-emerald-700"
                                : e.avg6Months >= 45
                                ? "text-blue-700"
                                : "text-amber-700"
                            }`}
                          >
                            {e.avg6Months}
                          </span>
                          <span className="text-[9px] text-slate-400">
                            {e.monthsCount6Mo} mo{e.monthsCount6Mo === 1 ? "" : "s"}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>

                    {/* Expected Increment on 6-Month Basis */}
                    <td className="px-3 py-3 text-right">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold border ${e.increment.tone}`}>
                        {e.increment.pct >= 15 && <Award size={12} className="shrink-0" />}
                        {e.increment.label}
                      </span>
                    </td>

                    {/* Profile & Trend link */}
                    <td className="py-3 pl-2 pr-4 text-right">
                      <Link
                        href={`/people/${e.id}`}
                        className="inline-flex items-center gap-0.5 text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        <span>Trend</span>
                        <ChevronRight size={13} />
                      </Link>
                    </td>
                  </tr>
                );
              })}

              {filteredEmployees.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-sm text-slate-400">
                    No employees found matching &quot;{searchQuery}&quot;.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
