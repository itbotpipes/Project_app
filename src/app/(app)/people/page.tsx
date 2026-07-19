import { redirect } from "next/navigation";
import { getCurrentUser, isManagerLike } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, Badge } from "../_components/ui";
import { monthLabel } from "@/lib/scores";

export default async function PeoplePage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!isManagerLike(user.systemRole)) redirect("/");

  const employees = await prisma.employee.findMany({
    where: { active: true },
    include: {
      role: { include: { department: true } },
      reportsTo: { select: { name: true } },
      scorecards: { orderBy: [{ year: "desc" }, { month: "desc" }], take: 1 },
    },
    orderBy: [{ role: { level: "asc" } }, { name: "asc" }],
  });

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
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((e) => {
                  const s = e.scorecards[0];
                  return (
                    <tr key={e.id}>
                      <td className="py-2 font-medium">{e.name}</td>
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
