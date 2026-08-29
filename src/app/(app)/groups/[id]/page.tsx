import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser, isManagerLike } from "@/lib/auth";
import { adminDb } from "@/lib/firebase/admin";
import { TASK_STATUS_LABEL, priorityQuadrant } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { Card, SectionTitle } from "../../_components/ui";
import NewTaskDialog from "../../board/NewTaskDialog";
import { loadTemplateOptions } from "@/lib/templates";
import GroupMembers from "./GroupMembers";
import ExchangeControl from "./ExchangeControl";
import TaskLink from "../../_components/TaskLink";
import { batchFetchByIds, cachedFetch } from "@/lib/cache";
import DeactivateGroupButton from "./DeactivateGroupButton";
import DeleteAnnouncementButton from "./DeleteAnnouncementButton";
import { createGroupAnnouncement } from "@/lib/actions/announcements";

const STATUS_TONE: Record<string, string> = {
  NEW: "bg-slate-100 text-slate-600",
  ACCEPTED: "bg-sky-100 text-sky-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  ON_HOLD: "bg-amber-100 text-amber-700",
  PENDING_REVIEW: "bg-violet-100 text-violet-700",
  CLOSED: "bg-emerald-100 text-emerald-700",
};

type Tab = "all" | "overdue" | "pending" | "inprogress" | "completed";

function toDate(val: any): Date | null {
  if (!val) return null;
  if (val.toDate) return val.toDate();
  return new Date(val);
}

export default async function GroupDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; scope?: string; view?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await getCurrentUser();
  const view = sp.view === "announcements" ? "announcements" : "tasks";
  if (!user) return null;

  const groupDoc = await adminDb.collection("Group").doc(id).get();
  if (!groupDoc.exists) notFound();
  const group = { id: groupDoc.id, ...groupDoc.data() } as any;
  if (group.active === false) notFound();

  const [membersSnap, tasksSnap, kpiOptionsSnap, allPeopleSnap, announcementsSnap] = await Promise.all([
    adminDb.collection("GroupMember").where("groupId", "==", id).get(),
    adminDb.collection("Task").where("groupId", "==", id).where("deletedAt", "==", null).get(),
    adminDb.collection("KpiTemplate").get(),
    cachedFetch(
      'active-employees',
      () => adminDb.collection("Employee").where("active", "==", true).get(),
      300 // cache for 5 minutes
    ),
    adminDb.collection("Announcement").where("groupId", "==", id).get(),
  ]);

  // Resolve member employees - batch fetch
  const memberEmployeeIds = membersSnap.docs.map(m => m.data().employeeId).filter(Boolean) as string[];
  const membersMap = await batchFetchByIds('Employee', memberEmployeeIds, adminDb);
  
  const memberEmployees = membersSnap.docs.map((m) => {
    const md = m.data() as any;
    const emp = membersMap.get(md.employeeId) as any;
    return { id: md.employeeId, name: emp?.name ?? "Unknown", roleId: emp?.roleId ?? null, role: md.role, memberId: m.id };
  });

  const memberIdsSet = new Set(memberEmployees.map((m) => m.id));
  if (!isMember) notFound();

  const canManage = group.createdById === user.id || user.systemRole === "ADMIN" || user.systemRole === "CEO" ||
    memberEmployees.some((m) => m.id === user.id && m.role === "ADMIN");

  // Resolve task details - batch fetch
  const taskDocs = tasksSnap.docs ?? [];
  const taskIds = taskDocs.map(d => d.id);
  const assigneeIds = taskDocs.map(d => d.data().assigneeId).filter(Boolean) as string[];
  const kpiIds = taskDocs.map(d => d.data().kpiTemplateId).filter(Boolean) as string[];
  
  const [assigneesMap, kpisMap, checklistsSnap] = await Promise.all([
    batchFetchByIds('Employee', assigneeIds, adminDb),
    batchFetchByIds('KpiTemplate', kpiIds, adminDb),
    taskIds.length > 0 ? adminDb.collection("ChecklistItem").where("taskId", "in", taskIds).get() : Promise.resolve({ docs: [] } as any),
  ]);
  
  // Group checklist items by task
  const checklistsByTask = new Map<string, any[]>();
  checklistsSnap.docs?.forEach((c: any) => {
    const taskId = c.data().taskId;
    if (!checklistsByTask.has(taskId)) checklistsByTask.set(taskId, []);
    checklistsByTask.get(taskId)!.push({ done: c.data().done });
  });
  
  const tasks = taskDocs.map((doc) => {
    const t = doc.data() as any;
    const assignee = t.assigneeId ? (assigneesMap.get(t.assigneeId) as any) : null;
    const kpi = t.kpiTemplateId ? (kpisMap.get(t.kpiTemplateId) as any) : null;
    const checklistItems = checklistsByTask.get(doc.id) || [];
    
    return {
      id: doc.id,
      title: t.title,
      status: t.status,
      urgent: t.urgent,
      important: t.important,
      assigneeId: t.assigneeId,
      dueAt: toDate(t.dueAt),
      kpiTemplate: kpi ? { kpiName: kpi.kpiName } : null,
      checklistItems,
      assignee: assignee ? { id: t.assigneeId, name: assignee.name } : { id: t.assigneeId, name: "Unknown" },
    };
  });

  // Sort in JS — no composite index needed
  const kpiOptions = kpiOptionsSnap.docs ? kpiOptionsSnap.docs
    .sort((a, b) => (a.data().orderIndex ?? 0) - (b.data().orderIndex ?? 0))
    .map((d) => ({ id: d.id, kpiName: d.data().kpiName, kraName: d.data().kraName, roleId: d.data().roleId })) : [];
  const allPeople = allPeopleSnap.docs ? allPeopleSnap.docs
    .map((d) => ({ id: d.id, name: d.data().name }))
    .sort((a, b) => a.name.localeCompare(b.name)) : [];
  const memberPeople = memberEmployees.map((m) => ({ id: m.id, name: m.name, roleId: m.roleId }));
  const templates = await loadTemplateOptions();

  // Resolve announcement author names
  const announcementDocs = announcementsSnap.docs ?? [];
  const announcementAuthorIds = Array.from(new Set(announcementDocs.map((doc: any) => doc.data().authorId).filter(Boolean))) as string[];
  const announcementAuthorsMap = await batchFetchByIds('Employee', announcementAuthorIds, adminDb);

  const announcements = announcementDocs.map((doc: any) => {
    const data = doc.data();
    const author = data.authorId ? (announcementAuthorsMap.get(data.authorId) as any) : null;
    return {
      id: doc.id,
      body: data.body,
      authorName: author?.name ?? "Unknown",
      authorId: data.authorId,
      createdAt: toDate(data.createdAt) ?? new Date(),
    };
  }).sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime());

  const scope = sp.scope === "mine" ? "mine" : "all";
  const scoped = scope === "mine" ? tasks.filter((t) => t.assigneeId === user.id) : tasks;
  const now = new Date();
  const counts = {
    overdue: scoped.filter((t) => t.dueAt && t.dueAt < now && t.status !== "CLOSED").length,
    pending: scoped.filter((t) => t.status === "NEW" || t.status === "ACCEPTED").length,
    inprogress: scoped.filter((t) => ["IN_PROGRESS", "ON_HOLD", "PENDING_REVIEW"].includes(t.status)).length,
    completed: scoped.filter((t) => t.status === "CLOSED").length,
  };
  const tab: Tab = (["overdue", "pending", "inprogress", "completed"].includes(sp.tab || "") ? sp.tab : "all") as Tab;
  const filtered = scoped.filter((t) => {
    if (tab === "overdue") return t.dueAt && t.dueAt < now && t.status !== "CLOSED";
    if (tab === "pending") return t.status === "NEW" || t.status === "ACCEPTED";
    if (tab === "inprogress") return ["IN_PROGRESS", "ON_HOLD", "PENDING_REVIEW"].includes(t.status);
    if (tab === "completed") return t.status === "CLOSED";
    return true;
  });

  function tabHref(t: Tab) {
    const qs = new URLSearchParams();
    if (t !== "all") qs.set("tab", t);
    if (scope === "mine") qs.set("scope", "mine");
    if (view !== "tasks") qs.set("view", view);
    const q = qs.toString();
    return `/groups/${id}${q ? `?${q}` : ""}`;
  }
  function scopeHref(s: "all" | "mine") {
    const qs = new URLSearchParams();
    if (tab !== "all") qs.set("tab", tab);
    if (s === "mine") qs.set("scope", "mine");
    if (view !== "tasks") qs.set("view", view);
    const q = qs.toString();
    return `/groups/${id}${q ? `?${q}` : ""}`;
  }
  function viewHref(v: "tasks" | "announcements") {
    const qs = new URLSearchParams();
    if (v !== "tasks") qs.set("view", v);
    const q = qs.toString();
    return `/groups/${id}${q ? `?${q}` : ""}`;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Link href="/groups" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft size={15} /> All groups
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-emerald-100 text-2xl text-emerald-700">👥</div>
          <div>
            <h1 className="text-2xl font-semibold">{group.name}</h1>
            <p className="text-sm text-slate-500">{group.description || "No description"}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(group.createdById === user.id || user.systemRole === "ADMIN" || user.systemRole === "CEO") && (
            <DeactivateGroupButton groupId={group.id} />
          )}
          <NewTaskDialog kpiOptions={kpiOptions} people={memberPeople} selfId={user.id} todaysCounts={{}} groupId={group.id} buttonLabel="Assign Task" templates={templates} />
        </div>
      </div>

      <div className="flex gap-2 border-b border-slate-200">
        <Link
          href={viewHref("tasks")}
          className={cn(
            "px-4 py-2 border-b-2 font-medium text-sm transition-colors",
            view === "tasks"
              ? "border-emerald-600 text-emerald-600 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-700"
          )}
        >
          Tasks
        </Link>
        <Link
          href={viewHref("announcements")}
          className={cn(
            "px-4 py-2 border-b-2 font-medium text-sm transition-colors",
            view === "announcements"
              ? "border-emerald-600 text-emerald-600 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-700"
          )}
        >
          Announcements ({announcements.length})
        </Link>
      </div>

      {view === "tasks" ? (
        <>
          <Card>
            <SectionTitle>Members</SectionTitle>
            <GroupMembers
              groupId={group.id}
              members={memberEmployees.map((m) => ({ id: m.id, name: m.name, role: m.role }))}
              allPeople={allPeople}
              canManage={canManage}
            />
          </Card>

          <Card>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-1 rounded-full bg-slate-100 p-0.5 text-xs">
                <Link href={scopeHref("all")} className={cn("rounded-full px-2.5 py-1 font-medium", scope === "all" ? "bg-white shadow-sm" : "text-slate-500")}>
                  All Task <span className="ml-1 rounded-full bg-slate-200 px-1.5">{tasks.length}</span>
                </Link>
                <Link href={scopeHref("mine")} className={cn("rounded-full px-2.5 py-1 font-medium", scope === "mine" ? "bg-white shadow-sm" : "text-slate-500")}>
                  My Task
                </Link>
              </div>
              <div className="flex flex-wrap gap-1.5 text-xs">
                <Link href={tabHref("overdue")} className={cn("rounded-full px-2.5 py-1 font-medium", tab === "overdue" ? "bg-red-600 text-white" : "bg-red-50 text-red-600")}>OverDue - {counts.overdue}</Link>
                <Link href={tabHref("pending")} className={cn("rounded-full px-2.5 py-1 font-medium", tab === "pending" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600")}>Pending - {counts.pending}</Link>
                <Link href={tabHref("inprogress")} className={cn("rounded-full px-2.5 py-1 font-medium", tab === "inprogress" ? "bg-amber-500 text-white" : "bg-amber-50 text-amber-600")}>In Progress - {counts.inprogress}</Link>
                <Link href={tabHref("completed")} className={cn("rounded-full px-2.5 py-1 font-medium", tab === "completed" ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-600")}>Completed - {counts.completed}</Link>
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-lg font-semibold text-slate-700">No Task Here</p>
                <p className="text-sm text-slate-400">It seems there aren&apos;t any tasks in this list</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filtered.map((t) => {
                  const quad = priorityQuadrant(t.urgent, t.important);
                  const done = t.checklistItems.filter((c) => c.done).length;
                  return (
                    <div key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
                      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-200 text-[11px] font-semibold text-slate-700">
                        {t.assignee.name.split(" ").map((p: string) => p[0]).slice(0, 2).join("").toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <TaskLink taskId={t.id} className="truncate text-sm font-medium text-slate-900 hover:text-blue-600 hover:underline">{t.title}</TaskLink>
                        <div className="text-xs text-slate-500">
                          → {t.assignee.name}
                          {t.kpiTemplate && <> · {t.kpiTemplate.kpiName}</>}
                          {t.dueAt && <> · due {t.dueAt.toLocaleDateString()}</>}
                          {t.checklistItems.length > 0 && <> · ☑ {done}/{t.checklistItems.length}</>}
                        </div>
                      </div>
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_TONE[t.status])}>
                        {TASK_STATUS_LABEL[t.status] ?? t.status}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">{quad}</span>
                      <ExchangeControl taskId={t.id} currentAssigneeId={t.assigneeId} members={memberPeople} />
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </>
      ) : (
        <Card>
          <SectionTitle>Group Announcements</SectionTitle>
          <div className="space-y-4">
            {canManage && (
              <form action={createGroupAnnouncement} className="flex gap-2">
                <input type="hidden" name="groupId" value={group.id} />
                <input
                  name="body"
                  required
                  placeholder="Post an announcement to this group..."
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
                >
                  Post
                </button>
              </form>
            )}

            {announcements.length === 0 ? (
              <p className="text-sm text-slate-400">No announcements yet.</p>
            ) : (
              <div className="space-y-2">
                {announcements.map((ann) => (
                  <div key={ann.id} className="flex items-start justify-between rounded-lg border border-slate-100 bg-slate-50/50 p-3">
                    <div className="space-y-1">
                      <p className="text-sm text-slate-800 whitespace-pre-wrap">{ann.body}</p>
                      <div className="flex items-center gap-1.5 text-xs text-slate-400">
                        <span className="font-medium text-slate-500">{ann.authorName}</span>
                        <span>·</span>
                        <span>{ann.createdAt.toLocaleString()}</span>
                      </div>
                    </div>
                    {(ann.authorId === user.id || canManage) && (
                      <DeleteAnnouncementButton annId={ann.id} groupId={group.id} />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
