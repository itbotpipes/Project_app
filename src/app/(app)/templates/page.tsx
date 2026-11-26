import { getCurrentUser, isManagerLike } from "@/lib/auth";
import { adminDb } from "@/lib/firebase/admin";
import { Card, SectionTitle, Badge } from "../_components/ui";
import { deleteTemplate } from "@/lib/actions/templates";
import CreateTemplateDialog from "./CreateTemplateDialog";
import UseTemplateButton from "./UseTemplateButton";
import { fetchTaskTemplates, fetchAllKpiTemplates, fetchAllRoles, batchFetchByIds } from "@/lib/cache";
import { User, FileStack, Sparkles, CheckSquare, Layers, Trash2 } from "lucide-react";

export const metadata = {
  title: "Task Templates | TaskFlow",
  description: "Create and reuse personal or role-specific task templates",
};

export default async function TemplatesPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [templatesSnap, kpiOptionsSnap, rolesSnap, peopleSnap] = await Promise.all([
    fetchTaskTemplates(adminDb),
    fetchAllKpiTemplates(adminDb),
    fetchAllRoles(adminDb),
    adminDb.collection("Employee").where("active", "==", true).get(),
  ]);

  const kpiOptions = kpiOptionsSnap.docs
    ? kpiOptionsSnap.docs
        .sort((a: any, b: any) => (a.data().orderIndex ?? 0) - (b.data().orderIndex ?? 0))
        .map((d: any) => ({ id: d.id, kpiName: d.data().kpiName, roleId: d.data().roleId }))
    : [];

  const roles = rolesSnap.docs
    ? rolesSnap.docs
        .sort((a: any, b: any) => (a.data().level ?? 99) - (b.data().level ?? 99))
        .map((d: any) => ({ id: d.id, title: d.data().title }))
    : [];

  const people = peopleSnap.docs
    ? peopleSnap.docs
        .map((d: any) => ({ id: d.id, name: d.data().name }))
        .sort((a: any, b: any) => a.name.localeCompare(b.name))
    : [];

  // Batch fetch related data for templates using cached data
  const templateIds = templatesSnap.docs ? templatesSnap.docs.map((d: any) => d.id) : [];
  const kpiIds = templatesSnap.docs ? (templatesSnap.docs.map((d: any) => d.data().kpiTemplateId).filter(Boolean) as string[]) : [];
  const roleIds = templatesSnap.docs ? (templatesSnap.docs.map((d: any) => d.data().roleId).filter(Boolean) as string[]) : [];
  const creatorIds = templatesSnap.docs ? (templatesSnap.docs.map((d: any) => d.data().createdById).filter(Boolean) as string[]) : [];

  const [kpisMap, rolesMap, creatorsMap] = await Promise.all([
    batchFetchByIds("KpiTemplate", kpiIds, adminDb),
    batchFetchByIds("Role", roleIds, adminDb),
    batchFetchByIds("Employee", creatorIds, adminDb),
  ]);

  const allTemplates = templatesSnap.docs
    ? templatesSnap.docs
        .map((doc: any) => {
          const t = doc.data() as any;
          const kpi = t.kpiTemplateId ? (kpisMap.get(t.kpiTemplateId) as any) : null;
          const role = t.roleId ? (rolesMap.get(t.roleId) as any) : null;
          const creator = t.createdById ? (creatorsMap.get(t.createdById) as any) : null;

          return {
            id: doc.id,
            ...t,
            kpiTemplate: kpi ? { kpiName: kpi.kpiName } : null,
            role: role ? { title: role.title } : null,
            createdBy: creator ? { name: creator.name } : null,
          };
        })
        .sort((a: any, b: any) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
    : [];

  // Separate templates: My Templates vs Others
  const myTemplates = allTemplates.filter((t: any) => t.createdById === user.id);
  const otherTemplates = allTemplates.filter((t: any) => t.createdById !== user.id);

  // Group other templates by role
  const byRole = new Map<string, typeof allTemplates>();
  for (const t of otherTemplates) {
    const key = t.role?.title ?? "General (Company-wide)";
    const arr = byRole.get(key) ?? [];
    arr.push(t);
    byRole.set(key, arr);
  }

  const isManager = isManagerLike(user.systemRole);

  let userRoleId = user.roleId || user.role?.id;
  if (!userRoleId && user.role?.title) {
    const matched = roles.find((r: any) => r.title.toLowerCase() === user.role?.title?.toLowerCase());
    if (matched) userRoleId = matched.id;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-600 text-white rounded-xl shadow-xs">
              <FileStack size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Task Templates</h1>
              <p className="text-xs text-slate-500">
                Create and reuse personal or shared task templates with pre-defined checklists & KPIs
              </p>
            </div>
          </div>
        </div>

        <CreateTemplateDialog
          kpiOptions={kpiOptions}
          roles={roles}
          userRoleId={userRoleId}
          buttonLabel="Create My Template"
        />
      </div>

      {/* ── 1. MY TEMPLATES SECTION ─────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <User size={18} className="text-blue-600" />
            My Templates
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-semibold">
              {myTemplates.length}
            </span>
          </h2>
        </div>

        {myTemplates.length === 0 ? (
          <Card className="p-6 text-center border-dashed border-2 border-slate-200 bg-slate-50/50">
            <FileStack size={28} className="mx-auto text-slate-300 mb-2" />
            <h3 className="text-sm font-semibold text-slate-700">You haven&apos;t created any personal templates yet</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              Save your repetitive tasks once with all checklist steps and details, then start them in 1 click anytime.
            </p>
            <div className="mt-3">
              <CreateTemplateDialog
                kpiOptions={kpiOptions}
                roles={roles}
                userRoleId={userRoleId}
                buttonLabel="+ Create Your First Template"
              />
            </div>
          </Card>
        ) : (
          <Card className="p-4 divide-y divide-slate-100">
            {myTemplates.map((t: any) => {
              const checklist: string[] = t.checklistJSON ? JSON.parse(t.checklistJSON) : [];
              return (
                <div key={t.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-bold text-slate-900">{t.name}</div>
                      {t.isPersonal ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                          Personal
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Shared
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-600 mt-0.5">
                      → <span className="font-medium text-slate-800">&ldquo;{t.title}&rdquo;</span>
                      {t.kpiTemplate && <span className="text-slate-400"> · {t.kpiTemplate.kpiName}</span>}
                    </div>
                    {t.description && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-1">{t.description}</p>
                    )}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {t.sizeLabel && (
                        <Badge className="bg-slate-100 text-slate-700 text-[10px]">
                          ⚡ {t.sizeLabel.toLowerCase()}
                        </Badge>
                      )}
                      {t.category && (
                        <Badge className="bg-pink-50 text-pink-700 border-pink-200 text-[10px]">
                          🏷 {t.category}
                        </Badge>
                      )}
                      {checklist.length > 0 && (
                        <Badge className="bg-sky-50 text-sky-700 border-sky-200 text-[10px]">
                          <CheckSquare size={10} className="mr-1 inline" /> {checklist.length} checklist steps
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <UseTemplateButton templateId={t.id} people={people} selfId={user.id} />
                    <form action={deleteTemplate}>
                      <input type="hidden" name="id" value={t.id} />
                      <button
                        type="submit"
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                        title="Delete template"
                      >
                        <Trash2 size={15} />
                      </button>
                    </form>
                  </div>
                </div>
              );
            })}
          </Card>
        )}
      </div>

      {/* ── 2. SHARED / ROLE & COMPANY TEMPLATES SECTION ──────────────── */}
      <div className="space-y-4 pt-2">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Layers size={18} className="text-slate-600" />
          Company & Role Templates
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold">
            {otherTemplates.length}
          </span>
        </h2>

        {otherTemplates.length === 0 ? (
          <Card className="p-6 text-center text-xs text-slate-400">
            No company or position templates configured yet.
          </Card>
        ) : (
          [...byRole.entries()].map(([roleTitle, list]) => (
            <Card key={roleTitle} className="p-4 space-y-3">
              <SectionTitle>
                <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                  <span>{roleTitle}</span>
                  <span className="text-xs font-normal text-slate-400">({list.length})</span>
                </div>
              </SectionTitle>

              <div className="divide-y divide-slate-100">
                {list.map((t: any) => {
                  const checklist: string[] = t.checklistJSON ? JSON.parse(t.checklistJSON) : [];
                  const canDelete = t.createdById === user.id || isManager;
                  return (
                    <div key={t.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-slate-900">{t.name}</div>
                        <div className="text-xs text-slate-500">
                          → &ldquo;{t.title}&rdquo;
                          {t.kpiTemplate && <> · {t.kpiTemplate.kpiName}</>}
                          {t.createdBy && <> · by {t.createdBy.name}</>}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          {t.category && (
                            <Badge className="bg-pink-100 text-pink-700 text-[10px]">
                              🏷 {t.category}
                            </Badge>
                          )}
                          {checklist.length > 0 && (
                            <Badge className="bg-slate-100 text-slate-600 text-[10px]">
                              ☑ {checklist.length} items
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <UseTemplateButton templateId={t.id} people={people} selfId={user.id} />
                        {canDelete && (
                          <form action={deleteTemplate}>
                            <input type="hidden" name="id" value={t.id} />
                            <button
                              type="submit"
                              className="p-1.5 text-slate-300 hover:text-red-500 rounded-lg transition"
                              title="Delete template"
                            >
                              <Trash2 size={14} />
                            </button>
                          </form>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
