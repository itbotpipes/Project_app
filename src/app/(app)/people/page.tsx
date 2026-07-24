import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, isManagerLike } from "@/lib/auth";
import { adminDb } from "@/lib/firebase/admin";
import { Card, Badge } from "../_components/ui";
import { monthLabel } from "@/lib/scores";

export default async function PeoplePage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!isManagerLike(user.systemRole)) redirect("/");

  const employeesSnap = await adminDb.collection("Employee").where("active", "==", true).get();

  const employees = await Promise.all(
    employeesSnap.docs.map(async (doc) => {
      const emp = doc.data() as any;
      let roleData: any = { title: "Unknown", department: null };
      let reportsToName = "—";
      let latestScorecard: any = null;

      const [roleDoc, managerDoc, scorecardsSnap] = await Promise.all([
        emp.roleId ? adminDb.collection("Role").doc(emp.roleId).get() : Promise.resolve(null),
        emp.reportsToId ? adminDb.collection("Employee").doc(emp.reportsToId).get() : Promise.resolve(null),
        adminDb.collection("MonthlyScorecard").where("employeeId", "==", doc.id).get(),
      ]);

      if (roleDoc?.exists) {
        const role = roleDoc.data()!;
        roleData.title = role.title;
        if (role.departmentId) {
          const deptDoc = await adminDb.collection("Department").doc(role.departmentId).get();
          if (deptDoc.exists) roleData.department = { name: deptDoc.data()!.name };
        }
      }
      if (managerDoc?.exists) reportsToName = managerDoc.data()!.name;
      if (!scorecardsSnap.empty) {
        // Sort in JS — no composite index needed
        const sorted = scorecardsSnap.docs.sort((a, b) => (b.data().year - a.data().year) || (b.data().month - a.data().month));
        latestScorecard = sorted[0].data();
      }

      return { id: doc.id, ...emp, role: roleData, reportsTo: { name: reportsToName }, scorecards: latestScorecard ? [latestScorecard] : [] };
    })
  );
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
