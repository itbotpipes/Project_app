import { redirect } from "next/navigation";
import { getCurrentUser, canScoreCompanyWide } from "@/lib/auth";
import { adminDb } from "@/lib/firebase/admin";
import { Card, SectionTitle } from "../_components/ui";
import ThoughtEditor from "./ThoughtEditor";
import AnnouncementList from "./AnnouncementList";
import { batchFetchByIds } from "@/lib/cache";

export default async function AnnouncementsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!canScoreCompanyWide(user)) redirect("/"); // admin, CEO, HR only

  const snap = await adminDb.collection("Announcement").get();
  if (snap.docs) {
    snap.docs.sort((a, b) => {
      const pd = (b.data().pinned ? 1 : 0) - (a.data().pinned ? 1 : 0);
      if (pd !== 0) return pd;
      const at = a.data().createdAt?.toDate?.() ?? new Date(0);
      const bt = b.data().createdAt?.toDate?.() ?? new Date(0);
      return bt.getTime() - at.getTime();
    });
  }
  
  // Batch fetch all authors
  const authorIds = snap.docs ? snap.docs.map((d: any) => d.data().authorId).filter(Boolean) as string[] : [];
  const authorsMap = await batchFetchByIds('Employee', authorIds, adminDb);
  
  const all = snap.docs ? snap.docs.map((doc: any) => {
    const d = doc.data() as any;
    const author = d.authorId ? (authorsMap.get(d.authorId) as any) : null;
    const createdAt = d.createdAt?.toDate ? d.createdAt.toDate() : new Date(d.createdAt);
    return { id: doc.id, kind: d.kind, pinned: d.pinned, title: d.title ?? null, body: d.body, author: author ? { name: author.name } : null, createdAt };
  }) : [];
  const thought = all.find((a) => a.kind === "THOUGHT");
  const notices = all.filter((a) => a.kind !== "THOUGHT");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Announcements &amp; Thought of the Day</h1>
        <p className="text-sm text-slate-500">
          Posted to everyone&apos;s dashboard. Editable by Admin, CEO and HR.
        </p>
      </div>

      <Card>
        <SectionTitle>💭 Thought of the day</SectionTitle>
        <ThoughtEditor initial={thought?.body ?? ""} />
      </Card>

      <Card>
        <SectionTitle>📌 Announcement board</SectionTitle>
        <AnnouncementList
          notes={notices.map((n) => ({
            id: n.id,
            title: n.title,
            body: n.body,
            author: n.author?.name ?? null,
            createdAt: n.createdAt.toISOString(),
          }))}
        />
      </Card>
    </div>
  );
}
