# Northern Star — Operations App (webapp)

Internal task, KPI and performance-management app. Built with **Next.js 16 (React 19, TypeScript) + Prisma + SQLite (dev)**, self-hostable on your own server with PostgreSQL.

This is **Phase 0–1** of the plan in `../docs/` — the foundation plus the two daily-use tools and the performance engine.

## Run it (development)

Node.js is installed locally at `~/.local/node` (nothing system-wide was changed). Two ways to start:

```bash
# easiest — uses the helper script
./run-dev.sh

# or manually
export PATH="$HOME/.local/node/bin:$PATH"
npm run dev
```

Then open **http://localhost:3000**.

### Log in
Any seeded employee works; password is `password123`. Emails are firstname@nse.local
(firstname.lastname@ if two people would otherwise collide, e.g. `kishan.dhabi@` the GM
vs `kishan@` the Design executive).

| Login | Role | Good for seeing |
|---|---|---|
| `director@nse.local` | CEO/Director (admin) | Everything — Admin, Directory, Leaderboard, company-wide Scoring Panel |
| `cherry@nse.local` | COO | GM + all department heads reporting up to her |
| `kishan.dhabi@nse.local` | GM | The 7 department heads reporting to him; scores his own reports |
| `chaitali@nse.local` | HR Manager | Company-wide **Scoring Panel** access (HR can score anyone) |
| `fenil@nse.local` | Project Manager | Team view + scoring his 9 project engineers |
| `yashpal@nse.local` | Project Engineer | Ordinary employee view: board, performance, org chart |

Full org chart (24 people) is under **Org Chart** in the sidebar once logged in.
Note: Store Manager and Site Supervisor are seeded as *roles* with no one assigned yet
— add them via **Admin → Add employee** once you have the names.

## What's built

- **Auth** — company-only login (no public signup), signed session cookie, role-based access (ADMIN/CEO/MANAGER/EMPLOYEE).
- **Dashboard** — your open tasks, due today, latest score, increment band, score trend, company star board.
- **My Board** — Kanban (New → Accepted → In Progress → On Hold → Pending Review → Closed), every task drops into a **KPI bucket**, urgency/importance matrix, size/time, on-hold-reason required, create/assign/move tasks.
- **My Team** (managers) — direct reports with open-task counts + latest scores, and **monthly KRA scoring** that auto-calculates the total out of 100 (replaces the Excel).
- **Field Reports** — mobile-friendly daily site report (site, phase, manpower, material, red flags, TBT, WhatsApp) for the field team who can't log tasks all day.
- **Performance** — score trend, KPI-bucket weightage donut, increment band, promotion-readiness, and team score bars.
- **Directory** (managers) — everyone by department with roles, reporting lines, latest scores.
- **Task detail** — open any task for its comment thread, **file attachments**, and **browser-recorded voice notes** (mic → saved & playable inline).
- **Admin console** (admin/CEO) — add employees (role, reports-to, access level, birthday) and edit **KPI templates & weightages** per role, all in-app — no seed script or developer needed.
- **Gamification** — daily **streaks**, badges (🔥 On a roll, ⭐ Efficient Star, ⚡ Consistency King/Queen), and a celebration banner when you clear all of today's tasks.
- **Announcements** — CEO **Thought of the day**, notices, and **upcoming birthdays** on the dashboard.
- **Weekly Reflection** — the Friday 3-question ritual (what went well / what delayed you / what to improve), with history.
- **Workload Radar** (managers) — per-report open + overdue tasks and Overloaded / Balanced / Underutilized status.
- **Notifications bell** — computed alerts: overdue tasks, tasks awaiting your review, KPI-bucket imbalance, due reminders, and (managers) team members with overdue/stuck work.
- **KPI bucket-balance alarm** — warns on the board when you've worked too few of your role's KPI buckets this month.
- **Daily rituals** — a morning "60-second planning" banner (before 11am) and an evening "update before you leave" banner (after 5pm), each dismissible once per day.
- **Auto carry-forward** — unfinished tasks whose due date has passed automatically roll to today (with a visible "↻ carried N×" badge), so nothing silently falls off the board. Runs via a built-in scheduler — no extra infra needed.
- **Reminders** — set a reminder on any task; it surfaces as an in-app pop-up (and a real browser notification, once you grant permission) plus the notification bell when due.
- **Silent escalation** — a task on hold 48h+ alerts the employee; 96h+ also alerts their manager; 7+ days untouched shows on the Admin "department-head" escalation panel.
- **Org Chart** — the full reporting hierarchy as a simple visual tree (everyone can see it).
- **KPI bucket water-fill** — buckets visually "fill like water" as you add tasks (today/week/month view on the board; a live preview right in the "new task" KPI picker; monthly view on Performance).
- **Manager Score panel** (`/scores`, HR/CEO/Admin company-wide, or any manager for their own reports) — the human "I sat with them and scored them out of 100" number, weekly or monthly, shown **side-by-side with the auto-computed score** everywhere (dashboard, Performance, Team). This is the tool for monthly team review sessions.
- **Delegation** — managers can assign a task to *any* active employee, not just their direct reports; a "↪ delegated by …" badge shows when a task came from outside the normal chain.
- **Plan adherence** — the morning plan is snapshotted; the dashboard shows how many planned tasks got done vs. how many unplanned/ad-hoc tasks took over the day.
- **Department Leaderboard** (`/leaderboard`, admin/CEO) — departments ranked by a Productivity Index (score + completion rate + consistency). Deliberately **not** framed as ₹ ROI — there's no salary/cost data in the system yet, so we don't fabricate a rupee figure; wire that in later once cost data is available.
- **Seed data** — the org exactly as shown on the hierarchy chart (24 people, CEO→COO→GM→7 department heads→their teams), KPI templates per role (+ a Miscellaneous bucket on every role), birthdays, announcements, and a few historical scores carried over with continuity.

## Not in this build (removed per direction)

Field Reports and the Projects (P&L) module were removed from the nav/pages — they'll be rebuilt as separate, dedicated modules later. The underlying `FieldDailyReport`/`Project`/`ProjectExpense` tables are still in the schema (unused for now) so that work isn't lost.

## Project layout

```
prisma/schema.prisma   data model (portable SQLite ⇄ PostgreSQL)
prisma/seed.ts         org + KPI templates + historical scores
src/lib/               db client, auth, constants, server actions
src/app/login/         login
src/app/(app)/         guarded app: dashboard, board, team, field, performance, people
```

## Useful commands

```bash
export PATH="$HOME/.local/node/bin:$PATH"
npm run seed       # reset + reseed the database
npx prisma studio  # visual DB browser
npm run build      # production build
```

## Background jobs (carry-forward etc.)

A built-in scheduler (`src/instrumentation.ts`) starts automatically when the server boots and runs the daily jobs (currently: auto carry-forward of overdue tasks) once every calendar day — no separate cron daemon, Redis, or queue needed for a single-server deployment.

If you'd rather trigger it from the OS instead (e.g. multiple instances), set `CRON_SECRET` in `.env` and point a cron job at:
```
0 0 * * *  curl -s "https://your-domain/api/cron/daily?key=$CRON_SECRET"
```

## Moving to your own server (production)

The stack is chosen to self-host cleanly. Outline (full detail in `../docs/04_Tech_Stack_and_Deployment.md`):

1. In `prisma/schema.prisma`, change `datasource.provider` from `sqlite` to `postgresql`.
2. Set `DATABASE_URL` (in `.env`) to your Postgres connection string, and set a strong `AUTH_SECRET`.
3. `npx prisma migrate deploy` then `npm run seed` (once).
4. `npm run build && npm start`, behind Docker + a reverse proxy on your server.

> Note: this app runs under a normal `next dev` / `next start` (that's what `run-dev.sh` uses). It is not compatible with this environment's "Claude Preview" harness, whose sandboxed worker directory breaks Turbopack's PostCSS step — unrelated to the app itself.
