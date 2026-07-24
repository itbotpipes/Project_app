import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import TaskDetail from "./TaskDetail";

export default async function TaskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/board" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft size={15} /> Back to board
      </Link>
      <TaskDetail id={id} />
    </div>
  );
}
