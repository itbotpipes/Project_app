import { redirect } from "next/navigation";
import { getCurrentUser, canScoreCompanyWide } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, SectionTitle } from "../_components/ui";
import ThoughtEditor from "./ThoughtEditor";
import AnnouncementList from "./AnnouncementList";

export default async function AnnouncementsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!canScoreCompanyWide(user)) redirect("/"); // admin, CEO, HR only

  const all = await prisma.announcement.findMany({
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    include: { author: true },
  });
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
