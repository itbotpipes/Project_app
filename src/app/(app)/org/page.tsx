import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { adminDb } from "@/lib/firebase/admin";
import { cn } from "@/lib/cn";
import { Card } from "../_components/ui";
import FlatOrgChart, { type FlatOrgData } from "./FlatOrgChart";
import InteractiveOrgChain from "./InteractiveOrgChain";
import { batchFetchByIds, fetchAllDepartments } from "@/lib/cache";

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
    ["CEO / Director", "COO"].includes(user.role?.title);

  const [employeesSnap, departmentsMap] = await Promise.all([
    adminDb.collection("Employee").where("active", "==", true).get(),
    fetchAllDepartments(adminDb),
  ]);

  // Batch fetch roles for all employees
  const roleIds = employeesSnap.docs ? employeesSnap.docs.map((d: any) => d.data().roleId).filter(Boolean) as string[] : [];
  const rolesMap = await batchFetchByIds('Role', roleIds, adminDb);

  // Resolve role for each employee using batched data
  const employees = employeesSnap.docs ? employeesSnap.docs.map((doc) => {
    const emp = doc.data() as any;
    const role = emp.roleId ? (rolesMap.get(emp.roleId) as any) : null;
    return { id: doc.id, ...emp, role: { title: role?.title ?? "Unknown", departmentId: role?.departmentId ?? null } };
  }) : [];
  
  employees.sort((a: any, b: any) => a.name.localeCompare(b.name));
  const departments = departmentsMap.docs ? departmentsMap.docs.map((d: any) => ({ id: d.id, ...d.data() })) as any[] : [];

  // Find the real top person (CEO / Director, or ADMIN/CEO system roles)
  const topPerson = employees.find((e: any) => e.role?.title === "CEO / Director")
    || employees.find((e: any) => e.systemRole === "CEO" || e.systemRole === "ADMIN")
    || employees.find((e: any) => !e.reportsToId);

  const rawEmployees = employees.map((e: any) => ({
    id: e.id,
    name: e.name,
    roleTitle: e.role.title,
    reportsToId: e.reportsToId || null,
    avatarUrl: e.avatarUrl || null,
  }));

  const flatData: FlatOrgData = {
    root: topPerson ? { id: topPerson.id, name: topPerson.name, roleTitle: topPerson.role.title } : null,
    departments: departments
      .map((d) => ({
        id: d.id,
        name: d.name,
        people: employees
          .filter((e) => e.role.departmentId === d.id && e.id !== topPerson?.id)
          .map((e) => ({ id: e.id, name: e.name, roleTitle: e.role.title })),
      }))
      .filter((d) => d.people.length > 0),
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Org Chart</h1>
          <p className="text-sm text-slate-500">
            {employees?.length ?? 0} people across the company — {view === "flat" ? "by position" : "by reporting chain"}.
          </p>
        </div>
        <div className="flex gap-1 rounded-full bg-slate-100 p-0.5 text-xs">
          <Link
            href="/org?view=flat"
            className={cn("rounded-full px-3 py-1.5 font-medium", view === "flat" ? "bg-white shadow-sm text-blue-700" : "text-slate-500")}
          >
            By position
          </Link>
          <Link
            href="/org?view=chain"
            className={cn("rounded-full px-3 py-1.5 font-medium", view === "chain" ? "bg-white shadow-sm text-blue-700" : "text-slate-500")}
          >
            By reporting chain
          </Link>
        </div>
      </div>

      <Card className="overflow-x-auto">
        {view === "flat" ? (
          <FlatOrgChart data={flatData} />
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
