
"use client";

import { useState } from "react";
import {
  Building2,
  Users,
  CheckCircle2,
  Clock,
  PauseCircle,
  FileCheck,
  ArrowRight,
  Copy,
  Check,
  Share2,
  Printer,
  TrendingUp,
  Sparkles,
  Layers,
  ChevronDown,
  ChevronUp,
  ArrowUpRight,
  Info,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Card, Badge } from "../_components/ui";
import Avatar from "../_components/Avatar";
import TaskLink from "../_components/TaskLink";
import {
  type DepartmentDailyWorkSummary,
  generateDepartmentSummaryShareText,
} from "@/lib/dailyWorkSummaryTypes";

export default function DepartmentSummaryCard({
  department,
  onSelectEmployee,
}: {
  department: DepartmentDailyWorkSummary;
  onSelectEmployee?: (empId: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"STATUS" | "MEMBERS">("STATUS");
  const [expandedMembers, setExpandedMembers] = useState<Set<string>>(() => {
    return new Set(department.members.map((m) => m.employeeId));
  });

  function handleCopyShareText() {
    const text = generateDepartmentSummaryShareText(department);
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  function handleNativeShare() {
    const text = generateDepartmentSummaryShareText(department);
    if (typeof navigator !== "undefined" && navigator.share) {
      navigator
        .share({
          title: `Daily Work Summary – ${department.departmentName} (${department.dateLabel})`,
          text: text,
        })
        .catch(() => {
          handleCopyShareText();
        });
    } else {
      handleCopyShareText();
    }
  }

  function toggleMember(empId: string) {
    setExpandedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(empId)) next.delete(empId);
      else next.add(empId);
      return next;
    });
  }

  const pct = department.productivityPercentage;
  const prodColor =
    pct === null
      ? "text-slate-600 bg-slate-100 border-slate-300"
      : pct >= 80
      ? "text-emerald-700 bg-emerald-50 border-emerald-300"
      : pct >= 50
      ? "text-blue-700 bg-blue-50 border-blue-300"
      : "text-amber-700 bg-amber-50 border-amber-300";

  const progressBg =
    pct === null
      ? "bg-slate-300"
      : pct >= 80
      ? "bg-emerald-500"
      : pct >= 50
      ? "bg-blue-600"
      : "bg-amber-500";

  return (
    <Card className="p-6 md:p-8 space-y-7 border border-slate-200/90 shadow-sm bg-white rounded-2xl">
      {/* Top Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-slate-100">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
              <Building2 size={13} className="text-indigo-600" /> Department Work Report
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
              <Users size={12} className="text-slate-500" />
              {department.totalEmployees} Team Member{department.totalEmployees === 1 ? "" : "s"}
            </span>
          </div>

          <h2 className="text-xl md:text-2xl font-bold text-slate-900">
            {department.departmentName} Department – {department.dateLabel}
          </h2>
          <p className="text-xs md:text-sm text-slate-500">
            Consolidated daily work summary, team productivity, and carry forward report for all department employees
          </p>
        </div>

        {/* Action Buttons: Copy / Share / Print */}
        <div className="flex flex-wrap items-center gap-2">
          {/* WhatsApp / Slack Copy Button */}
          <button
            onClick={handleCopyShareText}
            className={cn(
              "flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all shadow-xs",
              copied
                ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300 active:scale-95"
            )}
            title="Copy formatted summary with bullet points for WhatsApp, Slack or Email"
          >
            {copied ? (
              <>
                <Check size={14} className="text-emerald-600" />
                <span>Copied Report!</span>
              </>
            ) : (
              <>
                <Copy size={14} className="text-slate-500" />
                <span>Copy for WhatsApp / Slack</span>
              </>
            )}
          </button>

          {/* Share Button */}
          <button
            onClick={handleNativeShare}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-xs active:scale-95 transition"
            title="Share department summary with all members"
          >
            <Share2 size={14} />
            <span>Share to All</span>
          </button>

          {/* Print Button */}
          <button
            onClick={() => window.print()}
            className="p-2 rounded-xl text-slate-600 hover:text-slate-900 border border-slate-200 bg-white hover:bg-slate-50 transition"
            title="Print or Save as PDF"
          >
            <Printer size={15} />
          </button>
        </div>
      </div>

      {/* Overview Grid: Productivity & Task Counts */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Department Productivity Card */}
        <div className="col-span-2 sm:col-span-3 lg:col-span-2 p-4 rounded-xl border border-blue-200/70 bg-gradient-to-br from-blue-50/50 via-white to-slate-50 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-semibold text-blue-900">
            <span className="flex items-center gap-1.5">
              <TrendingUp size={14} className="text-blue-600" /> Department Productivity
            </span>
            <span className={cn("px-2 py-0.5 rounded-full text-xs font-bold border", prodColor)}>
              {department.productivityLabel}
            </span>
          </div>

          <div className="mt-2.5">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl md:text-3xl font-extrabold text-slate-900">
                {department.productivityLabel}
              </span>
              <span className="text-xs text-slate-500 font-medium">
                {department.completedCount} of {department.totalTasks} completed
              </span>
            </div>

            {/* Visual Progress Bar */}
            <div className="w-full bg-slate-200 rounded-full h-2.5 mt-2 overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-500", progressBg)}
                style={{ width: `${Math.min(100, pct || 0)}%` }}
              />
            </div>
            <div className="flex items-center gap-1 mt-1.5 text-[11px] text-slate-400">
              <Info size={11} />
              <span>Task Completion Productivity: (Completed ÷ Planned) × 100</span>
            </div>
          </div>
        </div>

        {/* Completed */}
        <div className="p-4 rounded-xl border border-emerald-200/70 bg-emerald-50/20 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-medium text-emerald-800">
            <span>Completed</span>
            <CheckCircle2 size={15} className="text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-800 mt-2">
            {department.completedCount}
          </div>
          <div className="text-[11px] text-emerald-700/80 mt-0.5">Finished today</div>
        </div>

        {/* Pending */}
        <div className="p-4 rounded-xl border border-sky-200/70 bg-sky-50/20 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-medium text-sky-800">
            <span>Pending</span>
            <Clock size={15} className="text-sky-600" />
          </div>
          <div className="text-2xl font-bold text-sky-800 mt-2">
            {department.pendingCount}
          </div>
          <div className="text-[11px] text-sky-700/80 mt-0.5">In progress</div>
        </div>

        {/* On Hold & In Review */}
        <div className="p-4 rounded-xl border border-amber-200/70 bg-amber-50/20 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-medium text-amber-800">
            <span>On Hold / Review</span>
            <PauseCircle size={15} className="text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-800 mt-2">
            {department.onHoldCount + department.inReviewCount}
          </div>
          <div className="text-[11px] text-amber-700/80 mt-0.5">
            {department.onHoldCount} Hold · {department.inReviewCount} Review
          </div>
        </div>

        {/* Carry Forward */}
        <div className="p-4 rounded-xl border border-indigo-200/70 bg-indigo-50/20 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-medium text-indigo-800">
            <span>Carry Forward</span>
            <ArrowRight size={15} className="text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-indigo-800 mt-2">
            {department.carryForwardCount}
          </div>
          <div className="text-[11px] text-indigo-700/80 mt-0.5">To next work day</div>
        </div>
      </div>

      {/* Sub-Tabs: By Task Status vs By Team Member */}
      <div className="space-y-5 pt-2">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("STATUS")}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs font-semibold transition",
                activeTab === "STATUS"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              )}
            >
              Consolidated Tasks ({department.totalTasks})
            </button>
            <button
              onClick={() => setActiveTab("MEMBERS")}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs font-semibold transition",
                activeTab === "MEMBERS"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              )}
            >
              Team Members ({department.members.length})
            </button>
          </div>

          <span className="text-xs text-slate-400 hidden sm:inline">
            Official End-of-Day Report
          </span>
        </div>

        {/* VIEW 1: CONSOLIDATED TASKS BY STATUS */}
        {activeTab === "STATUS" && (
          <div className="space-y-6">
            {/* Section 1: Completed Today */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Completed Today ({department.completedCount})
                </h3>
              </div>

              {department.completedTasks.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-500 italic">
                  No tasks completed today in {department.departmentName} department.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {department.completedTasks.map((t) => (
                    <div
                      key={t.id}
                      className="p-3 rounded-xl border border-emerald-100 bg-emerald-50/20 hover:border-emerald-200 transition space-y-1.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <TaskLink
                          taskId={t.id}
                          className="text-xs font-semibold text-slate-900 hover:text-emerald-700"
                        >
                          {t.title}
                        </TaskLink>
                        <span className="shrink-0 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                          Completed
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-emerald-100/60">
                        <span className="font-medium text-slate-700 flex items-center gap-1">
                          👤 {t.assigneeName} ({t.assigneeRole})
                        </span>
                        {t.priority && (
                          <span className="text-[10px] font-medium text-slate-400">
                            {t.priority}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section 2: Pending Tasks */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-sky-600" />
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Pending Tasks ({department.pendingCount})
                </h3>
              </div>

              {department.pendingTasks.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-500 italic">
                  No pending tasks remaining.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {department.pendingTasks.map((t) => (
                    <div
                      key={t.id}
                      className="p-3 rounded-xl border border-sky-100 bg-sky-50/20 hover:border-sky-200 transition space-y-1.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <TaskLink
                          taskId={t.id}
                          className="text-xs font-semibold text-slate-900 hover:text-sky-700"
                        >
                          {t.title}
                        </TaskLink>
                        <span className="shrink-0 px-2 py-0.5 rounded text-[10px] font-semibold bg-sky-100 text-sky-800">
                          {t.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-sky-100/60">
                        <span className="font-medium text-slate-700">
                          👤 {t.assigneeName} ({t.assigneeRole})
                        </span>
                        {t.carryCount && t.carryCount > 0 ? (
                          <span className="text-[10px] text-indigo-600 font-semibold">
                            Carried {t.carryCount}d
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section 3: On Hold */}
            {department.onHoldTasks.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <PauseCircle size={16} className="text-amber-600" />
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                    On Hold ({department.onHoldCount})
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {department.onHoldTasks.map((t) => (
                    <div
                      key={t.id}
                      className="p-3 rounded-xl border border-amber-200/80 bg-amber-50/20 space-y-1.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <TaskLink
                          taskId={t.id}
                          className="text-xs font-semibold text-slate-900"
                        >
                          {t.title}
                        </TaskLink>
                        <span className="shrink-0 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800">
                          On Hold
                        </span>
                      </div>
                      {t.holdReason && (
                        <p className="text-[11px] text-amber-700 italic">
                          Reason: {t.holdReason}
                        </p>
                      )}
                      <div className="text-[11px] text-slate-500 pt-1 border-t border-amber-100">
                        👤 {t.assigneeName} ({t.assigneeRole})
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Section 4: In Review */}
            {department.inReviewTasks.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <FileCheck size={16} className="text-purple-600" />
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                    In Review ({department.inReviewCount})
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {department.inReviewTasks.map((t) => (
                    <div
                      key={t.id}
                      className="p-3 rounded-xl border border-purple-200/80 bg-purple-50/20 space-y-1.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <TaskLink
                          taskId={t.id}
                          className="text-xs font-semibold text-slate-900"
                        >
                          {t.title}
                        </TaskLink>
                        <span className="shrink-0 px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-800">
                          In Review
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 pt-1 border-t border-purple-100">
                        👤 {t.assigneeName} ({t.assigneeRole})
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Section 5: Tomorrow's Carry Forward */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2">
                <ArrowRight size={16} className="text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Tomorrow's Carry Forward ({department.carryForwardCount})
                </h3>
              </div>

              {department.tomorrowCarryForwardTasks.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-500 italic">
                  All planned department tasks were completed today! Nothing carried forward.
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/20 space-y-2">
                  <p className="text-xs text-indigo-900 font-medium mb-3">
                    The following {department.tomorrowCarryForwardTasks.length} task(s) will automatically carry forward to the next working day:
                  </p>
                  <ul className="space-y-2">
                    {department.tomorrowCarryForwardTasks.map((t) => (
                      <li
                        key={t.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-white border border-indigo-100/80 shadow-2xs gap-1"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                          <TaskLink
                            taskId={t.id}
                            className="font-medium text-slate-900 hover:text-indigo-700"
                          >
                            {t.title}
                          </TaskLink>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 shrink-0 pl-3.5 sm:pl-0">
                          <span className="text-slate-700 font-medium">👤 {t.assigneeName}</span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 font-semibold">
                            {t.status}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* VIEW 2: BY TEAM MEMBER (ROSTER BREAKDOWN) */}
        {activeTab === "MEMBERS" && (
          <div className="space-y-4">
            {department.members.map((member, idx) => {
              const isExpanded = expandedMembers.has(member.employeeId);
              const mPct = member.productivityPercentage;
              const mProdColor =
                mPct === null
                  ? "text-slate-700 bg-slate-100 border-slate-300"
                  : mPct >= 80
                  ? "text-emerald-700 bg-emerald-50 border-emerald-300"
                  : mPct >= 50
                  ? "text-blue-700 bg-blue-50 border-blue-300"
                  : "text-amber-700 bg-amber-50 border-amber-300";

              return (
                <div
                  key={member.employeeId}
                  className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-2xs transition"
                >
                  {/* Member Summary Header */}
                  <div
                    onClick={() => toggleMember(member.employeeId)}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/80 select-none"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-slate-400 w-4">{idx + 1}.</span>
                      <Avatar name={member.employeeName} url={member.avatarUrl} size={36} />
                      <div>
                        <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                          <span>{member.employeeName}</span>
                          <span className="text-xs font-normal text-slate-500">
                            ({member.roleTitle})
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-2">
                          <span>Total: <strong>{member.totalTasks}</strong></span>
                          <span>·</span>
                          <span className="text-emerald-600 font-semibold">
                            Completed: {member.completedCount}
                          </span>
                          <span>·</span>
                          <span className="text-sky-600">
                            Pending: {member.pendingCount}
                          </span>
                          {member.carryForwardCount > 0 && (
                            <>
                              <span>·</span>
                              <span className="text-indigo-600">
                                Carry: {member.carryForwardCount}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-auto">
                      <span
                        className={cn(
                          "px-2.5 py-1 rounded-full text-xs font-bold border",
                          mProdColor
                        )}
                      >
                        {member.productivityLabel}
                      </span>

                      {onSelectEmployee && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectEmployee(member.employeeId);
                          }}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold text-blue-600 hover:text-blue-800 hover:bg-blue-50 border border-blue-200 transition"
                          title="Open individual summary card"
                        >
                          View Report
                        </button>
                      )}

                      <div className="p-1 text-slate-400 hover:text-slate-600">
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Task Details for Member */}
                  {isExpanded && (
                    <div className="p-4 pt-2 border-t border-slate-100 bg-slate-50/40 space-y-3">
                      {member.totalTasks === 0 ? (
                        <p className="text-xs text-slate-400 italic">
                          No tasks recorded for {member.employeeName} on this date.
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {/* Member Completed */}
                          <div className="space-y-1.5">
                            <span className="text-[11px] font-bold uppercase text-emerald-800 tracking-wider flex items-center gap-1">
                              <CheckCircle2 size={13} className="text-emerald-600" /> Completed ({member.completedCount})
                            </span>
                            {member.completedTasks.length === 0 ? (
                              <p className="text-xs text-slate-400 italic">None</p>
                            ) : (
                              <ul className="space-y-1">
                                {member.completedTasks.map((t) => (
                                  <li
                                    key={t.id}
                                    className="text-xs text-slate-700 bg-white p-2 rounded-lg border border-emerald-100 shadow-2xs"
                                  >
                                    <TaskLink taskId={t.id} className="hover:underline">
                                      {t.title}
                                    </TaskLink>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>

                          {/* Member Pending & Carry */}
                          <div className="space-y-1.5">
                            <span className="text-[11px] font-bold uppercase text-indigo-800 tracking-wider flex items-center gap-1">
                              <ArrowRight size={13} className="text-indigo-600" /> Carry Forward ({member.carryForwardCount})
                            </span>
                            {member.tomorrowCarryForwardTasks.length === 0 ? (
                              <p className="text-xs text-slate-400 italic">None</p>
                            ) : (
                              <ul className="space-y-1">
                                {member.tomorrowCarryForwardTasks.map((t) => (
                                  <li
                                    key={t.id}
                                    className="text-xs text-slate-700 bg-white p-2 rounded-lg border border-indigo-100 shadow-2xs flex items-center justify-between"
                                  >
                                    <TaskLink taskId={t.id} className="hover:underline">
                                      {t.title}
                                    </TaskLink>
                                    <span className="text-[10px] text-slate-400 shrink-0 ml-2">
                                      {t.status}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}
