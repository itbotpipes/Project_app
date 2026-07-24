import { getCurrentUser } from "@/lib/auth";
import { adminDb } from "@/lib/firebase/admin";
import { Card, SectionTitle, Badge } from "../_components/ui";
import { deleteTemplate } from "@/lib/actions/templates";
import CreateTemplateDialog from "./CreateTemplateDialog";
import UseTemplateButton from "./UseTemplateButton";

export default async function TemplatesPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [templatesSnap, kpiOptionsSnap, rolesSnap, peopleSnap] = await Promise.all([
    adminDb.collection("TaskTemplate").get(),
    adminDb.collection("KpiTemplate").get(),
    adminDb.collection("Role").get(),
    adminDb.collection("Employee").where("active", "==", true).get(),
  ]);

  const kpiOptions = kpiOptionsSnap.docs
    .sort((a, b) => (a.data().orderIndex ?? 0) - (b.data().orderIndex ?? 0))
    .map(d => ({ id: d.id, kpiName: d.data().kpiName, roleId: d.data().roleId }));
  const roles = rolesSnap.docs
    .sort((a, b) => (a.data().level ?? 99) - (b.data().level ?? 99))
    .map(d => ({ id: d.id, title: d.data().title }));
  const people = peopleSnap.docs
    .map(d => ({ id: d.id, name: d.data().name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const templates = (await Promise.all(
    templatesSnap.docs.map(async (doc) => {
      const t = doc.data() as any;
      const [kpiDoc, roleDoc, creatorDoc] = await Promise.all([
        t.kpiTemplateId ? adminDb.collection("KpiTemplate").doc(t.kpiTemplateId).get() : Promise.resolve(null),
        t.roleId ? adminDb.collection("Role").doc(t.roleId).get() : Promise.resolve(null),
        t.createdById ? adminDb.collection("Employee").doc(t.createdById).get() : Promise.resolve(null),
      ]);
      return {
        id: doc.id, ...t,
        kpiTemplate: kpiDoc?.exists ? { kpiName: kpiDoc.data()!.kpiName } : null,
        role: roleDoc?.exists ? { title: roleDoc.data()!.title } : null,
        createdBy: creatorDoc?.exists ? { name: creatorDoc.data()!.name } : null,
      };
    })
  )).sort((a: any, b: any) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));

  const byRole = new Map<string, typeof templates>();
  for (const t of templates) {
    const key = t.role?.title ?? "General (any position)";
    const arr = byRole.get(key) ?? [];
    arr.push(t);
    byRole.set(key, arr);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Task Templates</h1>
          <p className="text-sm text-slate-500">
            Save a checklist-heavy task once per position, reuse it any day instead of retyping.
          </p>
        </div>
        <CreateTemplateDialog kpiOptions={kpiOptions} roles={roles} />
      </div>

      {templates.length === 0 ? (
        <Card>
          <p className="py-6 text-center text-sm text-slate-400">No templates yet — create one above.</p>
        </Card>
      ) : (
        [...byRole.entries()].map(([roleTitle, list]) => (
          <Card key={roleTitle}>
            <SectionTitle>{roleTitle} · {list.length}</SectionTitle>
            <div className="divide-y divide-slate-100">
              {list.map((t) => {
                const checklist: string[] = t.checklistJSON ? JSON.parse(t.checklistJSON) : [];
                return (
                  <div key={t.id} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-slate-900">{t.name}</div>
                      <div className="text-xs text-slate-500">
                        → &ldquo;{t.title}&rdquo;{t.kpiTemplate && <> · {t.kpiTemplate.kpiName}</>} · by {t.createdBy?.name ?? "—"}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {t.category && <Badge className="bg-pink-100 text-pink-700">🏷 {t.category}</Badge>}
                        {checklist.length > 0 && <Badge className="bg-slate-100 text-slate-600">☑ {checklist.length} items</Badge>}
                      </div>
                    </div>
                    <UseTemplateButton templateId={t.id} people={people} selfId={user.id} />
                    <form action={deleteTemplate}>
                      <input type="hidden" name="id" value={t.id} />
                      <button type="submit" className="text-xs text-slate-400 hover:text-red-500">delete</button>
                    </form>
                  </div>
                );
              })}
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
