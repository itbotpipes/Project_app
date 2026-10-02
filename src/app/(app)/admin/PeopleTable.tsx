"use client";

import { useState, useMemo } from "react";
import { Search, X, Users, Filter, CheckCircle2, UserX } from "lucide-react";
import Avatar from "../_components/Avatar";
import { Badge } from "../_components/ui";
import EditEmployeeDialog from "./EditEmployeeDialog";
import { setEmployeeActive } from "@/lib/actions/admin";

export interface PeopleTableProps {
  employees: Array<{
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
    active: boolean;
    roleId: string;
    role: { id?: string; title: string };
    systemRole: string;
    reportsToId?: string | null;
    reportsToIds?: string[];
    birthday?: string | null;
  }>;
  roles: Array<{ id: string; label: string }>;
  managers: Array<{ id: string; label: string }>;
  systemRoles: Array<{ id: string; name: string }>;
}

export default function PeopleTable({
  employees,
  roles,
  managers,
  systemRoles,
}: PeopleTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");

  const filteredEmployees = useMemo(() => {
    return employees.filter((e) => {
      if (statusFilter === "ACTIVE" && !e.active) return false;
      if (statusFilter === "INACTIVE" && e.active) return false;
      if (roleFilter !== "ALL" && e.roleId !== roleFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          e.name.toLowerCase().includes(q) ||
          e.email.toLowerCase().includes(q) ||
          e.role.title.toLowerCase().includes(q) ||
          e.systemRole.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [employees, searchQuery, statusFilter, roleFilter]);

  const activeCount = employees.filter((e) => e.active).length;

  return (
    <div className="space-y-3">
      {/* Search & Filter Controls */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        {/* Search Input with Search Icon & Clear Button */}
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search people by name, email, or role..."
            className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-8 text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
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

        {/* Status & Role Filters */}
        <div className="flex items-center gap-2">
          {/* Status Filter */}
          <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setStatusFilter("ALL")}
              className={`rounded-md px-2 py-1 font-medium transition-all ${
                statusFilter === "ALL" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              All ({employees.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("ACTIVE")}
              className={`rounded-md px-2 py-1 font-medium transition-all ${
                statusFilter === "ACTIVE" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Active ({activeCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("INACTIVE")}
              className={`rounded-md px-2 py-1 font-medium transition-all ${
                statusFilter === "INACTIVE" ? "bg-white text-slate-700 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Inactive ({employees.length - activeCount})
            </button>
          </div>

          {/* Role Filter Dropdown */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-blue-500"
          >
            <option value="ALL">All Roles</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* People Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-100">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50/70 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="py-2.5 pl-3 font-medium"></th>
              <th className="py-2.5 font-medium">Name</th>
              <th className="py-2.5 font-medium">Role</th>
              <th className="py-2.5 font-medium">Access</th>
              <th className="py-2.5 font-medium text-right">Status</th>
              <th className="py-2.5 pr-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {filteredEmployees.map((e) => (
              <tr key={e.id} id={`person-row-${e.id}`} className={`hover:bg-slate-50/70 ${e.active ? "" : "opacity-50"}`}>
                <td className="py-2 pl-3 pr-2">
                  <Avatar name={e.name} url={e.avatarUrl} size={28} />
                </td>
                <td className="py-2">
                  <div className="font-medium text-slate-900">{e.name}</div>
                  <div className="text-xs text-slate-400">{e.email}</div>
                </td>
                <td className="py-2 text-slate-600">{e.role.title}</td>
                <td className="py-2">
                  <Badge className="bg-slate-100 text-slate-600">{e.systemRole}</Badge>
                </td>
                <td className="py-2 text-right">
                  <form action={setEmployeeActive} className="inline">
                    <input type="hidden" name="id" value={e.id} />
                    <input type="hidden" name="active" value={(!e.active).toString()} />
                    <button className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100">
                      {e.active ? "Deactivate" : "Activate"}
                    </button>
                  </form>
                </td>
                <td className="py-2 pr-3 text-right">
                  <EditEmployeeDialog
                    employee={{
                      id: e.id,
                      name: e.name,
                      email: e.email,
                      roleId: e.roleId,
                      reportsToId: e.reportsToId || null,
                      reportsToIds: e.reportsToIds || (e.reportsToId ? [e.reportsToId] : []),
                      systemRole: e.systemRole,
                      birthday: e.birthday,
                    }}
                    roles={roles}
                    managers={managers}
                    systemRoles={systemRoles}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredEmployees.length === 0 && (
          <div className="p-8 text-center text-xs text-slate-400">
            No people found matching your search filters.
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
        <span>
          Showing {filteredEmployees.length} of {employees.length} people
        </span>
      </div>
    </div>
  );
}
