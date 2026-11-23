"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, isManagerLike } from "@/lib/auth";
import { runEndOfDayProcess } from "@/lib/dailyWorkSummaryService";

export async function triggerEndOfDaySummaryAction(params?: {
  date?: string;
  employeeId?: string;
}) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "Unauthorized. Please sign in." };
  }

  const isMgr = isManagerLike(user.systemRole, user.systemRoleObj);
  const isAdmin = user.systemRole === "ADMIN" || user.systemRole === "CEO";

  // Target date parsing
  let targetDate = new Date();
  if (params?.date) {
    const parts = params.date.split("-");
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        targetDate = new Date(y, m, d);
      }
    }
  }

  // Non-managers can only trigger for themselves
  let targetEmpId = params?.employeeId;
  if (!isAdmin && !isMgr) {
    targetEmpId = user.id;
  }

  try {
    const result = await runEndOfDayProcess(targetDate, targetEmpId);
    revalidatePath("/daily-summary");
    return {
      success: true,
      processedCount: result.processedCount,
      dateKey: result.dateKey,
      nextWorkingDay: result.nextWorkingDay,
    };
  } catch (error: any) {
    console.error("Failed to run end of day summary:", error);
    return {
      success: false,
      error: error?.message || "Failed to execute end-of-day summary process.",
    };
  }
}
