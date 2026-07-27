import Link from "next/link";
import { getCurrentUser, isManagerLike, canScoreCompanyWide } from "@/lib/auth";
import { adminDb } from "@/lib/firebase/admin";
import { incrementBand } from "@/lib/constants";
import { monthLabel, recentAverage } from "@/lib/scores";
import { computeStreak, streakBadges, upcomingBirthdays } from "@/lib/gamification";
import { computeAdherence } from "@/lib/adherence";
import { loadDailyTaskAnalysis } from "@/lib/dailyAnalysis";
import { Card, StatCard, SectionTitle, Badge } from "./_components/ui";
import { DualTrendLine } from "./_components/Charts";
import Celebration from "./_components/Celebration";
import RitualBanners from "./_components/RitualBanners";
import ThoughtSocial from "./_components/ThoughtSocial";
import BirthdayWishes from "./_components/BirthdayWishes";
import TaskAnalysisCard from "./_components/TaskAnalysisCard";
import { relativeTime } from "@/lib/date";
import { batchFetchByIds, cachedFetch } from "@/lib/cache";

function toDate(val: any): Date | null {
  if (!val) return null;
  if (val.toDate) return val.toDate();
  return new Date(val);
}

export default async function Dashboard() {
  const user = await getCurrentUser();
  if (!user) return null; // layout redirects unauthenticated users
  const manager = isManagerLike(user.systemRole);
  const scorer = canScoreCompanyWide(user);

  // My monthly scorecards
  const myCardsSnap = await adminDb.collection("MonthlyScorecard").where("employeeId", "==", user.id).get();
  const myCards = myCardsSnap.docs
    .map(d => ({ id: d.id, ...d.data() } as any))
    .sort((a, b) => (a.year - b.year) || (a.month - b.month));
  
  const trend = myCards.map((c) => ({
    label: monthLabel(c.year, c.month),
    auto: c.autoTotal || null,
    manager: c.total,
  }));
  const latestMine = myCards[myCards.length - 1];
  const effective = latestMine?.total;
  const avg = recentAverage(myCards);
  const band = incrementBand(avg);

  // Tasks
  const todayEnd = endOfToday();
  const openTasksSnap = await adminDb.collection("Task").where("assigneeId", "==", user.id).where("status", "!=", "CLOSED").get();
  // Ensure we don't count deleted tasks if we still have a soft delete concept, 
  // but let's assume deleted tasks have status 'CLOSED' or are filtered out.
  // wait, our query earlier had deletedAt == null. Let's filter in memory for deletedAt.
  const activeOpenTasks = openTasksSnap.docs.filter(d => !d.data().deletedAt);
  const openTasks = activeOpenTasks.length;
  
  let dueToday = 0;
  for (const doc of activeOpenTasks) {
    const dueAt = toDate(doc.data().dueAt);
    if (dueAt && dueAt.getTime() <= todayEnd.getTime()) dueToday++;
  }

  // Daily ritual state
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const ritualSnap = await adminDb.collection("DailyRitual").where("employeeId", "==", user.id).where("date", "==", todayStart).get();
  const ritual = ritualSnap.empty ? null : (ritualSnap.docs[0].data() as any);

  // Plan adherence
  const closedTodayTasksSnap = await adminDb.collection("Task").where("assigneeId", "==", user.id).where("status", "==", "CLOSED").get();
  const closedTodayTasks = closedTodayTasksSnap.docs.filter(d => {
    const cAt = toDate(d.data().completedAt);
    return cAt && cAt.getTime() >= todayStart.getTime() && !d.data().deletedAt;
  }).map(d => ({ id: d.id }));
  
  const adherence = computeAdherence(ritual?.plannedTaskIds ?? null, closedTodayTasks.map((t) => t.id));

  // Detailed daily task analysis
  const taskAnalysis = await loadDailyTaskAnalysis(user.id);

  // Streak & badges
  const completedSnap = await adminDb.collection("Task").where("assigneeId", "==", user.id).where("status", "==", "CLOSED").get();
  const completedDates = completedSnap.docs.map(d => toDate(d.data().completedAt)).filter(Boolean) as Date[];
  const streak = computeStreak(completedDates);
  const badges = streakBadges(streak);
  
  const closedTodayCount = closedTodayTasks.length;
  const celebrate = openTasks === 0 && closedTodayCount > 0;

  // Announcements - optimized with batch queries
  const announcementsSnap = await cachedFetch(
    'announcements',
    () => adminDb.collection("Announcement").orderBy("createdAt", "desc").limit(6).get(),
    30 // cache for 30 seconds
  );
  
  const announcementsDocs = announcementsSnap.docs.sort((a, b) => {
    const pd = (b.data().pinned ? 1 : 0) - (a.data().pinned ? 1 : 0);
    if (pd !== 0) return pd;
    const at = a.data().createdAt?.toDate?.() ?? new Date(0);
    const bt = b.data().createdAt?.toDate?.() ?? new Date(0);
    return bt.getTime() - at.getTime();
  }).slice(0, 6);
  
  // Batch fetch all related data
  const authorIds = announcementsDocs.map(d => d.data().authorId).filter(Boolean) as string[];
  const authorsMap = await batchFetchByIds('Employee', authorIds, adminDb);
  
  const announcementIds = announcementsDocs.map(d => d.id);
  const [reactionsSnap, commentsSnap] = await Promise.all([
    adminDb.collection("Reaction").where("announcementId", "in", announcementIds).get(),
    adminDb.collection("Comment").where("announcementId", "in", announcementIds).get(),
  ]);
  
  // Batch fetch comment authors
  const commentEmployeeIds = commentsSnap.docs.map(c => c.data().employeeId).filter(Boolean) as string[];
  const commentAuthorsMap = await batchFetchByIds('Employee', commentEmployeeIds, adminDb);
  
  // Group reactions and comments by announcement
  const reactionsByAnnouncement = new Map<string, any[]>();
  reactionsSnap.docs.forEach(r => {
    const annId = r.data().announcementId;
    if (!reactionsByAnnouncement.has(annId)) reactionsByAnnouncement.set(annId, []);
    reactionsByAnnouncement.get(annId)!.push(r.data());
  });
  
  const commentsByAnnouncement = new Map<string, any[]>();
  commentsSnap.docs.forEach(c => {
    const annId = c.data().announcementId;
    if (!commentsByAnnouncement.has(annId)) commentsByAnnouncement.set(annId, []);
    const cd = c.data();
    const author = commentAuthorsMap.get(cd.employeeId) as any;
    commentsByAnnouncement.get(annId)!.push({
      id: c.id,
      ...cd,
      createdAt: toDate(cd.createdAt),
      employee: { name: author?.name ?? "Unknown" }
    });
  });
  
  // Sort comments within each announcement
  commentsByAnnouncement.forEach(comments => {
    comments.sort((a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0));
  });
  
  const announcements = announcementsDocs.map(doc => {
    const a = doc.data() as any;
    return {
      id: doc.id,
      ...a,
      author: authorsMap.get(a.authorId) || null,
      reactions: reactionsByAnnouncement.get(doc.id) || [],
      comments: commentsByAnnouncement.get(doc.id) || []
    };
  });
  
  const thought = announcements.find((a) => a.kind === "THOUGHT");
  const notices = announcements.filter((a) => a.kind !== "THOUGHT");

  const thoughtReactions = thought
    ? (() => {
        const m = new Map<string, { count: number; mine: boolean }>();
        for (const r of thought.reactions) {
          const e = m.get(r.emoji) ?? { count: 0, mine: false };
          e.count++;
          if (r.employeeId === user.id) e.mine = true;
          m.set(r.emoji, e);
        }
        return [...m.entries()].map(([emoji, v]) => ({ emoji, ...v }));
      })()
    : [];
  const thoughtComments = thought
    ? thought.comments.map((c: any) => ({
        id: c.id,
        author: c.employee.name,
        body: c.body,
        when: relativeTime(c.createdAt),
        canDelete: c.employeeId === user.id || scorer,
      }))
    : [];

  // Birthdays - optimized with caching
  const bdayPeopleSnap = await cachedFetch(
    'active-employees',
    () => adminDb.collection("Employee").where("active", "==", true).get(),
    300 // cache for 5 minutes
  );
  const allPeople = bdayPeopleSnap.docs.map(d => ({ id: d.id, name: d.data().name, birthday: toDate(d.data().birthday) })).sort((a, b) => a.name.localeCompare(b.name));
  const bdayPeople = allPeople.filter(p => p.birthday);
  
  const birthdays = upcomingBirthdays(bdayPeople, 21).slice(0, 4);

  const nowYear2 = new Date().getFullYear();
  const wishTarget = birthdays[0] ?? null;
  
  let wishesRaw: any[] = [];
  if (wishTarget) {
    const wishesSnap = await adminDb.collection("BirthdayWish").where("forId", "==", wishTarget.id).where("year", "==", nowYear2).get();
    wishesSnap.docs.sort((a, b) => (b.data().createdAt?.toDate?.() ?? new Date(0)).getTime() - (a.data().createdAt?.toDate?.() ?? new Date(0)).getTime());
    wishesSnap.docs.splice(12);
    
    // Batch fetch wish authors
    const fromIds = wishesSnap.docs.map(w => w.data().fromId).filter(Boolean) as string[];
    const fromAuthorsMap = await batchFetchByIds('Employee', fromIds, adminDb);
    
    wishesRaw = wishesSnap.docs.map((doc: any) => {
      const w = doc.data() as any;
      const author = fromAuthorsMap.get(w.fromId) as any;
      return { id: doc.id, ...w, createdAt: toDate(w.createdAt), fromEmployee: { name: author?.name ?? "Unknown" } };
    });
  }

  const nameById = new Map(allPeople.map((p) => [p.id, p.name]));
  const wishes = wishesRaw.map((w) => ({
    id: w.id,
    from: w.fromEmployee.name,
    body: w.body,
    tagged: w.taggedIds ? (JSON.parse(w.taggedIds) as string[]).map((id) => nameById.get(id) ?? "") .filter(Boolean) : [],
    when: relativeTime(w.createdAt),
  }));

  // Star of the month - optimized with batch queries
  const allPeriodsSnap = await cachedFetch(
    'all-monthly-scorecards',
    () => adminDb.collection("MonthlyScorecard").orderBy("year", "desc").orderBy("month", "desc").limit(1).get(),
    60 // cache for 1 minute
  );
  const allPeriodDocs = allPeriodsSnap.docs.sort((a, b) => (b.data().year - a.data().year) || (b.data().month - a.data().month));
  const latestPeriod = allPeriodDocs.length === 0 ? null : allPeriodDocs[0].data() as any;
  
  let starBoard: any[] = [];
  if (latestPeriod) {
    const sbSnap = await adminDb.collection("MonthlyScorecard")
      .where("year", "==", latestPeriod.year)
      .where("month", "==", latestPeriod.month)
      .get();
    
    // Sort in Javascript so we don't need a Firebase index!
    const sortedDocs = sbSnap.docs.sort((a, b) => b.data().total - a.data().total).slice(0, 6);

    // Batch fetch employees and roles
    const employeeIds = sortedDocs.map(d => d.data().employeeId);
    const employeesMap = await batchFetchByIds('Employee', employeeIds, adminDb);
    
    const roleIds = Array.from(new Set(
      Object.values(employeesMap)
        .map((e: any) => e.roleId)
        .filter(Boolean)
    )) as string[];
    const rolesMap = await batchFetchByIds('Role', roleIds, adminDb);

    starBoard = sortedDocs.map((doc) => {
      const sb = doc.data() as any;
      const employee = employeesMap.get(sb.employeeId) as any;
      const roleData = employee?.roleId ? (rolesMap.get(employee.roleId) as any) || { title: "Unknown" } : { title: "Unknown" };
      return { id: doc.id, ...sb, employee: { ...employee, role: roleData } };
    });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Good to see you, {user.name.split(" ")[0]} 👋</h1>
          <p className="text-sm text-slate-500">
            {user.role.title}
            {user.role.department ? ` · ${user.role.department.name}` : ""}
          </p>
        </div>
        {(streak > 0 || badges.length > 0) && (
          <div className="flex items-center gap-2">
            {streak > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-3 py-1 text-sm font-semibold text-orange-700">
                🔥 {streak}-day streak
              </span>
            )}
            {badges.map((b) => (
              <span
                key={b.label}
                title={b.label}
                className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-sm font-medium text-amber-700"
              >
                {b.icon} {b.label}
              </span>
            ))}
          </div>
        )}
      </div>

      <RitualBanners
        morningPlanned={ritual?.morningPlanned ?? false}
        eveningClosed={ritual?.eveningClosed ?? false}
        openTaskCount={openTasks}
      />

      {adherence && adherence.plannedCount > 0 && (
        <Card className={adherence.adHocDone > adherence.plannedDone ? "border-amber-200 bg-amber-50/50" : ""}>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-medium text-slate-700">📋 Today vs. this morning&apos;s plan:</span>
            <Badge className="bg-emerald-100 text-emerald-700">
              {adherence.plannedDone}/{adherence.plannedCount} planned done
            </Badge>
            {adherence.plannedPending > 0 && (
              <Badge className="bg-slate-100 text-slate-600">{adherence.plannedPending} still pending</Badge>
            )}
            {adherence.adHocDone > 0 && (
              <Badge className="bg-amber-100 text-amber-700">
                +{adherence.adHocDone} unplanned task{adherence.adHocDone === 1 ? "" : "s"} done instead
              </Badge>
            )}
            {adherence.adHocDone > adherence.plannedDone && (
              <span className="text-xs text-amber-700">
                Your day drifted a lot from the morning plan — worth a look tomorrow.
              </span>
            )}
          </div>
        </Card>
      )}

      {celebrate && <Celebration name={user.name.split(" ")[0]} />}

      <TaskAnalysisCard data={taskAnalysis} />

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Open tasks" value={openTasks} tone="blue" sub="assigned to you" />
        <StatCard label="Due today" value={dueToday} tone={dueToday ? "amber" : "default"} />
        <StatCard
          label="Latest score"
          value={effective != null ? Math.round(effective) : "—"}
          sub={latestMine ? monthLabel(latestMine.year, latestMine.month) : "no score yet"}
          tone="green"
        />
        <StatCard
          label="Increment band"
          value={<span className={band.className}>{band.label}</span>}
          sub={`6-mo avg ${avg.toFixed(0)}`}
        />
      </div>

      {/* Thought of the day + announcements + birthdays */}
      <div className="grid gap-6 lg:grid-cols-3">
        {(thought || scorer) && (
          <Card className="lg:col-span-2 border-blue-100 bg-blue-50/50">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-wide text-blue-500">
                💭 Thought of the day{thought?.author ? ` — ${thought.author.name}` : ""}
              </div>
              {scorer && (
                <Link href="/announcements" className="text-xs font-medium text-blue-600 hover:underline">
                  Edit ✎
                </Link>
              )}
            </div>
            <p className="mt-2 text-sm text-slate-700">
              {thought?.body ?? <span className="text-slate-400">No thought set yet — click Edit to add one.</span>}
            </p>
            {notices.length > 0 && (
              <ul className="mt-4 space-y-2 border-t border-blue-100 pt-3">
                {notices.map((n) => (
                  <li key={n.id} className="text-sm">
                    <span className="mr-1">📌</span>
                    {n.title && <span className="font-medium">{n.title}: </span>}
                    <span className="text-slate-600">{n.body}</span>
                  </li>
                ))}
              </ul>
            )}
            {thought && (
              <ThoughtSocial
                announcementId={thought.id}
                reactions={thoughtReactions}
                comments={thoughtComments}
              />
            )}
          </Card>
        )}
        <Card>
          <SectionTitle>🎂 Upcoming birthdays</SectionTitle>
          <ul className="space-y-2">
            {birthdays.map((b) => (
              <li key={b.name} className="flex items-center justify-between text-sm">
                <span className="font-medium">{b.name}</span>
                <span className="text-slate-500">
                  {b.inDays === 0 ? "Today! 🎉" : b.inDays === 1 ? "Tomorrow" : `in ${b.inDays} days`}
                </span>
              </li>
            ))}
            {!birthdays.length && <li className="text-sm text-slate-400">None in the next 3 weeks.</li>}
          </ul>
          {wishTarget && wishTarget.id && (
            <BirthdayWishes
              target={{ id: wishTarget.id, name: wishTarget.name }}
              inDays={wishTarget.inDays}
              people={allPeople}
              wishes={wishes}
              selfId={user.id}
            />
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Trend */}
        <Card className="lg:col-span-2">
          <SectionTitle
            action={
              <Link href="/performance" className="text-xs font-medium text-blue-600 hover:underline">
                View performance →
              </Link>
            }
          >
            My score trend
          </SectionTitle>
          {trend.length ? (
            <DualTrendLine data={trend} />
          ) : (
            <div className="grid h-[220px] place-items-center text-sm text-slate-400">
              No scores recorded yet.
            </div>
          )}
        </Card>

        {/* Star of month */}
        <Card>
          <SectionTitle
            action={
              <Link href="/leaderboard" className="text-xs font-medium text-blue-600 hover:underline">
                Full leaderboard →
              </Link>
            }
          >
            ⭐ Star board {latestPeriod ? `· ${monthLabel(latestPeriod.year, latestPeriod.month)}` : ""}
          </SectionTitle>
          <ol className="space-y-2">
            {starBoard.map((s, i) => (
              <li key={s.id} className="flex items-center gap-3">
                <span
                  className={
                    "grid h-6 w-6 place-items-center rounded-full text-xs font-bold " +
                    (i === 0
                      ? "bg-amber-100 text-amber-700"
                      : "bg-slate-100 text-slate-500")
                  }
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{s.employee.name}</div>
                  <div className="truncate text-xs text-slate-500">{s.employee.role.title}</div>
                </div>
                <Badge className="bg-slate-100 text-slate-700">{Math.round(s.total)}</Badge>
              </li>
            ))}
            {!starBoard.length && <li className="text-sm text-slate-400">No scores yet.</li>}
          </ol>
        </Card>
      </div>

      {manager && (
        <Card>
          <SectionTitle
            action={
              <Link href="/team" className="text-xs font-medium text-blue-600 hover:underline">
                Open team view →
              </Link>
            }
          >
            Manager quick links
          </SectionTitle>
          <p className="text-sm text-slate-600">
            You can see your team&apos;s tasks and scores under{" "}
            <Link href="/team" className="text-blue-600 hover:underline">
              My Team
            </Link>
            {scorer && (
              <>
                , enter monthly performance scores in the{" "}
                <Link href="/scores" className="text-blue-600 hover:underline">
                  Scoring Panel
                </Link>
              </>
            )}
            , and see the full company under{" "}
            <Link href="/people" className="text-blue-600 hover:underline">
              Directory
            </Link>
            .
          </p>
        </Card>
      )}
    </div>
  );
}

function endOfToday() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}
