import { NextRequest, NextResponse } from "next/server";
import { runEndOfDayProcess } from "@/lib/dailyWorkSummaryService";

export async function GET(req: NextRequest) {
  return handleCron(req);
}

export async function POST(req: NextRequest) {
  return handleCron(req);
}

async function handleCron(req: NextRequest) {
  // Optional security check with CRON_SECRET if provided in environment
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const searchParams = req.nextUrl.searchParams;
  const secretParam = searchParams.get("secret");

  if (cronSecret && cronSecret !== secretParam && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse optional date parameter YYYY-MM-DD
  const dateParam = searchParams.get("date");
  let targetDate = new Date();
  if (dateParam) {
    const parts = dateParam.split("-");
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        targetDate = new Date(y, m, d);
      }
    }
  }

  const employeeId = searchParams.get("employeeId") || undefined;

  try {
    const result = await runEndOfDayProcess(targetDate, employeeId);
    return NextResponse.json({
      status: "success",
      message: "Daily work summaries generated and tasks carried forward successfully.",
      processedEmployees: result.processedCount,
      date: result.dateKey,
      nextWorkingDay: result.nextWorkingDay,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[cron/daily-summary] Error generating end of day summary:", error);
    return NextResponse.json(
      {
        status: "error",
        error: error?.message || "Failed to generate daily summaries",
      },
      { status: 500 }
    );
  }
}
