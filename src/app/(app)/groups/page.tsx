import Link from "next/link";
import { getCurrentUser, isManagerLike } from "@/lib/auth";
import { adminDb } from "@/lib/firebase/admin";
import { Card } from "../_components/ui";
import CreateGroupDialog from "./CreateGroupDialog";

export default async function GroupsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [groupsSnap, departmentsSnap, peopleSnap] = await Promise.all([
    adminDb.collection("Group").get(),
    adminDb.collection("Department").get(),
    adminDb.collection("Employee").where("active", "==", true).get(),
  ]);

  const departments = departmentsSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a: any, b: any) => a.name.localeCompare(b.name)) as any[];
  const people = peopleSnap.docs
    .map((d) => ({ id: d.id, name: d.data().name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Sort groups alphabetically in JS
  const groups = (await Promise.all(
    groupsSnap.docs.map(async (doc) => {
      const g = doc.data() as any;
      const [membersSnap, openTasksSnap, doneTasksSnap, deptDoc] = await Promise.all([
        adminDb.collection("GroupMember").where("groupId", "==", doc.id).get(),
        adminDb.collection("Task").where("groupId", "==", doc.id).where("deletedAt", "==", null).where("status", "!=", "CLOSED").get(),
        adminDb.collection("Task").where("groupId", "==", doc.id).where("deletedAt", "==", null).where("status", "==", "CLOSED").get(),
        g.departmentId ? adminDb.collection("Department").doc(g.departmentId).get() : Promise.resolve(null),
      ]);
      return {
        id: doc.id,
        name: g.name,
        description: g.description ?? null,
        departmentId: g.departmentId,
        members: membersSnap.docs.map((m) => ({ employeeId: m.data().employeeId })),
        openCount: openTasksSnap.size,
        doneCount: doneTasksSnap.size,
        department: deptDoc?.exists ? { name: deptDoc.data()!.name } : null,
      };
    })
  )).sort((a, b) => a.name.localeCompare(b.name));

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
