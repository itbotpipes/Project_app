import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, isManagerLike } from "@/lib/auth";
import { adminDb } from "@/lib/firebase/admin";
import { Card, Badge } from "../_components/ui";
import { monthLabel } from "@/lib/scores";
import { batchFetchByIds, cachedFetch } from "@/lib/cache";

export default async function PeoplePage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!isManagerLike(user.systemRole)) redirect("/");

  const employeesSnap = await cachedFetch(
    'active-employees',
    () => adminDb.collection("Employee").where("active", "==", true).get(),
    300 // cache for 5 minutes
  );

  // Batch fetch all related data
  const roleIds = employeesSnap.docs ? employeesSnap.docs.map((d: any) => d.data().roleId).filter(Boolean) as string[] : [];
  const managerIds = employeesSnap.docs ? employeesSnap.docs.map((d: any) => d.data().reportsToId).filter(Boolean) as string[] : [];
  const employeeIds = employeesSnap.docs ? employeesSnap.docs.map((d: any) => d.id) : [];
  
  const [rolesMap, managersMap, scorecardsSnap] = await Promise.all([
    batchFetchByIds('Role', roleIds, adminDb),
    batchFetchByIds('Employee', managerIds, adminDb),
    employeeIds.length > 0 ? adminDb.collection("MonthlyScorecard").where("employeeId", "in", employeeIds).get() : Promise.resolve({ docs: [] } as any),
  ]);
  
  // Pre-fetch departments for roles
  const deptIds = roleIds.map(rid => {
    const role = rolesMap.get(rid) as any;
    return role?.departmentId;
  }).filter(Boolean) as string[];
  const departmentsMap = await batchFetchByIds('Department', deptIds, adminDb);
  
  // Group scorecards by employee
  const scorecardsByEmployee = new Map<string, any[]>();
  scorecardsSnap.docs?.forEach((doc: any) => {
    const empId = doc.data().employeeId;
    if (!scorecardsByEmployee.has(empId)) scorecardsByEmployee.set(empId, []);
    scorecardsByEmployee.get(empId)!.push(doc.data());
  });
  
  // Sort scorecards for each employee and get latest
  const latestScorecards = new Map<string, any>();
  scorecardsByEmployee.forEach((cards, empId) => {
    const sorted = cards.sort((a, b) => (b.year - a.year) || (b.month - a.month));
    if (sorted.length > 0) latestScorecards.set(empId, sorted[0]);
  });

  const employees = employeesSnap.docs ? employeesSnap.docs.map((doc) => {
    const emp = doc.data() as any;
    const role = emp.roleId ? (rolesMap.get(emp.roleId) as any) : null;
    const manager = emp.reportsToId ? (managersMap.get(emp.reportsToId) as any) : null;
    const department = role?.departmentId ? (departmentsMap.get(role.departmentId) as any) : null;
    
    const roleData: any = role 
      ? { 
          title: role.title, 
          level: role.level,
          department: department ? { name: department.name } : null 
        }
      : { title: "Unknown", department: null };
    
    const reportsToName = manager?.name ?? "—";
    const latestScorecard = latestScorecards.get(doc.id) || null;

    return { id: doc.id, ...emp, role: roleData, reportsTo: { name: reportsToName }, scorecards: latestScorecard ? [latestScorecard] : [] };
  }) : [];
  
  employees.sort((a: any, b: any) => (a.role.level ?? 99) - (b.role.level ?? 99) || a.name.localeCompare(b.name));

  // group by department
  const byDept = new Map<string, typeof employees>();
  for (const e of employees) {
    const d = e.role.department?.name ?? "Other";
    const arr = byDept.get(d) ?? [];
    arr.push(e);
    byDept.set(d, arr);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Directory</h1>
        <p className="text-sm text-slate-500">{employees.length} people across the company</p>
      </div>

      {[...byDept.entries()].map(([dept, list]) => (
        <Card key={dept}>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {dept}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="pb-2 font-medium">Name</th>
                  <th className="pb-2 font-medium">Role</th>
                  <th className="pb-2 font-medium">Reports to</th>
                  <th className="pb-2 font-medium text-right">Latest score</th>
                  <th className="pb-2 font-medium text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((e) => {
                  const s = e.scorecards[0];
                  return (
                    <tr key={e.id}>
                      <td className="py-2 font-medium">
                        <Link href={`/people/${e.id}`} className="hover:text-blue-600 hover:underline">
                          {e.name}
                        </Link>
                      </td>
                      <td className="py-2 text-slate-600">{e.role.title}</td>
                      <td className="py-2 text-slate-500">{e.reportsTo?.name ?? "—"}</td>
                      <td className="py-2 text-right">
                        {s ? (
                          <Badge className="bg-slate-100 text-slate-700">
                            {Math.round(s.total)} · {monthLabel(s.year, s.month)}
                          </Badge>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="py-2 pl-2 text-right">
                        <Link href={`/people/${e.id}`} className="text-xs text-blue-600 hover:underline">
                          Trend →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
    </div>
  );
}
