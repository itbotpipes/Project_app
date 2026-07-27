import { adminDb } from "@/lib/firebase/admin";
import { isManagerLike } from "@/lib/auth";
import { priorityQuadrant } from "@/lib/constants";
import { batchFetchByIds } from "./cache";

const PRIORITY_META: Record<string, { label: string; flag: string; tone: string }> = {
  "Do First": { label: "High", flag: "🚩", tone: "text-red-600" },
  Schedule: { label: "Medium", flag: "🏳️", tone: "text-blue-600" },
  Delegate: { label: "Medium", flag: "🏳️", tone: "text-amber-600" },
  Eliminate: { label: "Low", flag: "🏳️", tone: "text-slate-400" },
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function toLocalDateTimeValue(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function toDate(val: any): Date | null {
  if (!val) return null;
  if (val.toDate) return val.toDate();
  return new Date(val);
}
function toISOSafe(val: any): string | null {
  const d = toDate(val);
  return d ? d.toISOString() : null;
}

export type TaskDetailData = Awaited<ReturnType<typeof loadTaskDetailData>>;

export async function loadTaskDetailData(id: string, viewer: { id: string; systemRole: string }) {
  const taskDoc = await adminDb.collection("Task").doc(id).get();
  if (!taskDoc.exists) return null;
  const task = { id: taskDoc.id, ...taskDoc.data()! } as any;

  const allowed =
    isManagerLike(viewer.systemRole) ||
    [task.creatorId, task.assigneeId, task.reviewerId].includes(viewer.id);
  if (!allowed) return null;

  // Fetch all related docs in parallel
  const [
    creatorDoc, assigneeDoc, reviewerDoc, kpiTemplateDoc, projectDoc, groupDoc,
    commentsSnap, attachmentsSnap, remindersSnap, checklistSnap, watchersSnap, activitySnap
  ] = await Promise.all([
    task.creatorId ? adminDb.collection("Employee").doc(task.creatorId).get() : Promise.resolve(null),
    task.assigneeId ? adminDb.collection("Employee").doc(task.assigneeId).get() : Promise.resolve(null),
    task.reviewerId ? adminDb.collection("Employee").doc(task.reviewerId).get() : Promise.resolve(null),
    task.kpiTemplateId ? adminDb.collection("KpiTemplate").doc(task.kpiTemplateId).get() : Promise.resolve(null),
    task.projectId ? adminDb.collection("Project").doc(task.projectId).get() : Promise.resolve(null),
    task.groupId ? adminDb.collection("Group").doc(task.groupId).get() : Promise.resolve(null),
    adminDb.collection("TaskComment").where("taskId", "==", id).get(),
    adminDb.collection("Attachment").where("taskId", "==", id).get(),
    adminDb.collection("Reminder").where("taskId", "==", id).get(),
    adminDb.collection("ChecklistItem").where("taskId", "==", id).get(),
    adminDb.collection("TaskWatcher").where("taskId", "==", id).get(),
    adminDb.collection("AuditLog").where("entity", "==", "Task").where("entityId", "==", id).get(),
  ]);

  const assignee = assigneeDoc?.exists ? { id: assigneeDoc.id, ...assigneeDoc.data() } as any : null;

  // Fetch kpiOptions for the assignee's role
  const kpiOptions = assignee?.roleId
    ? (await adminDb.collection("KpiTemplate").where("roleId", "==", assignee.roleId).get()).docs
        .sort((a, b) => (a.data().orderIndex ?? 0) - (b.data().orderIndex ?? 0))
        .map((d) => ({ id: d.id, kpiName: d.data().kpiName }))
    : [];

  // Sort related docs in JS — no Firebase index needed
  commentsSnap.docs.sort((a, b) => (a.data().createdAt?.toMillis?.() ?? 0) - (b.data().createdAt?.toMillis?.() ?? 0));
  attachmentsSnap.docs.sort((a, b) => (b.data().createdAt?.toMillis?.() ?? 0) - (a.data().createdAt?.toMillis?.() ?? 0));
  remindersSnap.docs.sort((a, b) => (a.data().remindAt?.toMillis?.() ?? 0) - (b.data().remindAt?.toMillis?.() ?? 0));
  checklistSnap.docs.sort((a, b) => (a.data().orderIndex ?? 0) - (b.data().orderIndex ?? 0));
  activitySnap.docs.sort((a, b) => (b.data().createdAt?.toMillis?.() ?? 0) - (a.data().createdAt?.toMillis?.() ?? 0));
  activitySnap.docs.splice(30);

  // Batch fetch comment authors
  const commentAuthorIds = commentsSnap.docs.map(c => c.data().authorId).filter(Boolean) as string[];
  const commentAuthorsMap = await batchFetchByIds('Employee', commentAuthorIds, adminDb);
  
  const comments = commentsSnap.docs.map((c) => {
    const d = c.data();
    const author = commentAuthorsMap.get(d.authorId) as any;
    return { id: c.id, body: d.body, createdAt: toISOSafe(d.createdAt), author: { name: author?.name ?? "", avatarUrl: author?.avatarUrl ?? null } };
  });

  // Batch fetch watcher employee data
  const watcherEmployeeIds = watchersSnap.docs.map(w => w.data().employeeId).filter(Boolean) as string[];
  const watcherEmployeesMap = await batchFetchByIds('Employee', watcherEmployeeIds, adminDb);
  
  const watchers = watchersSnap.docs.map((w) => {
    const d = w.data();
    const emp = watcherEmployeesMap.get(d.employeeId) as any;
    return { id: w.id, employee: { id: d.employeeId, name: emp?.name ?? "", avatarUrl: emp?.avatarUrl ?? null } };
  });

  // Batch fetch checklist doneBy
  const checklistDoneByIds = checklistSnap.docs.map(c => c.data().doneById).filter(Boolean) as string[];
  const checklistDoneByMap = await batchFetchByIds('Employee', checklistDoneByIds, adminDb);
  
  const checklistItems = checklistSnap.docs.map((c) => {
    const d = c.data();
    const doneBy = d.doneById ? (checklistDoneByMap.get(d.doneById) as any) : null;
    const doneByName = doneBy?.name ?? null;
    return { id: c.id, text: d.text, done: d.done, doneByName };
  });

  // Batch fetch activity actors
  const activityActorIds = activitySnap.docs.map(a => a.data().actorId).filter(Boolean) as string[];
  const activityActorsMap = await batchFetchByIds('Employee', activityActorIds, adminDb);
  
  const activity = activitySnap.docs.map((a) => {
    const d = a.data();
    const actor = d.actorId ? (activityActorsMap.get(d.actorId) as any) : null;
    return { id: a.id, action: d.action, detail: d.detail, createdAt: toISOSafe(d.createdAt), actor: actor ? { name: actor.name, avatarUrl: actor.avatarUrl ?? null } : null };
  });

  const quad = priorityQuadrant(task.urgent, task.important);
  const priorityMeta = PRIORITY_META[quad];
  const isWatching = watchers.some((w) => w.employee.id === viewer.id);
  const canDelete = task.creatorId === viewer.id || task.assigneeId === viewer.id || isManagerLike(viewer.systemRole);

  const creatorData = creatorDoc?.exists ? creatorDoc.data() : null;
  const reviewerData = reviewerDoc?.exists ? reviewerDoc.data() : null;
  const kpiData = kpiTemplateDoc?.exists ? kpiTemplateDoc.data() : null;
  const projectData = projectDoc?.exists ? projectDoc.data() : null;
  const groupData = groupDoc?.exists ? groupDoc.data() : null;

  const dueAt = toDate(task.dueAt);

  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    category: task.category,
    sizeLabel: task.sizeLabel,
    reviewRequired: task.reviewRequired,
    reworkCount: task.reworkCount,
    rejectionReason: task.rejectionReason,
    holdReason: task.holdReason,
    estimatedMins: task.estimatedMins,
    kpiTemplateId: task.kpiTemplateId,
    urgent: task.urgent,
    important: task.important,
    priority: priorityMeta,
    createdAt: toISOSafe(task.createdAt),
    dueAt: dueAt ? dueAt.toISOString() : null,
    dueAtLocalValue: dueAt ? toLocalDateTimeValue(dueAt) : null,
    assignee: assignee ? { id: assignee.id, name: assignee.name, avatarUrl: assignee.avatarUrl } : null,
    creator: creatorData ? { id: task.creatorId, name: creatorData.name, avatarUrl: creatorData.avatarUrl } : null,
    reviewer: reviewerData ? { id: task.reviewerId, name: reviewerData.name } : null,
    kpiTemplate: kpiData ? { id: task.kpiTemplateId, kpiName: kpiData.kpiName } : null,
    project: projectData ? { id: task.projectId, name: projectData.name } : null,
    group: groupData ? { id: task.groupId, name: groupData.name } : null,
    watchers,
    isWatching,
    canDelete,
    canEdit: canDelete,
    kpiOptions,
    checklistItems,
    reminders: remindersSnap.docs.map((r) => ({ id: r.id, remindAt: toISOSafe(r.data().remindAt), sent: r.data().sent })),
    attachments: attachmentsSnap.docs.map((a) => ({ id: a.id, kind: a.data().kind, url: a.data().url, filename: a.data().filename })),
    comments,
    activity,
  };
}
