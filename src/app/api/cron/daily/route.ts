import { NextRequest, NextResponse } from "next/server";
import { runDailyJobs } from "@/lib/jobs/dailyJobs";

/**
 * Production trigger for the daily jobs (carry-forward, etc).
 * In dev, the in-process scheduler (src/instrumentation.ts) runs the same
 * job directly on a timer. On your own server (multiple instances, or you'd
 * rather not rely on the in-process timer), wire an OS cron to hit this
 * once a day instead, e.g.:
 *
 *   0 0 * * *  curl -s "https://ops.yourcompany.com/api/cron/daily?key=$CRON_SECRET"
 *
 * Set CRON_SECRET in your production .env — without it the route is closed.
 */
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  const expected = process.env.CRON_SECRET;
  if (!expected || key !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await runDailyJobs();
  return NextResponse.json(result);
}
