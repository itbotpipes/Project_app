import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { adminDb } from "@/lib/firebase/admin";
import { setEmployeeActive, setEmployeeAvatar } from "@/lib/actions/admin";
import { deleteTemplate } from "@/lib/actions/templates";
import { Card, SectionTitle, Badge } from "../_components/ui";
import Avatar from "../_components/Avatar";
import NewEmployeeForm from "./NewEmployeeForm";
import KpiManager from "./KpiManager";
import RoleManager from "./RoleManager";
import DepartmentManager from "./DepartmentManager";
import EditEmployeeDialog from "./EditEmployeeDialog";
import PeopleTable from "./PeopleTable";
import AdminQuickSearch, { SearchableItem } from "./AdminQuickSearch";
import CreateTemplateDialog from "../templates/CreateTemplateDialog";
import TaskLink from "../_components/TaskLink";

function toDate(val: any): Date {
  if (!val) return new Date(0);
  if (val.toDate) return val.toDate();
  return new Date(val);
}

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!hasPermission(user, "admin")) redirect("/");

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [rolesSnap, employeesSnap, kpisSnap, staleTasksSnap, templatesSnap, departmentsSnap, systemRolesSnap] = await Promise.all([
    adminDb.collection("Role").orderBy("level", "asc").get(),
    adminDb.collection("Employee").orderBy("name", "asc").get(),
    adminDb.collection("KpiTemplate").get(),
    adminDb.collection("Task").where("status", "!=", "CLOSED").get(),
    adminDb.collection("TaskTemplate").get(),
    adminDb.collection("Department").get(),
    adminDb.collection("SystemRole").orderBy("name", "asc").get(),
  ]);

  const roles = rolesSnap.docs.map((d) => {
    const data = d.data() as any;
    const serialized: any = { id: d.id };
    for (const [key, value] of Object.entries(data)) {
      if (value && typeof value === 'object' && 'toDate' in value) {
        serialized[key] = (value as any).toDate().toISOString();
      } else {
        serialized[key] = value;
      }
    }
    return serialized;
  }) as any[];
  const kpis = kpisSnap.docs
    .sort((a, b) => (a.data().roleId ?? "").localeCompare(b.data().roleId ?? "") || (a.data().orderIndex ?? 0) - (b.data().orderIndex ?? 0))
    .map((d) => ({ id: d.id, ...d.data() })) as any[];
  // Filter & sort stale tasks in JS — no composite index needed
  const staleTasksDocs = staleTasksSnap.docs
    .filter(d => { const u = d.data().updatedAt?.toDate?.() ?? null; return u && u < sevenDaysAgo && d.data().status !== "CLOSED"; })
    .sort((a, b) => (a.data().updatedAt?.toMillis?.() ?? 0) - (b.data().updatedAt?.toMillis?.() ?? 0))
    .slice(0, 20);
  const staleTasksSnap2 = { docs: staleTasksDocs };
  // Sort templates in JS
  const templates = templatesSnap.docs
    .filter(d => d.data().roleId != null)
    .sort((a, b) => {
      const roleCompare = (a.data().roleId ?? "").localeCompare(b.data().roleId ?? "");
      if (roleCompare !== 0) return roleCompare;
      return (b.data().createdAt?.toMillis?.() ?? 0) - (a.data().createdAt?.toMillis?.() ?? 0);
    })
    .map((d) => {
      const data = d.data();
      return { 
        id: d.id, 
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString() ?? null,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() ?? null,
      };
    }) as any[];

  // Build roleMap for fast lookup
  const roleMap = new Map<string, any>(roles.map((r: any) => [r.id, r]));

  // Employees with their roles
  const employees = employeesSnap.docs.map((d) => {
    const data = d.data() as any;
    return { id: d.id, ...data, role: roleMap.get(data.roleId) ?? { title: "Unknown" } };
  }).sort((a: any, b: any) => (b.active ? 1 : 0) - (a.active ? 1 : 0) || a.name.localeCompare(b.name));

  // Stale tasks with assignees
  const staleTasks = await Promise.all(
    staleTasksSnap2.docs.map(async (doc) => {
      const t = doc.data() as any;
      const assigneeDoc = t.assigneeId ? await adminDb.collection("Employee").doc(t.assigneeId).get() : null;
      return {
        id: doc.id,
        title: t.title,
        updatedAt: toDate(t.updatedAt),
        assignee: { name: assigneeDoc?.exists ? assigneeDoc.data()!.name : "Unknown" },
      };
    })
  );

  const roleOpts = roles.map((r: any) => ({ id: r.id, label: r.title }));
  const templatesByRole = new Map<string, any[]>();
  for (const t of templates) {
    if (!t.roleId) continue;
    const arr = templatesByRole.get(t.roleId) ?? [];
    arr.push(t);
    templatesByRole.set(t.roleId, arr);
  }
  const kpiOptionsForTemplates = kpis.map((k: any) => ({ id: k.id, kpiName: k.kpiName, roleId: k.roleId }));
  
  const defaultSystemRoles = [
    { id: "EMPLOYEE", name: "EMPLOYEE", isManager: false, isAdmin: false },
    { id: "MANAGER", name: "MANAGER", isManager: true, isAdmin: false },
    { id: "CEO", name: "CEO", isManager: true, isAdmin: true },
    { id: "ADMIN", name: "ADMIN", isManager: true, isAdmin: true },
  ];
  const customSystemRoles = systemRolesSnap && !systemRolesSnap.empty
    ? systemRolesSnap.docs.map((d: any) => ({
        id: d.data().name,
        name: d.data().name,
        isManager: !!d.data().isManager,
        isAdmin: !!d.data().isAdmin,
      }))
    : [];

  const allSystemRoles = [...defaultSystemRoles];
  for (const csr of customSystemRoles) {
    if (!allSystemRoles.some((r) => r.name.toUpperCase() === csr.name.toUpperCase())) {
      allSystemRoles.push(csr);
    }
  }
  const systemRoleOpts = allSystemRoles;

  const managerOpts = employees
    .filter((e: any) => {
      // Find if they have manager permissions dynamically or via defaults
      const srObj = systemRoleOpts.find((sr) => sr.name === e.systemRole);
      return srObj ? (srObj.isManager || srObj.isAdmin) : (e.systemRole !== "EMPLOYEE");
    })
    .map((e: any) => ({ id: e.id, label: `${e.name} (${e.role.title})` }));

  const departmentItems = departmentsSnap.docs.map((d: any) => ({
    id: d.id,
    name: d.data().name,
    createdAt: d.data().createdAt?.toDate?.()?.toISOString() ?? null,
  })).sort((a: any, b: any) => a.name.localeCompare(b.name));

  const departmentEmployees = employees.map((e: any) => ({
    id: e.id,
    name: e.name,
    email: e.email,
    avatarUrl: e.avatarUrl || null,
    active: !!e.active,
    roleId: e.roleId,
    departmentId: e.departmentId || null,
    role: {
      id: e.role?.id,
      title: e.role?.title || "Unknown",
      departmentId: e.role?.departmentId || null,
    },
    systemRole: e.systemRole || "EMPLOYEE",
    reportsToId: e.reportsToId || null,
    reportsToIds: e.reportsToIds || (e.reportsToId ? [e.reportsToId] : []),
    reportsToName: e.reportsToId ? (employees.find((m: any) => m.id === e.reportsToId)?.name || null) : null,
    birthday: e.birthday ? (e.birthday.toDate ? e.birthday.toDate().toISOString() : new Date(e.birthday).toISOString()) : null,
  }));

  const searchableItems: SearchableItem[] = [
    ...employees.map((e: any) => ({
      id: e.id,
      type: "person" as const,
      title: e.name,
      subtitle: `${e.role?.title || "Unknown Position"} • ${e.email}`,
      tag: e.active ? "Active" : "Inactive",
      avatarUrl: e.avatarUrl || null,
      elementId: `person-row-${e.id}`,
    })),
    ...departmentItems.map((d) => ({
      id: d.id,
      type: "department" as const,
      title: d.name,
      subtitle: "Department",
    })),
    ...roles.map((r: any) => ({
      id: r.id,
      type: "role" as const,
      title: r.title,
      subtitle: `Level ${r.level} Role`,
    })),
    ...kpis.map((k: any) => ({
      id: k.id,
      type: "kpi" as const,
      title: k.kpiName || "KPI Template",
      subtitle: `${k.kraName || "KRA"} (${k.weightage || 0} pts)`,
    })),
    ...templates.map((t: any) => ({
      id: t.id,
      type: "template" as const,
      title: t.name || "Task Template",
      subtitle: roleMap.get(t.roleId)?.title ? `Template for ${roleMap.get(t.roleId).title}` : "Task Template",
    })),
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Admin</h1>
          <p className="text-sm text-slate-500">Manage people, departments, roles and KPI templates — no developer needed.</p>
        </div>
        <AdminQuickSearch items={searchableItems} />
      </div>

      <Card>
        <div className="flex items-center justify-between mb-3">
          <SectionTitle>People ({employees.filter((e: any) => e.active).length} active)</SectionTitle>
          <NewEmployeeForm roles={roleOpts} managers={managerOpts} systemRoles={systemRoleOpts} />
        </div>
        <PeopleTable
          employees={departmentEmployees}
          roles={roleOpts}
          managers={managerOpts}
          systemRoles={systemRoleOpts}
        />
      </Card>

      {/* Departments Section */}
      <Card>
        <DepartmentManager
          departments={departmentItems}
          employees={departmentEmployees}
          roles={roles.map((r: any) => ({
            id: r.id,
            title: r.title,
            level: r.level,
            departmentId: r.departmentId || null,
          }))}
          systemRoles={systemRoleOpts}
          managers={managerOpts}
        />
      </Card>

      <Card>
        <RoleManager
          roles={roles}
          departments={departmentsSnap.docs.map((d: any) => ({ id: d.id, name: d.data().name }))}
        />
      </Card>

     
      

      <Card>
        <SectionTitle>KPI templates (buckets &amp; weightage)</SectionTitle>
        <KpiManager
          roles={roleOpts.map((r: any) => ({ id: r.id, title: r.label }))}
          kpis={kpis.map((k: any) => ({
            id: k.id, roleId: k.roleId, kraName: k.kraName, kpiName: k.kpiName,
            weightage: k.weightage, isPrimary: k.isPrimary,
          }))}
        />
      </Card>

      <Card>
        <SectionTitle>Task templates by position</SectionTitle>
        <p className="mb-3 text-xs text-slate-500">
          Set a reusable task (with checklist matching that position&apos;s KPIs) once per role —
          anyone in that position can pick it from &ldquo;Use template&rdquo; on{" "}
          <Link href="/templates" className="text-blue-600 hover:underline">Task Templates</Link>{" "}
          instead of typing the same task every day.
        </p>
        <div className="divide-y divide-slate-100">
          {roles.map((r: any) => {
            const list = templatesByRole.get(r.id) ?? [];
            return (
              <div key={r.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <div className="min-w-[10rem]">
                  <div className="text-sm font-medium text-slate-800">{r.title}</div>
                  <div className="text-xs text-slate-400">
                    {list.length ? `${list.length} template${list.length === 1 ? "" : "s"}` : "no templates yet"}
                  </div>
                </div>
                <div className="flex flex-1 flex-wrap gap-1.5">
                  {list.map((t: any) => (
                    <span key={t.id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                      {t.name}
                      <form action={deleteTemplate} className="inline">
                        <input type="hidden" name="id" value={t.id} />
                        <button type="submit" className="text-slate-400 hover:text-red-500">×</button>
                      </form>
                    </span>
                  ))}
                </div>
                <CreateTemplateDialog kpiOptions={kpiOptionsForTemplates} lockRoleId={r.id} lockRoleName={r.title} buttonLabel="Set task template" />
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
