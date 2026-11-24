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
  ChevronDown,
  ChevronUp,
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
  const prodBadgeClass =
    pct === null
      ? "bg-slate-100 text-slate-700 border-slate-200"
      : pct >= 80
      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
      : pct >= 50
      ? "bg-blue-50 text-blue-800 border-blue-200"
      : "bg-amber-50 text-amber-800 border-amber-200";

  return (
    <Card className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              {department.departmentName} Department Summary
            </h2>
            <Badge className={prodBadgeClass}>
              {department.productivityLabel} Productivity
            </Badge>
          </div>
          <p className="text-xs text-slate-500">
            {department.dateLabel} · {department.totalEmployees} Team Member{department.totalEmployees === 1 ? "" : "s"}
          </p>
        </div>

        {/* Action Buttons: Copy / Share / Print */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleCopyShareText}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition shadow-xs",
              copied
                ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
            )}
            title="Copy formatted text for WhatsApp, Slack, or Email"
          >
            {copied ? (
              <>
                <Check size={14} className="text-emerald-600" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy size={14} className="text-slate-500" />
                <span>Copy Summary</span>
              </>
            )}
          </button>

          <button
            onClick={handleNativeShare}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-xs transition"
            title="Share summary"
          >
            <Share2 size={13} />
            <span>Share</span>
          </button>

          <button
            onClick={() => window.print()}
            className="p-1.5 rounded-xl text-slate-600 hover:text-slate-900 border border-slate-200 bg-white hover:bg-slate-50 transition"
            title="Print or Save as PDF"
          >
            <Printer size={15} />
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
          <div className="text-xs font-medium text-slate-500">Total Planned</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{department.totalTasks}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Tasks scheduled</div>
        </div>

        <div className="p-3.5 rounded-xl bg-emerald-50/40 border border-emerald-200/80">
          <div className="text-xs font-medium text-emerald-800 flex items-center gap-1">
            <CheckCircle2 size={13} className="text-emerald-600" /> Completed
          </div>
          <div className="text-2xl font-bold text-emerald-700 mt-1">{department.completedCount}</div>
          <div className="text-[11px] text-emerald-600/80 mt-0.5">Closed today</div>
        </div>

        <div className="p-3.5 rounded-xl bg-sky-50/40 border border-sky-200/80">
          <div className="text-xs font-medium text-sky-800 flex items-center gap-1">
            <Clock size={13} className="text-sky-600" /> Pending
          </div>
          <div className="text-2xl font-bold text-sky-700 mt-1">{department.pendingCount}</div>
          <div className="text-[11px] text-sky-600/80 mt-0.5">In progress</div>
        </div>

        <div className="p-3.5 rounded-xl bg-amber-50/40 border border-amber-200/80">
          <div className="text-xs font-medium text-amber-800 flex items-center gap-1">
            <PauseCircle size={13} className="text-amber-600" /> On Hold / Review
          </div>
          <div className="text-2xl font-bold text-amber-700 mt-1">
            {department.onHoldCount + department.inReviewCount}
          </div>
          <div className="text-[11px] text-amber-600/80 mt-0.5">
            {department.onHoldCount} Hold · {department.inReviewCount} Review
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-indigo-50/40 border border-indigo-200/80 col-span-2 sm:col-span-1">
          <div className="text-xs font-medium text-indigo-800 flex items-center gap-1">
            <ArrowRight size={13} className="text-indigo-600" /> Carry Forward
          </div>
          <div className="text-2xl font-bold text-indigo-700 mt-1">{department.carryForwardCount}</div>
          <div className="text-[11px] text-indigo-600/80 mt-0.5">To next working day</div>
        </div>
      </div>

      {/* Sub-Tabs: Tasks vs Team Members */}
      <div className="space-y-4 pt-1">
        <div className="flex items-center gap-1 border-b border-slate-200 pb-2">
          <button
            onClick={() => setActiveTab("STATUS")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold transition",
              activeTab === "STATUS"
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            )}
          >
            Tasks ({department.totalTasks})
          </button>
          <button
            onClick={() => setActiveTab("MEMBERS")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold transition",
              activeTab === "MEMBERS"
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            )}
          >
            Team Members ({department.members.length})
          </button>
        </div>

        {/* VIEW 1: CONSOLIDATED TASKS BY STATUS */}
        {activeTab === "STATUS" && (
          <div className="space-y-5">
            {/* Completed */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <CheckCircle2 size={14} className="text-emerald-600" />
                <span>Completed Today ({department.completedCount})</span>
              </div>

              {department.completedTasks.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-2">No tasks completed today in this department.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {department.completedTasks.map((t) => (
                    <div
                      key={t.id}
                      className="p-3 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition space-y-1.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <TaskLink
                          taskId={t.id}
                          className="text-xs font-semibold text-slate-900 hover:text-blue-600"
                        >
                          {t.title}
                        </TaskLink>
                        <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200">
                          Closed
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                        <span className="font-medium text-slate-700">
                          👤 {t.assigneeName} {t.assigneeRole ? `· ${t.assigneeRole}` : ""}
                        </span>
                        {t.priority && <span className="text-slate-400">{t.priority}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pending */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <Clock size={14} className="text-sky-600" />
                <span>Pending Tasks ({department.pendingCount})</span>
              </div>

              {department.pendingTasks.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-2">No pending tasks remaining.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {department.pendingTasks.map((t) => (
                    <div
                      key={t.id}
                      className="p-3 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition space-y-1.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <TaskLink
                          taskId={t.id}
                          className="text-xs font-semibold text-slate-900 hover:text-blue-600"
                        >
                          {t.title}
                        </TaskLink>
                        <Badge className="bg-sky-50 text-sky-800 border-sky-200 capitalize">
                          {t.status.replace("_", " ").toLowerCase()}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                        <span className="font-medium text-slate-700">
                          👤 {t.assigneeName} {t.assigneeRole ? `· ${t.assigneeRole}` : ""}
                        </span>
                        {t.carryCount && t.carryCount > 0 ? (
                          <span className="text-indigo-600 font-medium">Carried {t.carryCount}d</span>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* On Hold */}
            {department.onHoldTasks.length > 0 && (
              <div className="space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <PauseCircle size={14} className="text-amber-600" />
                  <span>On Hold ({department.onHoldCount})</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {department.onHoldTasks.map((t) => (
                    <div
                      key={t.id}
                      className="p-3 rounded-xl border border-amber-200 bg-amber-50/20 space-y-1.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <TaskLink taskId={t.id} className="text-xs font-semibold text-slate-900">
                          {t.title}
                        </TaskLink>
                        <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                          On Hold
                        </Badge>
                      </div>
                      {t.holdReason && (
                        <p className="text-[11px] text-amber-800">
                          <span className="font-medium">Reason:</span> {t.holdReason}
                        </p>
                      )}
                      <div className="text-[11px] text-slate-500 pt-1 border-t border-amber-100">
                        👤 {t.assigneeName} {t.assigneeRole ? `· ${t.assigneeRole}` : ""}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* In Review */}
            {department.inReviewTasks.length > 0 && (
              <div className="space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <FileCheck size={14} className="text-violet-600" />
                  <span>In Review ({department.inReviewCount})</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {department.inReviewTasks.map((t) => (
                    <div
                      key={t.id}
                      className="p-3 rounded-xl border border-violet-200 bg-violet-50/20 space-y-1.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <TaskLink taskId={t.id} className="text-xs font-semibold text-slate-900">
                          {t.title}
                        </TaskLink>
                        <Badge className="bg-violet-100 text-violet-800 border-violet-200">
                          Under Review
                        </Badge>
                      </div>
                      <div className="text-[11px] text-slate-500 pt-1 border-t border-violet-100">
                        👤 {t.assigneeName} {t.assigneeRole ? `· ${t.assigneeRole}` : ""}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tomorrow's Carry Forward */}
            {department.tomorrowCarryForwardTasks.length > 0 && (
              <div className="space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <ArrowRight size={14} className="text-indigo-600" />
                  <span>Tomorrow&apos;s Carry Forward ({department.carryForwardCount})</span>
                </div>

                <div className="rounded-xl border border-indigo-100 bg-indigo-50/20 p-3 space-y-2">
                  <ul className="space-y-1.5">
                    {department.tomorrowCarryForwardTasks.map((t) => (
                      <li
                        key={t.id}
                        className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-white border border-indigo-100 shadow-2xs gap-2"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                          <TaskLink
                            taskId={t.id}
                            className="font-medium text-slate-900 hover:text-indigo-700 truncate"
                          >
                            {t.title}
                          </TaskLink>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 shrink-0">
                          <span className="text-slate-700 font-medium">👤 {t.assigneeName}</span>
                          <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-100 text-slate-700 font-semibold">
                            {t.status}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: BY TEAM MEMBER */}
        {activeTab === "MEMBERS" && (
          <div className="space-y-3">
            {department.members.map((member) => {
              const isExpanded = expandedMembers.has(member.employeeId);
              const mPct = member.productivityPercentage;
              const mBadgeClass =
                mPct === null
                  ? "bg-slate-100 text-slate-700 border-slate-200"
                  : mPct >= 80
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : mPct >= 50
                  ? "bg-blue-50 text-blue-800 border-blue-200"
                  : "bg-amber-50 text-amber-800 border-amber-200";

              return (
                <div
                  key={member.employeeId}
                  className="rounded-xl border border-slate-200 bg-white overflow-hidden transition"
                >
                  <div
                    onClick={() => toggleMember(member.employeeId)}
                    className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 select-none"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar name={member.employeeName} url={member.avatarUrl} size={32} />
                      <div>
                        <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                          <span>{member.employeeName}</span>
                          <span className="text-[11px] font-normal text-slate-500">
                            ({member.roleTitle})
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                          <span>Total: <strong>{member.totalTasks}</strong></span>
                          <span>·</span>
                          <span className="text-emerald-600 font-medium">Done: {member.completedCount}</span>
                          <span>·</span>
                          <span className="text-sky-600">Pending: {member.pendingCount}</span>
                          {member.carryForwardCount > 0 && (
                            <>
                              <span>·</span>
                              <span className="text-indigo-600">Carry: {member.carryForwardCount}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <Badge className={mBadgeClass}>{member.productivityLabel}</Badge>

                      {onSelectEmployee && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectEmployee(member.employeeId);
                          }}
                          className="px-2.5 py-1 rounded-lg text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 border border-blue-200 transition"
                        >
                          View Individual
                        </button>
                      )}

                      <div className="p-1 text-slate-400">
                        {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="p-3 pt-1 border-t border-slate-100 bg-slate-50/50 space-y-2">
                      {member.totalTasks === 0 ? (
                        <p className="text-xs text-slate-400 italic">No tasks on this date.</p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <span className="text-[11px] font-semibold text-emerald-800">
                              Completed ({member.completedCount})
                            </span>
                            {member.completedTasks.length === 0 ? (
                              <p className="text-xs text-slate-400 italic">None</p>
                            ) : (
                              <ul className="space-y-1">
                                {member.completedTasks.map((t) => (
                                  <li
                                    key={t.id}
                                    className="text-xs text-slate-700 bg-white p-2 rounded-lg border border-slate-200"
                                  >
                                    <TaskLink taskId={t.id} className="hover:underline">
                                      {t.title}
                                    </TaskLink>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>

                          <div className="space-y-1">
                            <span className="text-[11px] font-semibold text-indigo-800">
                              Carry Forward ({member.carryForwardCount})
                            </span>
                            {member.tomorrowCarryForwardTasks.length === 0 ? (
                              <p className="text-xs text-slate-400 italic">None</p>
                            ) : (
                              <ul className="space-y-1">
                                {member.tomorrowCarryForwardTasks.map((t) => (
                                  <li
                                    key={t.id}
                                    className="text-xs text-slate-700 bg-white p-2 rounded-lg border border-slate-200 flex items-center justify-between"
                                  >
                                    <TaskLink taskId={t.id} className="hover:underline">
                                      {t.title}
                                    </TaskLink>
                                    <span className="text-[10px] text-slate-400">{t.status}</span>
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
