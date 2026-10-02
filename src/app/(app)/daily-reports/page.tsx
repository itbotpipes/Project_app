import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { loadCompanyDailyReport } from "@/lib/dailyReportService";
import DailyReportsView from "./DailyReportsView";

export default async function DailyReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  let targetDate = new Date();

  if (sp.date) {
    const parts = sp.date.split("-");
    if (parts.length >= 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        targetDate = new Date(y, m, d);
      }
    }
  }

  const summary = await loadCompanyDailyReport(targetDate, user);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <DailyReportsView summary={summary} />
    </div>
  );
}
