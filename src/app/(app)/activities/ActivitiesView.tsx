"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, X, Filter } from "lucide-react";
import { Card, SectionTitle } from "../_components/ui";
import Avatar from "../_components/Avatar";
import TaskLink from "../_components/TaskLink";

export interface ActivityItem {
  id: string;
  action: string;
  actionTitle: string;
  category: "task" | "team" | "admin" | "kpi" | "system";
  badgeText: string;
  badgeTone: "emerald" | "blue" | "violet" | "amber" | "rose" | "sky" | "indigo" | "slate";
  entity: string;
  entityId?: string | null;
  taskTitle?: string | null;
  detail?: string | null;
  cleanDetail?: string | null;
  reason?: string | null;
  actor: {
    id?: string;
    name: string;
    email?: string;
    avatarUrl?: string | null;
    roleTitle?: string | null;
  };
  createdAtIso: string;
  relativeTime: string;
}

export interface ActivitiesViewProps {
  logs: ActivityItem[];
  isManager: boolean;
  employees: Array<{ id: string; name: string }>;
}

export default function ActivitiesView({ logs, isManager, employees }: ActivitiesViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [actorFilter, setActorFilter] = useState<string>("ALL");
  const [visibleCount, setVisibleCount] = useState<number>(30);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (categoryFilter === "TASKS" && log.category !== "task") return false;
      if (categoryFilter === "COMPLETED" && (log.badgeTone !== "emerald" || !log.action.includes("CLOSED") && log.actionTitle !== "Completed task")) return false;
      if (categoryFilter === "TEAM" && log.category !== "team") return false;
      if (categoryFilter === "ADMIN" && log.category !== "admin" && log.category !== "kpi") return false;

      if (actorFilter !== "ALL" && log.actor.id !== actorFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          log.actor.name.toLowerCase().includes(q) ||
          log.actionTitle.toLowerCase().includes(q) ||
          (log.taskTitle && log.taskTitle.toLowerCase().includes(q)) ||
          (log.cleanDetail && log.cleanDetail.toLowerCase().includes(q)) ||
          (log.reason && log.reason.toLowerCase().includes(q));
        if (!matches) return false;
      }

      return true;
    });
  }, [logs, categoryFilter, actorFilter, searchQuery]);

  // Group logs by Date Header (Today, Yesterday, Earlier)
  const groupedSections = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    const sections: { title: string; items: ActivityItem[] }[] = [
      { title: "Today", items: [] },
      { title: "Yesterday", items: [] },
      { title: "Earlier", items: [] },
    ];

    const displayed = filteredLogs.slice(0, visibleCount);

    for (const item of displayed) {
      const dateStr = item.createdAtIso.slice(0, 10);
      if (dateStr === todayStr) {
        sections[0].items.push(item);
      } else if (dateStr === yesterdayStr) {
        sections[1].items.push(item);
      } else {
        sections[2].items.push(item);
      }
    }

    return sections.filter((s) => s.items.length > 0);
  }, [filteredLogs, visibleCount]);

  function getBadgeColor(tone: ActivityItem["badgeTone"]) {
    switch (tone) {
      case "emerald":
        return "bg-emerald-100 text-emerald-800";
      case "blue":
        return "bg-blue-100 text-blue-800";
      case "amber":
        return "bg-amber-100 text-amber-800";
      case "rose":
        return "bg-red-100 text-red-800";
      case "violet":
        return "bg-purple-100 text-purple-800";
      case "sky":
        return "bg-sky-100 text-sky-800";
      default:
        return "bg-slate-100 text-slate-700";
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-semibold">Activities</h1>
        <p className="text-sm text-slate-500">
          {isManager ? "Everything happening across TaskFlow." : "Your recent activity and task updates."}
        </p>
      </div>

      <Card>
        {/* Search & Filter Toolbar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
          {/* Search Input */}
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search activities or people..."
              className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-8 text-xs outline-none focus:border-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Category Filter Pills */}
            <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs">
              {[
                { id: "ALL", label: "All" },
                { id: "TASKS", label: "Tasks" },
                { id: "COMPLETED", label: "Closed" },
                { id: "TEAM", label: "Team" },
                { id: "ADMIN", label: "Admin" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setCategoryFilter(tab.id)}
                  className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                    categoryFilter === tab.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* People Filter Dropdown */}
            {isManager && (
              <select
                value={actorFilter}
                onChange={(e) => setActorFilter(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 outline-none focus:border-blue-500"
              >
                <option value="ALL">All People</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Activity Stream Feed */}
        {groupedSections.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-400">No activity found.</p>
        ) : (
          <div className="space-y-6 pt-3">
            {groupedSections.map((section) => (
              <div key={section.title} className="space-y-2">
                <SectionTitle>{section.title}</SectionTitle>

                <div className="divide-y divide-slate-100">
                  {section.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between gap-3 py-3 hover:bg-slate-50/60 px-2 rounded-lg transition-colors text-sm"
                    >
                      {/* Avatar + Main Description */}
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <Avatar
                          name={item.actor.name}
                          url={item.actor.avatarUrl}
                          size={28}
                          className="shrink-0 mt-0.5"
                        />

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5 leading-snug">
                            <Link
                              href={item.actor.id ? `/daily-reports/${item.actor.id}` : "#"}
                              className="font-semibold text-slate-900 hover:text-blue-600 hover:underline"
                            >
                              {item.actor.name}
                            </Link>

                            <span className="text-slate-500">{item.actionTitle}</span>

                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${getBadgeColor(item.badgeTone)}`}>
                              {item.badgeText}
                            </span>
                          </div>

                          {/* Task Link or Detail Line */}
                          <div className="mt-0.5 text-xs text-slate-600">
                            {item.taskTitle && item.entityId ? (
                              <TaskLink
                                taskId={item.entityId}
                                className="font-medium text-slate-800 hover:text-blue-600 hover:underline"
                              >
                                {item.taskTitle}
                              </TaskLink>
                            ) : item.cleanDetail ? (
                              <span>{item.cleanDetail}</span>
                            ) : null}

                            {/* Reason / Note (if any) */}
                            {item.reason && (
                              <span className="text-slate-400 block mt-0.5">
                                Reason: {item.reason}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Time */}
                      <span className="shrink-0 text-xs text-slate-400 pt-0.5 whitespace-nowrap">
                        {item.relativeTime}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Load More Button */}
        {filteredLogs.length > visibleCount && (
          <div className="border-t border-slate-100 pt-3 text-center">
            <button
              type="button"
              onClick={() => setVisibleCount((prev) => prev + 30)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Load more ({filteredLogs.length - visibleCount} remaining)
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}
