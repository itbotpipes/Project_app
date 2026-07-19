import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { setEmployeeActive } from "@/lib/actions/admin";
import { Card, SectionTitle, Badge } from "../_components/ui";
import NewEmployeeForm from "./NewEmployeeForm";
import KpiManager from "./KpiManager";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!(user.systemRole === "ADMIN" || user.systemRole === "CEO")) redirect("/");

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [roles, employees, kpis, staleTasks] = await Promise.all([
    prisma.role.findMany({ orderBy: { level: "asc" } }),
    prisma.employee.findMany({ include: { role: true }, orderBy: [{ active: "desc" }, { name: "asc" }] }),
    prisma.kpiTemplate.findMany({ orderBy: [{ roleId: "asc" }, { orderIndex: "asc" }] }),
    prisma.task.findMany({
      where: { status: { notIn: ["CLOSED"] }, updatedAt: { lt: sevenDaysAgo } },
      include: { assignee: true },
      orderBy: { updatedAt: "asc" },
      take: 20,
    }),
  ]);

  const roleOpts = roles.map((r) => ({ id: r.id, label: r.title }));
  const managerOpts = employees
    .filter((e) => e.systemRole !== "EMPLOYEE")
    .map((e) => ({ id: e.id, label: `${e.name} (${e.role.title})` }));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Admin</h1>
        <p className="text-sm text-slate-500">Manage people, roles and KPI templates — no developer needed.</p>
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <SectionTitle>People ({employees.filter((e) => e.active).length} active)</SectionTitle>
          <NewEmployeeForm roles={roleOpts} managers={managerOpts} />
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium">Role</th>
                <th className="pb-2 font-medium">Access</th>
                <th className="pb-2 font-medium text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {employees.map((e) => (
                <tr key={e.id} className={e.active ? "" : "opacity-50"}>
                  <td className="py-2 font-medium">{e.name}</td>
                  <td className="py-2 text-slate-600">{e.role.title}</td>
                  <td className="py-2"><Badge className="bg-slate-100 text-slate-600">{e.systemRole}</Badge></td>
                  <td className="py-2 text-right">
                    <form action={setEmployeeActive} className="inline">
                      <input type="hidden" name="id" value={e.id} />
                      <input type="hidden" name="active" value={(!e.active).toString()} />
                      <button className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100">
                        {e.active ? "Deactivate" : "Activate"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {staleTasks.length > 0 && (
        <Card className="border-red-100 bg-red-50/40">
          <SectionTitle>
            🚨 Stale tasks — 7+ days untouched (department-head escalation)
          </SectionTitle>
          <ul className="space-y-1.5">
            {staleTasks.map((t) => (
              <li key={t.id} className="flex items-center justify-between text-sm">
                <Link href={`/task/${t.id}`} className="truncate hover:text-blue-600 hover:underline">
                  {t.title}
                </Link>
                <span className="ml-2 shrink-0 text-xs text-slate-500">
                  {t.assignee.name} · last touched {new Date(t.updatedAt).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <SectionTitle>KPI templates (buckets &amp; weightage)</SectionTitle>
        <KpiManager
          roles={roleOpts.map((r) => ({ id: r.id, title: r.label }))}
          kpis={kpis.map((k) => ({
            id: k.id, roleId: k.roleId, kraName: k.kraName, kpiName: k.kpiName,
            weightage: k.weightage, isPrimary: k.isPrimary,
          }))}
        />
      </Card>
    </div>
  );
}
