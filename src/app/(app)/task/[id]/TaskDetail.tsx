import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { loadTaskDetailData } from "@/lib/taskDetail";
import TaskFields from "./TaskFields";

export default async function TaskDetail({ id }: { id: string }) {
  const user = await getCurrentUser();
  if (!user) return null;

  const data = await loadTaskDetailData(id, user);
  if (!data) notFound();

  return <TaskFields data={data} />;
}
