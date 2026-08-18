import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { loadTaskDetailData } from "@/lib/taskDetail";
import { adminDb } from "@/lib/firebase/admin";
import TaskFields from "./TaskFields";

export default async function TaskDetail({ id }: { id: string }) {
  const user = await getCurrentUser();
  if (!user) return null;

  // Check if the task is deleted first — redirect to /board instead of 404
  const taskDoc = await adminDb.collection("Task").doc(id).get();
  if (taskDoc.exists && taskDoc.data()?.deletedAt) {
    redirect("/board");
  }

  const data = await loadTaskDetailData(id, user);
  if (!data) notFound();

  return <TaskFields data={data} />;
}
