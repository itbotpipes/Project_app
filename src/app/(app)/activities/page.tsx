import { getCurrentUser, isManagerLike } from "@/lib/auth";
import { adminDb } from "@/lib/firebase/admin";
import { relativeTime } from "@/lib/date";
import { Card, SectionTitle } from "../_components/ui";

const ACTION_ICON: Record<string, string> = {
  "task.create": "🆕",
  "task.move": "↪️",
  "task.delete": "🗑️",
  "task.restore": "♻️",
  "task.exchange": "🔁",
  "task.fromTemplate": "📄",
  "group.create": "👥",
  "behaviour.save": "✍️",
};

function actionLabel(action: string) {
  const map: Record<string, string> = {
    "task.create": "created a task",
    "task.move": "moved a task",
    "task.delete": "deleted a task",
    "task.restore": "restored a task",
    "task.exchange": "exchanged a task",
    "task.fromTemplate": "used a template",
    "group.create": "created a group",
    "behaviour.save": "saved a behaviour review",
  };
  return map[action] ?? action;
}

export default async function ActivitiesPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  let logsSnap;
  if (isManagerLike(user.systemRole)) {
    logsSnap = await adminDb.collection("AuditLog").get();
  } else {
    logsSnap = await adminDb.collection("AuditLog").where("actorId", "==", user.id).get();
  }
  logsSnap.docs.sort((a: any, b: any) => (b.data().createdAt?.toMillis?.() ?? 0) - (a.data().createdAt?.toMillis?.() ?? 0));
  logsSnap.docs.splice(100);
  const actorCache = new Map<string, string>();
  const logs = await Promise.all(
    logsSnap.docs.map(async (doc) => {
      const d = doc.data() as any;
      let actorName = "System";
      if (d.actorId) {
        if (actorCache.has(d.actorId)) {
          actorName = actorCache.get(d.actorId)!;
        } else {
          const emp = await adminDb.collection("Employee").doc(d.actorId).get();
          actorName = emp.exists ? emp.data()!.name : "Unknown";
          actorCache.set(d.actorId, actorName);
        }
      }
      const ts = d.createdAt?.toDate ? d.createdAt.toDate() : new Date(d.createdAt);
      return { id: doc.id, action: d.action, detail: d.detail, actor: d.actorId ? { name: actorName } : null, createdAt: ts };
    })
  );

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Activities</h1>
        <p className="text-sm text-slate-500">
          {isManagerLike(user.systemRole) ? "Everything happening across TaskFlow." : "Your recent actions."}
        </p>
      </div>

      <Card>
        <SectionTitle>Recent</SectionTitle>
        {logs.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">No activity yet.</p>
        ) : (
          <ul className="space-y-2.5">
            {logs.map((l) => (
              <li key={l.id} className="flex items-start gap-2.5 text-sm">
                <span className="shrink-0 text-base leading-none">{ACTION_ICON[l.action] ?? "•"}</span>
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-slate-800">{l.actor?.name ?? "System"}</span>{" "}
                  <span className="text-slate-500">{actionLabel(l.action)}</span>
                  {l.detail && <span className="text-slate-400"> — {l.detail}</span>}
                </div>
                <span className="shrink-0 text-[11px] text-slate-400">{relativeTime(l.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
