import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { loadEmployeeTaskReport } from "@/lib/taskReportService";
import TaskReportView from "./TaskReportView";

export default async function EmployeeTaskReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    range?: string;
    date?: string;
    from?: string;
    to?: string;
    year?: string;
    month?: string;
    quarter?: string;
  }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const sp = await searchParams;

  const data = await loadEmployeeTaskReport(id, sp, user);
  if (!data) {
    redirect("/daily-reports");
  }

  return <TaskReportView data={data} />;
}
