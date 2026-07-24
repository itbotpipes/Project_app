import { adminDb } from "@/lib/firebase/admin";

// Shared shape fed into <NewTaskDialog templates={...} /> so any "Assign New
// Task" modal can offer "start from a template" instead of retyping.
export async function loadTemplateOptions() {
  const templatesSnap = await adminDb.collection("TaskTemplate").orderBy("createdAt", "desc").get();
  return templatesSnap.docs.map((doc) => {
    const t = doc.data() as any;
    return {
      id: doc.id,
      name: t.name,
      title: t.title,
      description: t.description,
      category: t.category,
      kpiTemplateId: t.kpiTemplateId,
      sizeLabel: t.sizeLabel,
      roleId: t.roleId,
      checklist: (t.checklistJSON ? JSON.parse(t.checklistJSON) : []) as string[],
    };
  });
}
