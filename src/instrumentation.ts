/**
 * Runs once when the Next.js server boots (App Router convention).
 * We use it to start a lightweight in-process daily-jobs scheduler, so the
 * app "just works" on a single self-hosted server with zero extra infra
 * (no separate cron daemon, no Redis queue required).
 *
 * For a multi-instance / production deployment, prefer wiring an OS cron to
 * GET /api/cron/daily?key=$CRON_SECRET once a day instead — see that route.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Avoid double-starting when Next's dev server re-registers on hot reload.
  const g = globalThis as unknown as { __opsScheduler?: boolean };
  if (g.__opsScheduler) return;
  g.__opsScheduler = true;

  const { runDailyJobs } = await import("@/lib/jobs/dailyJobs");

  let lastRunDay = "";
  const tick = async () => {
    const today = new Date().toISOString().slice(0, 10);
    if (today === lastRunDay) return;
    lastRunDay = today;
    try {
      const result = await runDailyJobs();
      console.log(`[scheduler] daily jobs ran: ${result.carried} task(s) carried forward`);
    } catch (err) {
      console.error("[scheduler] daily jobs failed:", err);
    }
  };

  // Run once shortly after boot (covers "server restarted mid-day" and dev),
  // then check every 15 minutes — cheap, and only actually runs once a day.
  setTimeout(tick, 5_000);
  setInterval(tick, 15 * 60 * 1000);
}
