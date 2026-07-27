import Link from "next/link";
import { getCurrentUser, isManagerLike } from "@/lib/auth";
import { adminDb } from "@/lib/firebase/admin";
import { Card } from "../_components/ui";
import CreateGroupDialog from "./CreateGroupDialog";
import { batchFetchByIds, cachedFetch, fetchAllDepartments } from "@/lib/cache";

export default async function GroupsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [groupsSnap, departmentsMap, peopleSnap] = await Promise.all([
    adminDb.collection("Group").get(),
    fetchAllDepartments(adminDb),
    cachedFetch(
      'active-employees',
      () => adminDb.collection("Employee").where("active", "==", true).get(),
      300 // cache for 5 minutes
    ),
  ]);

  const departments = departmentsMap.docs ? departmentsMap.docs
    .map((d: any) => {
      const data = d.data();
      const serialized: any = { id: d.id };
      for (const [key, value] of Object.entries(data)) {
        if (value && typeof value === 'object' && 'toDate' in value) {
          serialized[key] = (value as any).toDate();
        } else {
          serialized[key] = value;
        }
      }
      return serialized;
    })
    .sort((a: any, b: any) => a.name.localeCompare(b.name)) : [];
  const people = peopleSnap.docs
    .map((d) => ({ id: d.id, name: d.data().name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Batch fetch all group members and departments
  const groupIds = groupsSnap.docs ? groupsSnap.docs.map((d: any) => d.id) : [];
  const deptIds = groupsSnap.docs ? groupsSnap.docs.map((d: any) => d.data().departmentId).filter(Boolean) as string[] : [];
  
  const [membersSnap, departmentsById] = await Promise.all([
    groupIds.length > 0 ? adminDb.collection("GroupMember").where("groupId", "in", groupIds).get() : Promise.resolve({ docs: [] } as any),
    batchFetchByIds('Department', deptIds, adminDb),
  ]);
  
  // Group members by group ID
  const membersByGroup = new Map<string, any[]>();
  membersSnap.docs?.forEach((m: any) => {
    const groupId = m.data().groupId;
    if (!membersByGroup.has(groupId)) membersByGroup.set(groupId, []);
    membersByGroup.get(groupId)!.push({ employeeId: m.data().employeeId });
  });
  
  // Batch fetch task counts for all groups
  const taskCountsByGroup = new Map<string, { open: number; done: number }>();
  if (groupIds.length > 0) {
    const [openTasksSnap, doneTasksSnap] = await Promise.all([
      adminDb.collection("Task").where("groupId", "in", groupIds).where("deletedAt", "==", null).where("status", "!=", "CLOSED").get(),
      adminDb.collection("Task").where("groupId", "in", groupIds).where("deletedAt", "==", null).where("status", "==", "CLOSED").get(),
    ]);
    
    openTasksSnap.docs?.forEach((t: any) => {
      const groupId = t.data().groupId;
      if (groupId) {
        const cur = taskCountsByGroup.get(groupId) ?? { open: 0, done: 0 };
        cur.open++;
        taskCountsByGroup.set(groupId, cur);
      }
    });
    
    doneTasksSnap.docs?.forEach((t: any) => {
      const groupId = t.data().groupId;
      if (groupId) {
        const cur = taskCountsByGroup.get(groupId) ?? { open: 0, done: 0 };
        cur.done++;
        taskCountsByGroup.set(groupId, cur);
      }
    });
  }

  // Sort groups alphabetically in JS
  const groups = groupsSnap.docs ? groupsSnap.docs.map((doc) => {
    const g = doc.data() as any;
    // Serialize Group data timestamps
    const serializedGroup: any = {};
    for (const [key, value] of Object.entries(g)) {
      if (value && typeof value === 'object' && 'toDate' in value) {
        serializedGroup[key] = (value as any).toDate();
      } else {
        serializedGroup[key] = value;
      }
    }
    
    const department = serializedGroup.departmentId ? (departmentsById.get(serializedGroup.departmentId) as any) : null;
    const counts = taskCountsByGroup.get(doc.id) ?? { open: 0, done: 0 };
    const members = membersByGroup.get(doc.id) ?? [];

    return {
      id: doc.id,
      name: serializedGroup.name,
      description: serializedGroup.description ?? null,
      departmentId: serializedGroup.departmentId,
      members,
      openCount: counts.open,
      doneCount: counts.done,
      department: department ? { name: department.name } : null,
    };
  }).sort((a, b) => a.name.localeCompare(b.name)) : [];

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Groups</h1>
          <p className="text-sm text-slate-500">
            Departmental teams — post tasks to a group and members exchange them freely.
          </p>
        </div>
        {isManagerLike(user.systemRole) && <CreateGroupDialog departments={departments} people={people} />}
      </div>

      {groups.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-400">
            No groups yet. {isManagerLike(user.systemRole) ? "Create one with the + button above." : "Ask a manager to create one."}
          </p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => (
            <Link key={g.id} href={`/groups/${g.id}`}>
              <Card className="h-full transition hover:border-emerald-300 hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700">👥</div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 font-medium text-blue-700">{g.openCount} open</span>
                    {g.doneCount > 0 && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700">{g.doneCount} done</span>
                    )}
                  </div>
                </div>
                <h2 className="mt-3 text-base font-semibold text-slate-900">{g.name}</h2>
                {g.description && <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{g.description}</p>}
                <p className="mt-3 text-xs text-slate-400">
                  {g.members.length} member{g.members.length === 1 ? "" : "s"}
                  {g.department && <> · {g.department.name}</>}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
