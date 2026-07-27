import { getCurrentUser } from "@/lib/auth";
import { adminDb } from "@/lib/firebase/admin";
import { Card, SectionTitle, Badge } from "../_components/ui";
import { deleteTemplate } from "@/lib/actions/templates";
import CreateTemplateDialog from "./CreateTemplateDialog";
import UseTemplateButton from "./UseTemplateButton";
import { fetchTaskTemplates, fetchAllKpiTemplates, fetchAllRoles, batchFetchByIds } from "@/lib/cache";

export default async function TemplatesPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [templatesSnap, kpiOptionsSnap, rolesSnap, peopleSnap] = await Promise.all([
    fetchTaskTemplates(adminDb),
    fetchAllKpiTemplates(adminDb),
    fetchAllRoles(adminDb),
    adminDb.collection("Employee").where("active", "==", true).get(),
  ]);

  const kpiOptions = kpiOptionsSnap.docs ? kpiOptionsSnap.docs
    .sort((a: any, b: any) => (a.data().orderIndex ?? 0) - (b.data().orderIndex ?? 0))
    .map((d: any) => ({ id: d.id, kpiName: d.data().kpiName, roleId: d.data().roleId })) : [];
  const roles = rolesSnap.docs ? rolesSnap.docs
    .sort((a: any, b: any) => (a.data().level ?? 99) - (b.data().level ?? 99))
    .map((d: any) => ({ id: d.id, title: d.data().title })) : [];
  const people = peopleSnap.docs ? peopleSnap.docs
    .map((d: any) => ({ id: d.id, name: d.data().name }))
    .sort((a, b) => a.name.localeCompare(b.name)) : [];

  // Batch fetch related data for templates using cached data
  const templateIds = templatesSnap.docs ? templatesSnap.docs.map((d: any) => d.id) : [];
  const kpiIds = templatesSnap.docs ? templatesSnap.docs.map((d: any) => d.data().kpiTemplateId).filter(Boolean) as string[] : [];
  const roleIds = templatesSnap.docs ? templatesSnap.docs.map((d: any) => d.data().roleId).filter(Boolean) as string[] : [];
  const creatorIds = templatesSnap.docs ? templatesSnap.docs.map((d: any) => d.data().createdById).filter(Boolean) as string[] : [];
  
  const [kpisMap, rolesMap, creatorsMap] = await Promise.all([
    batchFetchByIds('KpiTemplate', kpiIds, adminDb),
    batchFetchByIds('Role', roleIds, adminDb),
    batchFetchByIds('Employee', creatorIds, adminDb),
  ]);
  
  const templates = templatesSnap.docs ? templatesSnap.docs.map((doc: any) => {
    const t = doc.data() as any;
    const kpi = t.kpiTemplateId ? (kpisMap.get(t.kpiTemplateId) as any) : null;
    const role = t.roleId ? (rolesMap.get(t.roleId) as any) : null;
    const creator = t.createdById ? (creatorsMap.get(t.createdById) as any) : null;
    
    return {
      id: doc.id, ...t,
      kpiTemplate: kpi ? { kpiName: kpi.kpiName } : null,
      role: role ? { title: role.title } : null,
      createdBy: creator ? { name: creator.name } : null,
    };
  }).sort((a: any, b: any) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)) : [];

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
              {list.map((t: any) => {
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
