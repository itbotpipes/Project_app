"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Clock,
  PauseCircle,
  FileCheck,
  ArrowRight,
  Copy,
  Check,
  Star,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Card, Badge } from "../_components/ui";
import Avatar from "../_components/Avatar";
import TaskLink from "../_components/TaskLink";
import type { EmployeeDailyWorkSummary } from "@/lib/dailyWorkSummaryTypes";

export default function DailySummaryTemplateCard({
  summary,
}: {
  summary: EmployeeDailyWorkSummary;
}) {
  const [copied, setCopied] = useState(false);

  function handleCopyText() {
    const lines: string[] = [];
    lines.push(`### Daily Work Summary – ${summary.dateLabel}`);
    lines.push("");
    lines.push(`**Employee:** ${summary.employeeName}`);
    lines.push(`**Role:** ${summary.roleTitle} (${summary.departmentName})`);
    lines.push("");
    lines.push(`**Task Overview**`);
    lines.push(`- Total Tasks: ${summary.totalTasks}`);
    lines.push(`- Completed: ${summary.completedCount}`);
    lines.push(`- Pending: ${summary.pendingCount}`);
    lines.push(`- On Hold: ${summary.onHoldCount}`);
    lines.push(`- In Review: ${summary.inReviewCount}`);
    lines.push(`- Carry Forward: ${summary.carryForwardCount}`);
    lines.push("");

    lines.push(`**Completed Today**`);
    if (summary.completedTasks.length === 0) {
      lines.push(`- (No tasks completed today)`);
    } else {
      summary.completedTasks.forEach((t) => {
        lines.push(`- ${t.title}`);
      });
    }
    lines.push("");

    lines.push(`**Pending Tasks**`);
    if (summary.pendingTasks.length === 0) {
      lines.push(`- (No pending tasks)`);
    } else {
      summary.pendingTasks.forEach((t) => {
        lines.push(`- ${t.title}`);
      });
    }
    lines.push("");

    if (summary.onHoldTasks.length > 0) {
      lines.push(`**On Hold**`);
      summary.onHoldTasks.forEach((t) => {
        const reason = t.holdReason ? ` (Reason: ${t.holdReason})` : "";
        lines.push(`- ${t.title}${reason}`);
      });
      lines.push("");
    }

    if (summary.inReviewTasks.length > 0) {
      lines.push(`**In Review**`);
      summary.inReviewTasks.forEach((t) => {
        lines.push(`- ${t.title}`);
      });
      lines.push("");
    }

    lines.push(`**Tomorrow's Carry Forward**`);
    if (summary.tomorrowCarryForwardTasks.length === 0) {
      lines.push(`- (No tasks to carry forward)`);
    } else {
      summary.tomorrowCarryForwardTasks.forEach((t) => {
        lines.push(`- ${t.title}`);
      });
    }
    lines.push("");

    lines.push(`**Daily Productivity: ${summary.productivityLabel}**`);

    const textToCopy = lines.join("\n");
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  const pct = summary.productivityPercentage;
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
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <Avatar name={summary.employeeName} url={summary.avatarUrl} size={40} />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                {summary.employeeName}
              </h2>
              <Badge className={prodBadgeClass}>
                {summary.productivityLabel} Productivity
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {summary.roleTitle} · {summary.departmentName} · {summary.dateLabel}
            </p>
          </div>
        </div>

        {/* Copy button */}
        <button
          onClick={handleCopyText}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition shadow-xs self-start sm:self-auto",
            copied
              ? "bg-emerald-50 text-emerald-800 border-emerald-300"
              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
          )}
        >
          {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} className="text-slate-500" />}
          <span>{copied ? "Copied!" : "Copy Summary"}</span>
        </button>
      </div>

      {/* Quality Reward Points Callout (if points earned) */}
      {(summary.totalApprovedPointsEarned ?? 0) > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-purple-200 bg-purple-50/50 p-3 text-xs">
          <div className="flex items-center gap-2 text-purple-900">
            <Star size={15} className="text-purple-600" />
            <span className="font-semibold">Quality Reward Points Earned:</span>
            <span>Base: {summary.basePointsEarned ?? 0} pts · Bonus: +{summary.qualityBonusPointsEarned ?? 0} pts</span>
          </div>
          <div className="font-bold text-purple-900 text-sm">
            {summary.totalApprovedPointsEarned} pts
          </div>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
          <div className="text-xs font-medium text-slate-500">Total Tasks</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{summary.totalTasks}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Planned today</div>
        </div>

        <div className="p-3.5 rounded-xl bg-emerald-50/40 border border-emerald-200/80">
          <div className="text-xs font-medium text-emerald-800 flex items-center gap-1">
            <CheckCircle2 size={13} className="text-emerald-600" /> Completed
          </div>
          <div className="text-2xl font-bold text-emerald-700 mt-1">{summary.completedCount}</div>
          <div className="text-[11px] text-emerald-600/80 mt-0.5">Closed today</div>
        </div>

        <div className="p-3.5 rounded-xl bg-sky-50/40 border border-sky-200/80">
          <div className="text-xs font-medium text-sky-800 flex items-center gap-1">
            <Clock size={13} className="text-sky-600" /> Pending
          </div>
          <div className="text-2xl font-bold text-sky-700 mt-1">{summary.pendingCount}</div>
          <div className="text-[11px] text-sky-600/80 mt-0.5">In progress</div>
        </div>

        <div className="p-3.5 rounded-xl bg-amber-50/40 border border-amber-200/80">
          <div className="text-xs font-medium text-amber-800 flex items-center gap-1">
            <PauseCircle size={13} className="text-amber-600" /> On Hold / Review
          </div>
          <div className="text-2xl font-bold text-amber-700 mt-1">
            {summary.onHoldCount + summary.inReviewCount}
          </div>
          <div className="text-[11px] text-amber-600/80 mt-0.5">
            {summary.onHoldCount} Hold · {summary.inReviewCount} Review
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-indigo-50/40 border border-indigo-200/80 col-span-2 sm:col-span-1">
          <div className="text-xs font-medium text-indigo-800 flex items-center gap-1">
            <ArrowRight size={13} className="text-indigo-600" /> Carry Forward
          </div>
          <div className="text-2xl font-bold text-indigo-700 mt-1">{summary.carryForwardCount}</div>
          <div className="text-[11px] text-indigo-600/80 mt-0.5">To next working day</div>
        </div>
      </div>

      {/* Task Sections */}
      <div className="space-y-5 pt-1">
        {/* Completed Today */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <CheckCircle2 size={14} className="text-emerald-600" />
            <span>Completed Today ({summary.completedTasks.length})</span>
          </div>
          {summary.completedTasks.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-1">No tasks were marked closed today.</p>
          ) : (
            <ul className="space-y-1.5">
              {summary.completedTasks.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between text-xs py-2 px-3 rounded-lg bg-white border border-slate-200 hover:border-slate-300 transition gap-2"
                >
                  <TaskLink taskId={t.id} className="font-medium text-slate-900 hover:text-blue-600 hover:underline truncate">
                    {t.title}
                  </TaskLink>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {t.totalApprovedPoints != null && (
                      <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-semibold flex items-center gap-1">
                        <Star size={10} className="text-purple-600" />
                        {t.totalApprovedPoints} pts
                      </span>
                    )}
                    {t.kpiName && (
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px]">
                        {t.kpiName}
                      </span>
                    )}
                    <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200">
                      Closed
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Pending Tasks */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <Clock size={14} className="text-sky-600" />
            <span>Pending Tasks ({summary.pendingTasks.length})</span>
          </div>
          {summary.pendingTasks.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-1">No pending tasks remaining.</p>
          ) : (
            <ul className="space-y-1.5">
              {summary.pendingTasks.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between text-xs py-2 px-3 rounded-lg bg-white border border-slate-200 hover:border-slate-300 transition gap-2"
                >
                  <TaskLink taskId={t.id} className="font-medium text-slate-900 hover:text-blue-600 hover:underline truncate">
                    {t.title}
                  </TaskLink>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {t.carryCount && t.carryCount > 0 ? (
                      <span className="text-indigo-600 text-[11px] font-medium">
                        Carried {t.carryCount}d
                      </span>
                    ) : null}
                    <Badge className="bg-sky-50 text-sky-800 border-sky-200 capitalize">
                      {t.status.replace("_", " ").toLowerCase()}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* On Hold */}
        {summary.onHoldTasks.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <PauseCircle size={14} className="text-amber-600" />
              <span>On Hold ({summary.onHoldTasks.length})</span>
            </div>
            <ul className="space-y-1.5">
              {summary.onHoldTasks.map((t) => (
                <li
                  key={t.id}
                  className="flex items-start justify-between text-xs py-2 px-3 rounded-lg bg-amber-50/20 border border-amber-200 gap-2"
                >
                  <div>
                    <TaskLink taskId={t.id} className="font-medium text-slate-900 hover:underline">
                      {t.title}
                    </TaskLink>
                    {t.holdReason && (
                      <p className="text-[11px] text-amber-800 mt-0.5">
                        <span className="font-medium">Reason:</span> {t.holdReason}
                      </p>
                    )}
                  </div>
                  <Badge className="bg-amber-100 text-amber-800 border-amber-200 shrink-0">
                    On Hold
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* In Review */}
        {summary.inReviewTasks.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <FileCheck size={14} className="text-violet-600" />
              <span>In Review ({summary.inReviewTasks.length})</span>
            </div>
            <ul className="space-y-1.5">
              {summary.inReviewTasks.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between text-xs py-2 px-3 rounded-lg bg-violet-50/20 border border-violet-200 gap-2"
                >
                  <TaskLink taskId={t.id} className="font-medium text-slate-900 hover:underline truncate">
                    {t.title}
                  </TaskLink>
                  <Badge className="bg-violet-100 text-violet-800 border-violet-200 shrink-0">
                    Under Review
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Tomorrow's Carry Forward */}
        {summary.tomorrowCarryForwardTasks.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500">
              <div className="flex items-center gap-1.5">
                <ArrowRight size={14} className="text-indigo-600" />
                <span>Tomorrow&apos;s Carry Forward ({summary.tomorrowCarryForwardTasks.length})</span>
              </div>
              {summary.carriedForwardToDate && (
                <span className="text-[11px] font-normal lowercase text-slate-400">
                  to {summary.carriedForwardToDate}
                </span>
              )}
            </div>
            <ul className="space-y-1.5">
              {summary.tomorrowCarryForwardTasks.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between text-xs py-2 px-3 rounded-lg bg-indigo-50/20 border border-indigo-100 gap-2"
                >
                  <TaskLink taskId={t.id} className="font-medium text-slate-900 hover:underline truncate">
                    {t.title}
                  </TaskLink>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {t.carryCount && t.carryCount > 0 ? (
                      <span className="text-indigo-600 text-[11px] font-medium">
                        Carried {t.carryCount}d
                      </span>
                    ) : null}
                    <Badge className="bg-slate-100 text-slate-700 capitalize">
                      {t.status.replace("_", " ").toLowerCase()}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}
