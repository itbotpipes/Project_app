import Link from "next/link";
import { getCurrentUser, isManagerLike, canScoreCompanyWide } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { incrementBand } from "@/lib/constants";
import { monthLabel, recentAverage } from "@/lib/scores";
import { computeStreak, streakBadges, upcomingBirthdays } from "@/lib/gamification";
import { computeAdherence } from "@/lib/adherence";
import { Card, StatCard, SectionTitle, Badge } from "./_components/ui";
import { DualTrendLine } from "./_components/Charts";
import Celebration from "./_components/Celebration";
import RitualBanners from "./_components/RitualBanners";

export default async function Dashboard() {
  const user = await getCurrentUser();
  if (!user) return null; // layout redirects unauthenticated users
  const manager = isManagerLike(user.systemRole);
  const scorer = canScoreCompanyWide(user);

  // My monthly scorecards: final total (manager-approved) vs system auto total
  const myCards = await prisma.monthlyScorecard.findMany({
    where: { employeeId: user.id },
    orderBy: [{ year: "asc" }, { month: "asc" }],
  });
  const trend = myCards.map((c) => ({
    label: monthLabel(c.year, c.month),
    auto: c.autoTotal || null,
    manager: c.total,
  }));
  const latestMine = myCards[myCards.length - 1];
  const effective = latestMine?.total;
  const avg = recentAverage(myCards);
  const band = incrementBand(avg);

  // My tasks
  const [openTasks, dueToday] = await Promise.all([
    prisma.task.count({
      where: { assigneeId: user.id, status: { notIn: ["CLOSED"] } },
    }),
    prisma.task.count({
      where: {
        assigneeId: user.id,
        status: { notIn: ["CLOSED"] },
        dueAt: { lte: endOfToday() },
      },
    }),
  ]);

  // Daily ritual state
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const ritual = await prisma.dailyRitual.findUnique({
    where: { employeeId_date: { employeeId: user.id, date: todayStart } },
  });

  // Plan adherence: what was planned this morning vs what actually got closed today
  const closedTodayTasks = await prisma.task.findMany({
    where: { assigneeId: user.id, status: "CLOSED", completedAt: { gte: todayStart } },
    select: { id: true },
  });
  const adherence = computeAdherence(ritual?.plannedTaskIds ?? null, closedTodayTasks.map((t) => t.id));

  // Streak & badges (from completed tasks)
  const completed = await prisma.task.findMany({
    where: { assigneeId: user.id, completedAt: { not: null } },
    select: { completedAt: true },
  });
  const streak = computeStreak(completed.map((c) => c.completedAt!) as Date[]);
  const badges = streakBadges(streak);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const closedToday = await prisma.task.count({
    where: { assigneeId: user.id, status: "CLOSED", completedAt: { gte: startOfToday } },
  });
  const celebrate = openTasks === 0 && closedToday > 0;

  // Announcements + birthdays
  const announcements = await prisma.announcement.findMany({
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    take: 6,
    include: { author: true },
  });
  const thought = announcements.find((a) => a.kind === "THOUGHT");
  const notices = announcements.filter((a) => a.kind !== "THOUGHT");
  const bdayPeople = await prisma.employee.findMany({
    where: { active: true, birthday: { not: null } },
    select: { name: true, birthday: true },
  });
  const birthdays = upcomingBirthdays(bdayPeople, 21).slice(0, 4);

  // Star of the month — latest period across the company
  const latestPeriod = await prisma.monthlyScorecard.findFirst({
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });
  const starBoard = latestPeriod
    ? await prisma.monthlyScorecard.findMany({
        where: { year: latestPeriod.year, month: latestPeriod.month },
        orderBy: { total: "desc" },
        take: 6,
        include: { employee: { include: { role: true } } },
      })
    : [];

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
          <SectionTitle>
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
