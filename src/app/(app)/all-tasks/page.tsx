import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { adminDb } from "@/lib/firebase/admin";
import { TASK_STATUS_ORDER, TASK_STATUS_LABEL, priorityQuadrant } from "@/lib/constants";
import { Card, Badge, StatCard } from "../_components/ui";
import TaskLink from "../_components/TaskLink";
import Avatar from "../_components/Avatar";
import { 
  Search, 
  Filter, 
  X, 
  ClipboardList, 
  Play, 
  CheckCircle, 
  AlertCircle 
} from "lucide-react";

// Normalization function for dates
function toDate(val: any): Date | null {
  if (!val) return null;
  if (val.toDate) return val.toDate();
  return new Date(val);
}

const statusTone: Record<string, string> = {
  NEW: "bg-blue-50 text-blue-700 border-blue-200 border",
  ACCEPTED: "bg-indigo-50 text-indigo-700 border-indigo-200 border",
  IN_PROGRESS: "bg-amber-50 text-amber-700 border-amber-200 border",
  ON_HOLD: "bg-rose-50 text-rose-700 border-rose-200 border",
  PENDING_REVIEW: "bg-violet-50 text-violet-700 border-violet-200 border",
  CLOSED: "bg-emerald-50 text-emerald-700 border-emerald-200 border",
};

const priorityTone: Record<string, string> = {
  "Do First": "bg-red-50 text-red-700 border border-red-150",
  "Schedule": "bg-blue-50 text-blue-700 border border-blue-150",
  "Delegate": "bg-amber-50 text-amber-700 border border-amber-150",
  "Eliminate": "bg-slate-50 text-slate-500 border border-slate-200",
};

export default async function AllTasksPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    departmentId?: string;
    assigneeId?: string;
    status?: string;
    priority?: string;
  }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Auth: Only Director/CEO/COO can view this page
  const isExecutive =
    user.systemRole === "ADMIN" ||
    user.systemRole === "CEO" ||
    ["CEO / Director", "COO"].includes(user.role?.title);

  if (!isExecutive) {
    redirect("/");
  }

  const sp = await searchParams;
  const searchVal = sp.search || "";
  const filterDeptId = sp.departmentId || "";
  const filterAssigneeId = sp.assigneeId || "";
  const filterStatus = sp.status || "";
  const filterPriority = sp.priority || "";

  // Fetch all required data in parallel
  const [tasksSnap, employeesSnap, departmentsSnap, rolesSnap, projectsSnap] = await Promise.all([
    adminDb.collection("Task").get(),
    adminDb.collection("Employee").where("active", "==", true).get(),
    adminDb.collection("Department").get(),
    adminDb.collection("Role").get(),
    adminDb.collection("Project").get(),
  ]);

  // Build mapping lookup tables
  const depts = departmentsSnap.docs.map(doc => ({ id: doc.id, name: doc.data().name }));
  const rolesMap = new Map(rolesSnap.docs.map(doc => [doc.id, doc.data()]));
  const projectsMap = new Map(projectsSnap.docs.map(doc => [doc.id, doc.data().name]));

  // Employees lookup
  const employees = employeesSnap.docs.map(doc => {
    const data = doc.data();
    const role = data.roleId ? rolesMap.get(data.roleId) : null;
    const deptId = role ? (role as any).departmentId : null;
    const deptName = deptId ? (depts.find(d => d.id === deptId)?.name || "Other") : "Other";
    return {
      id: doc.id,
      name: data.name,
      email: data.email,
      avatarUrl: data.avatarUrl,
      roleTitle: role ? (role as any).title : "No Role",
      departmentId: deptId,
      departmentName: deptName,
    };
  }).sort((a, b) => a.name.localeCompare(b.name));

  const employeesMap = new Map(employees.map(e => [e.id, e]));

  // Process all tasks
  const rawTasks = tasksSnap.docs
    .map(doc => {
      const data = doc.data();
      const assignee = data.assigneeId ? employeesMap.get(data.assigneeId) : null;
      const project = data.projectId ? projectsMap.get(data.projectId) : null;
      const creator = data.creatorId ? employeesMap.get(data.creatorId) : null;
      const quad = priorityQuadrant(!!data.urgent, !!data.important);

      return {
        id: doc.id,
        title: data.title,
        description: data.description || "",
        status: data.status,
        sizeLabel: data.sizeLabel || null,
        urgent: !!data.urgent,
        important: !!data.important,
        estimatedMins: data.estimatedMins || null,
        dueAt: toDate(data.dueAt),
        createdAt: toDate(data.createdAt),
        deletedAt: toDate(data.deletedAt),
        holdReason: data.holdReason || null,
        reviewRequired: !!data.reviewRequired,
        carryCount: data.carryCount || 0,
        priority: quad,
        assignee,
        creator,
        projectName: project || null,
      };
    })
    .filter(t => !t.deletedAt); // Exclude deleted tasks

  // Compute stats before applying filters
  const totalTasks = rawTasks.length;
  const inProgressTasks = rawTasks.filter(t => t.status === "IN_PROGRESS").length;
  const reviewTasks = rawTasks.filter(t => t.status === "PENDING_REVIEW").length;
  
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const overdueTasks = rawTasks.filter(t => 
    t.status !== "CLOSED" && 
    t.dueAt && 
    t.dueAt.getTime() < today.getTime()
  ).length;

  // Apply filters to tasks
  const filteredTasks = rawTasks.filter(t => {
    // Search filter
    if (searchVal) {
      const query = searchVal.toLowerCase();
      const matchTitle = t.title.toLowerCase().includes(query);
      const matchDesc = t.description.toLowerCase().includes(query);
      const matchAssignee = t.assignee?.name.toLowerCase().includes(query);
      if (!matchTitle && !matchDesc && !matchAssignee) return false;
    }

    // Department filter
    if (filterDeptId && t.assignee?.departmentId !== filterDeptId) {
      return false;
    }

    // Assignee filter
    if (filterAssigneeId && t.assignee?.id !== filterAssigneeId) {
      return false;
    }

    // Status filter
    if (filterStatus && t.status !== filterStatus) {
      return false;
    }

    // Priority filter
    if (filterPriority && t.priority !== filterPriority) {
      return false;
    }

    return true;
  }).sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));

  // Determine if filters are active
  const hasActiveFilters = !!(searchVal || filterDeptId || filterAssigneeId || filterStatus || filterPriority);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">All Employee Tasks</h1>
        <p className="text-sm text-slate-500">
          Executive monitoring board to review, search, and track all tasks across the company.
        </p>
      </div>

      {/* Aggregate Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          label="Total Active Tasks" 
          value={totalTasks} 
          tone="default"
          sub={<span className="flex items-center gap-1"><ClipboardList size={14} /> Total tracked tasks</span>} 
        />
        <StatCard 
          label="In Progress" 
          value={inProgressTasks} 
          tone="blue"
          sub={<span className="flex items-center gap-1"><Play size={14} className="text-blue-500" /> Active execution</span>} 
        />
        <StatCard 
          label="Awaiting Review" 
          value={reviewTasks} 
          tone="amber"
          sub={<span className="flex items-center gap-1"><CheckCircle size={14} className="text-amber-500" /> Pending approval</span>} 
        />
        <StatCard 
          label="Overdue Tasks" 
          value={overdueTasks} 
          tone="red"
          sub={<span className="flex items-center gap-1"><AlertCircle size={14} className="text-red-500" /> Past due date</span>} 
        />
      </div>

      {/* Filter Bar */}
      <Card className="p-4">
        <form method="GET" className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="flex-1">
            <label className="text-xs font-semibold text-slate-500">Search Tasks</label>
            <div className="relative mt-1">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Search size={16} />
              </span>
              <input
                type="text"
                name="search"
                defaultValue={searchVal}
                placeholder="Search title, details, assignee..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white"
              />
            </div>
          </div>

          <div className="w-full md:w-48">
            <label className="text-xs font-semibold text-slate-500">Department</label>
            <select
              name="departmentId"
              defaultValue={filterDeptId}
              className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 p-2 text-sm outline-none transition focus:border-blue-500 focus:bg-white"
            >
              <option value="">All Departments</option>
              {depts.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div className="w-full md:w-48">
            <label className="text-xs font-semibold text-slate-500">Employee</label>
            <select
              name="assigneeId"
              defaultValue={filterAssigneeId}
              className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 p-2 text-sm outline-none transition focus:border-blue-500 focus:bg-white"
            >
              <option value="">All Employees</option>
              {employees.map(e => (
                <option key={e.id} value={e.id}>{e.name} ({e.roleTitle})</option>
              ))}
            </select>
          </div>

          <div className="w-full md:w-40">
            <label className="text-xs font-semibold text-slate-500">Status</label>
            <select
              name="status"
              defaultValue={filterStatus}
              className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 p-2 text-sm outline-none transition focus:border-blue-500 focus:bg-white"
            >
              <option value="">All Statuses</option>
              {TASK_STATUS_ORDER.map(s => (
                <option key={s} value={s}>{TASK_STATUS_LABEL[s]}</option>
              ))}
            </select>
          </div>

          <div className="w-full md:w-40">
            <label className="text-xs font-semibold text-slate-500">Priority</label>
            <select
              name="priority"
              defaultValue={filterPriority}
              className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 p-2 text-sm outline-none transition focus:border-blue-500 focus:bg-white"
            >
              <option value="">All Priorities</option>
              <option value="Do First">Do First (Q1)</option>
              <option value="Schedule">Schedule (Q2)</option>
              <option value="Delegate">Delegate (Q3)</option>
              <option value="Eliminate">Eliminate (Q4)</option>
            </select>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              <Filter size={16} /> Filter
            </button>

            {hasActiveFilters && (
              <Link
                href="/all-tasks"
                className="flex items-center justify-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
              >
                <X size={16} />
              </Link>
            )}
          </div>
        </form>
      </Card>

      {/* Task List / Table */}
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/75 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-6 py-4">Task Details</th>
                <th className="px-6 py-4">Assignee</th>
                <th className="px-6 py-4">Department</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Priority</th>
                <th className="px-6 py-4">Due Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTasks.length > 0 ? (
                filteredTasks.map(task => (
                  <tr key={task.id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-4">
                      <div className="max-w-md space-y-1">
                        <TaskLink
                          taskId={task.id}
                          className="font-medium text-slate-900 hover:text-blue-600 hover:underline"
                        >
                          {task.title}
                        </TaskLink>
                        {task.projectName && (
                          <div className="text-xs text-slate-500 flex items-center gap-1">
                            📁 {task.projectName}
                          </div>
                        )}
                        {task.carryCount > 0 && (
                          <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-medium text-rose-600 border border-rose-200">
                            ↻ carried {task.carryCount}×
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {task.assignee ? (
                        <div className="flex items-center gap-3">
                          <Avatar name={task.assignee.name} url={task.assignee.avatarUrl} size={32} />
                          <div>
                            <div className="font-semibold text-slate-800 text-xs">{task.assignee.name}</div>
                            <div className="text-[10px] text-slate-500">{task.assignee.roleTitle}</div>
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-600">
                      {task.assignee?.departmentName || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge className={statusTone[task.status] || "bg-slate-50 text-slate-600"}>
                        {TASK_STATUS_LABEL[task.status] || task.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge className={priorityTone[task.priority] || "bg-slate-50 text-slate-500"}>
                        {task.priority}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500">
                      {task.dueAt ? (
                        task.dueAt.toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    No tasks found matching your criteria. Try adjusting your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
