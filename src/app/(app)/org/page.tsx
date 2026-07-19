import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card } from "../_components/ui";
import OrgNode, { type OrgPerson } from "./OrgNode";

export default async function OrgChartPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const employees = await prisma.employee.findMany({
    where: { active: true },
    include: { role: true },
    orderBy: { name: "asc" },
  });

  const byId = new Map<string, OrgPerson>();
  for (const e of employees) byId.set(e.id, { id: e.id, name: e.name, roleTitle: e.role.title, children: [] });

  const roots: OrgPerson[] = [];
  for (const e of employees) {
    const node = byId.get(e.id)!;
    if (e.reportsToId && byId.has(e.reportsToId)) {
      byId.get(e.reportsToId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Org Chart</h1>
        <p className="text-sm text-slate-500">
          Who reports to whom, at a glance — {employees.length} people across the company.
        </p>
      </div>

      <Card className="overflow-x-auto">
        <div className="min-w-max space-y-4">
          {roots.map((r) => (
            <OrgNode key={r.id} node={r} />
          ))}
        </div>
      </Card>
    </div>
  );
}
