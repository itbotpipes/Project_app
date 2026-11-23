import { redirect } from "next/navigation";
import { getCurrentUser, isManagerLike } from "@/lib/auth";
import { loadCompanyDailyWorkSummaries } from "@/lib/dailyWorkSummaryService";
import DailySummaryView from "./DailySummaryView";

export const metadata = {
  title: "Daily Work Summary | TaskFlow",
  description: "Official end-of-day work summaries, productivity tracking and task carry forward",
};

export default async function DailySummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; emp?: string; view?: string; dept?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  let targetDate = new Date();

  if (sp.date) {
    const parts = sp.date.split("-");
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        targetDate = new Date(y, m, d);
      }
    }
  }

  const requestedEmpId = sp.emp || undefined;
  const data = await loadCompanyDailyWorkSummaries(targetDate, user, requestedEmpId);
  const isAdminOrManager =
    user.systemRole === "ADMIN" ||
    user.systemRole === "CEO" ||
    isManagerLike(user.systemRole, user.systemRoleObj);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <DailySummaryView
        data={data}
        currentUserId={user.id}
        isAdminOrManager={isAdminOrManager}
        initialView={sp.view === "department" ? "DEPARTMENT" : sp.view === "individual" ? "INDIVIDUAL" : undefined}
        initialDept={sp.dept || undefined}
      />
    </div>
  );
}
