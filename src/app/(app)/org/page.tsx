import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { adminDb } from "@/lib/firebase/admin";
import { cn } from "@/lib/cn";
import { Card } from "../_components/ui";
import InteractivePositionOrgChart, {
  type PositionOrgData,
  type RoleOption,
  type PositionPerson,
} from "./InteractivePositionOrgChart";
import InteractiveOrgChain from "./InteractiveOrgChain";
import { batchFetchByIds, fetchAllDepartments, fetchAllRoles } from "@/lib/cache";

export default async function OrgChartPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  const sp = await searchParams;
  const view = sp.view === "chain" ? "chain" : "flat";

  const isExecutiveOrManager =
    user.systemRole === "ADMIN" ||
    user.systemRole === "CEO" ||
    user.systemRole === "MANAGER" ||
    ["CEO / Director", "COO", "GM"].includes(user.role?.title);

  const [employeesSnap, departmentsSnap, rolesSnap] = await Promise.all([
    adminDb.collection("Employee").where("active", "==", true).get(),
    fetchAllDepartments(adminDb),
    fetchAllRoles(adminDb),
  ]);

  // Map departments
  const departments = departmentsSnap.docs
    ? (departmentsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() })) as any[])
    : [];
  const deptMap = new Map<string, string>();
  departments.forEach((d) => deptMap.set(d.id, d.name));

  // Batch fetch roles for all employees
  const roleIds = employeesSnap.docs
    ? (employeesSnap.docs.map((d: any) => d.data().roleId).filter(Boolean) as string[])
    : [];
  const rolesMap = await batchFetchByIds("Role", roleIds, adminDb);

  // All roles for edit pickers
  const allRoles: RoleOption[] = rolesSnap.docs
    ? rolesSnap.docs.map((d: any) => {
        const r = d.data();
        return {
          id: d.id,
          title: r.title,
          departmentId: r.departmentId || null,
          level: r.level ?? 50,
        };
      })
    : [];

  // Temporary raw map for resolving hierarchy and manager relations
  const rawEmpMap = new Map<string, any>();
  employeesSnap.docs?.forEach((doc) => {
    rawEmpMap.set(doc.id, { id: doc.id, ...doc.data() });
  });

  // Calculate reporting depth from root (top of company = 0)
  function getReportingDepth(empId: string, visited = new Set<string>()): number {
    if (visited.has(empId)) return 99;
    visited.add(empId);
    const emp = rawEmpMap.get(empId);
    if (!emp || !emp.reportsToId) return 0;
    return 1 + getReportingDepth(emp.reportsToId, visited);
  }

  // Resolve role, department, depth and details for each employee
  const employees: PositionPerson[] = employeesSnap.docs
    ? employeesSnap.docs.map((doc) => {
        const emp = doc.data() as any;
        const role = emp.roleId ? (rolesMap.get(emp.roleId) as any) : null;
        const manager = emp.reportsToId ? rawEmpMap.get(emp.reportsToId) : null;
        const deptId = role?.departmentId || emp.departmentId || null;
        const deptName = deptId ? deptMap.get(deptId) || null : null;
        const depth = getReportingDepth(doc.id);

        return {
          id: doc.id,
          name: emp.name,
          email: emp.email,
          roleId: emp.roleId || "",
          roleTitle: role?.title ?? "Employee",
          level: role?.level ?? 50,
          depth: depth,
          systemRole: emp.systemRole || "EMPLOYEE",
          reportsToId: emp.reportsToId || null,
          reportsToName: manager?.name || null,
          departmentId: deptId,
          departmentName: deptName,
          avatarUrl: emp.avatarUrl || null,
        };
      })
    : [];

  // Identify top leader (Director / CEO) - depth 0
  const topPerson =
    employees.find((e) => e.roleTitle === "CEO / Director" || e.depth === 0) ||
    employees.find((e) => e.systemRole === "CEO" || e.systemRole === "ADMIN") ||
    employees.find((e) => !e.reportsToId) ||
    employees[0] ||
    null;

  // Identify executive second-in-command (COO Cherry)
  const cooExecutive = employees.find((e) => {
    if (e.id === topPerson?.id) return false;
    return e.roleTitle === "COO" || (e.reportsToId === topPerson?.id && (e.departmentName || "").toLowerCase() === "leadership");
  }) || null;

  const excludedFromDeptColumns = new Set([topPerson?.id, cooExecutive?.id].filter(Boolean));

  // Group ALL operational employees into Department columns ONCE
  // Exclude 'Leadership' and 'test dept' from standard department columns
  const activeDepartments = departments.filter((d) => {
    const name = (d.name || "").toLowerCase();
    return name !== "leadership" && name !== "test dept";
  });

  const departmentColumns = activeDepartments
    .map((d) => {
      const deptEmployees = employees
        .filter((e) => e.departmentId === d.id && !excludedFromDeptColumns.has(e.id))
        // Sort strictly by reporting depth first (Managers on top), then role level, then name
        .sort((a, b) => (a.depth ?? 50) - (b.depth ?? 50) || (a.level ?? 50) - (b.level ?? 50) || a.name.localeCompare(b.name));

      return {
        id: d.id,
        name: d.name,
        people: deptEmployees,
      };
    })
    .filter((d) => d.people.length > 0);

  // Position org data
  const positionData: PositionOrgData = {
    root: topPerson,
    leadership: cooExecutive ? [cooExecutive] : [],
    departments: departmentColumns,
    allDepartments: activeDepartments.map((d) => ({ id: d.id, name: d.name })),
    roles: allRoles,
    allEmployees: employees,
  };

  // Raw employee list for reporting chain
  const rawEmployees = employees.map((e) => ({
    id: e.id,
    name: e.name,
    roleTitle: e.roleTitle,
    level: e.level,
    depth: e.depth,
    systemRole: e.systemRole,
    departmentName: e.departmentName,
    reportsToId: e.reportsToId || null,
    avatarUrl: e.avatarUrl || null,
  }));

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Org Structure & Hierarchy</h1>
          <p className="text-sm text-slate-500">
            {employees.length} team members across {departmentColumns.length} departments —{" "}
            {view === "flat" ? "viewed by proper hierarchy & departments" : "viewed by reporting chain of command"}.
          </p>
        </div>
        <div className="flex gap-1 rounded-full bg-slate-100 p-0.5 text-xs font-semibold">
          <Link
            href="/org?view=flat"
            className={cn(
              "rounded-full px-3.5 py-1.5 transition",
              view === "flat" ? "bg-white shadow-xs text-blue-700 font-bold" : "text-slate-500 hover:text-slate-800"
            )}
          >
            By Department & Position
          </Link>
          <Link
            href="/org?view=chain"
            className={cn(
              "rounded-full px-3.5 py-1.5 transition",
              view === "chain" ? "bg-white shadow-xs text-blue-700 font-bold" : "text-slate-500 hover:text-slate-800"
            )}
          >
            By Reporting Chain
          </Link>
        </div>
      </div>

      {/* Main View Container */}
      <Card className="overflow-x-auto p-5 border-slate-200/90 shadow-xs">
        {view === "flat" ? (
          <InteractivePositionOrgChart initialData={positionData} canEdit={isExecutiveOrManager} />
        ) : (
          <InteractiveOrgChain
            employees={rawEmployees}
            topPersonId={topPerson?.id || null}
            canEdit={isExecutiveOrManager}
          />
        )}
      </Card>
    </div>
  );
}
