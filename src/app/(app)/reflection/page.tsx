import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { saveReflection } from "@/lib/actions/reflection";
import { mondayOf } from "@/lib/date";
import { Card, SectionTitle } from "../_components/ui";

export default async function ReflectionPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const weekStart = mondayOf();
  const current = await prisma.weeklyReflection.findUnique({
    where: { employeeId_weekStart: { employeeId: user.id, weekStart } },
  });
  const past = await prisma.weeklyReflection.findMany({
    where: { employeeId: user.id, weekStart: { lt: weekStart } },
    orderBy: { weekStart: "desc" },
    take: 8,
  });

  const field =
    "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Weekly Reflection</h1>
        <p className="text-sm text-slate-500">
          Three quick questions every Friday — for your growth and your manager&apos;s awareness.
        </p>
      </div>

      <Card>
        <SectionTitle>
          This week ({weekStart.toLocaleDateString()}){current ? " · saved ✓" : ""}
        </SectionTitle>
        <form action={saveReflection} className="space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            What went well this week?
            <textarea name="wentWell" rows={2} defaultValue={current?.wentWell ?? ""} className={field} />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            What delayed your tasks?
            <textarea name="whatDelayed" rows={2} defaultValue={current?.whatDelayed ?? ""} className={field} />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            What can be improved?
            <textarea name="whatImprove" rows={2} defaultValue={current?.whatImprove ?? ""} className={field} />
          </label>
          <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Save reflection
          </button>
        </form>
      </Card>

      {past.length > 0 && (
        <Card>
          <SectionTitle>Past reflections</SectionTitle>
          <div className="space-y-4">
            {past.map((r) => (
              <div key={r.id} className="border-l-2 border-slate-200 pl-3">
                <div className="text-xs font-medium text-slate-400">
                  Week of {new Date(r.weekStart).toLocaleDateString()}
                </div>
                {r.wentWell && <p className="text-sm"><span className="text-emerald-600">✓ </span>{r.wentWell}</p>}
                {r.whatDelayed && <p className="text-sm"><span className="text-amber-600">⏳ </span>{r.whatDelayed}</p>}
                {r.whatImprove && <p className="text-sm"><span className="text-blue-600">↗ </span>{r.whatImprove}</p>}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
