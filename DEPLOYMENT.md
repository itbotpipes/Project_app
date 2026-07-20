# TaskFlow — Self-Hosting & Data-Forever Guide

TaskFlow is a single self-contained web app (Next.js server + one database). It needs
**no third-party cloud service** and is designed to run on your own server, behind your
own firewall/VPN. This document answers: *"Will it run on our server, and keep all our
data forever?"* — **yes**, and here's exactly how.

---

## 1. What you need on the server

- A Linux server you control (a small VM or on-prem box is plenty for ~50 users).
- **Node.js 20+**. (During development it's installed at `~/.local/node`; on the server just
  install Node 20 LTS normally.)
- A database — **SQLite** (default, zero-setup) *or* **PostgreSQL** (recommended for the
  company-wide deployment, see §3).
- Keep it internal: put it behind nginx/Caddy + VPN or office network. It is **not** meant
  to be exposed to the public internet.

## 2. First run (build once, then start)

```bash
cd webapp
export PATH="$HOME/.local/node/bin:$PATH"     # only if using the bundled Node
npm install
npx prisma migrate deploy                     # applies all migrations to the DB
npx prisma db seed                            # first time only — loads org + KPIs + history
npm run build                                 # produces the optimized production build
npm run start                                 # serves on http://localhost:3000
```

Run it as a service so it restarts on reboot — e.g. `pm2 start "npm run start" --name taskflow`
or a small `systemd` unit. That's it.

### Required environment variables (`webapp/.env`)
| Variable | Purpose | Notes |
|----------|---------|-------|
| `DATABASE_URL` | Where the data lives | SQLite file path **or** Postgres URL |
| `AUTH_SECRET` | Signs login sessions | **Set a long random value in production** |
| `CRON_SECRET` | Protects `/api/cron/daily` | Only if you use an OS cron (see §5) |
| `ANTHROPIC_API_KEY` | Upgrades the AI coach to real Claude | Optional; heuristics work without it |

## 3. SQLite vs PostgreSQL — pick Postgres for "forever"

Today the app ships on **SQLite** (a single `prisma/dev.db` file) — perfect for development
and small teams, and your data lives as long as that file exists on a persistent disk.

For a **company-wide, keep-every-record-forever** deployment I recommend **PostgreSQL**:
it handles many people writing at once and is the standard for long-lived business data.
The schema is already written to be Postgres-portable, so switching is a config change:

1. In `prisma/schema.prisma`, set the datasource provider:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
2. In `.env`:
   ```
   DATABASE_URL="postgresql://taskflow:PASSWORD@localhost:5432/taskflow"
   ```
3. Apply the schema and seed once:
   ```bash
   npx prisma migrate deploy
   npx prisma db seed
   ```

> Migrating your existing SQLite rows into Postgres is a one-time export/import — ask and
> I'll generate a migration script when you're ready to switch.

## 4. Your data is kept — nothing is hard-deleted

History that matters for increments and audits is **append-only / archived**, never
destroyed by the app:

- **Monthly scorecards & per-KPI scores** (`MonthlyScorecard`, `MonthlyScore`) — one row per
  employee per month, kept for every month, forever. The Performance page shows the full
  journey.
- **Behaviour reviews** (`BehaviourReview`) — one row per employee per month.
- **Audit log** (`AuditLog`) — every score save, behaviour save, and carry-forward is logged.
- Employees are **deactivated** (`active = false`), not deleted, so their history stays intact.

As long as the database (and your backups) survive, the records survive.

## 5. Keeping the daily/monthly automation running

The app has a built-in in-process scheduler (`src/instrumentation.ts`) that runs the daily
jobs — task carry-forward, and on the 1st–7th it materializes the previous month's **auto
scorecards** so everyone sees their chart before managers finalize by the 5th. It "just
works" as long as the app process is running.

For a more robust setup, also wire an OS cron to hit the endpoint once a day:
```
0 1 * * *  curl -s "http://localhost:3000/api/cron/daily?key=$CRON_SECRET"
```

## 6. Backups — this is how "forever" actually happens

The app preserves data; **you** preserve the database. Set a nightly backup:

**SQLite:**
```bash
# nightly copy of the DB file + uploaded files
cp webapp/prisma/dev.db  /backups/taskflow-$(date +%F).db
tar czf /backups/uploads-$(date +%F).tgz webapp/public/uploads
```

**PostgreSQL:**
```bash
pg_dump taskflow | gzip > /backups/taskflow-$(date +%F).sql.gz
```

Keep backups on a second disk / offsite. That's the real guarantee that old data lives
forever, regardless of server changes.

## 7. Uploaded files

Task attachments and voice notes are stored under `webapp/public/uploads`. Keep that folder
on the same persistent volume and include it in backups. (For a larger deployment this can
later move to MinIO/S3 — noted as a future enhancement.)

---

### TL;DR
Build once, run as a service, point `DATABASE_URL` at Postgres on your server, and set a
nightly backup. The app never hard-deletes historical scores, so your KPI/performance
history accumulates month over month, indefinitely.
