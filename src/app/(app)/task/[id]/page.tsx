import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser, isManagerLike } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { priorityQuadrant, TASK_STATUS_LABEL } from "@/lib/constants";
import { Card, Badge } from "../../_components/ui";
import MoveControl from "../../board/MoveControl";
import CommentForm from "./CommentForm";
import Attachments from "./Attachments";
import Reminders from "./Reminders";

export default async function TaskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return null;

  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      creator: true,
      assignee: true,
      reviewer: true,
      kpiTemplate: true,
      project: true,
      comments: { include: { author: true }, orderBy: { createdAt: "asc" } },
      attachments: { orderBy: { createdAt: "desc" } },
      reminders: { orderBy: { remindAt: "asc" } },
    },
  });
  if (!task) notFound();

  const allowed =
    isManagerLike(user.systemRole) ||
    [task.creatorId, task.assigneeId, task.reviewerId].includes(user.id);
  if (!allowed) notFound();

  const quad = priorityQuadrant(task.urgent, task.important);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/board" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft size={15} /> Back to board
      </Link>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">{task.title}</h1>
            {task.description && <p className="mt-1 text-sm text-slate-600">{task.description}</p>}
          </div>
          <Badge className="bg-slate-100 text-slate-700">{TASK_STATUS_LABEL[task.status] ?? task.status}</Badge>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <Badge className="bg-blue-100 text-blue-700">{quad}</Badge>
          {task.kpiTemplate && (
            <Badge className="bg-violet-100 text-violet-700">KPI: {task.kpiTemplate.kpiName}</Badge>
          )}
          {task.sizeLabel && <Badge className="bg-slate-100 text-slate-600">{task.sizeLabel.toLowerCase()}</Badge>}
          {task.project && <Badge className="bg-slate-100 text-slate-600">📁 {task.project.name}</Badge>}
          {task.reviewRequired && <Badge className="bg-amber-100 text-amber-700">needs review</Badge>}
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
          <div><dt className="text-slate-400">Assignee</dt><dd className="font-medium">{task.assignee.name}</dd></div>
          <div><dt className="text-slate-400">Created by</dt><dd className="font-medium">{task.creator.name}</dd></div>
          {task.reviewer && <div><dt className="text-slate-400">Reviewer</dt><dd className="font-medium">{task.reviewer.name}</dd></div>}
          {task.estimatedMins != null && <div><dt className="text-slate-400">Estimate</dt><dd className="font-medium">{task.estimatedMins}m</dd></div>}
          {task.dueAt && <div><dt className="text-slate-400">Due</dt><dd className="font-medium">{new Date(task.dueAt).toLocaleString()}</dd></div>}
        </dl>

        {task.status === "ON_HOLD" && task.holdReason && (
          <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">On hold: {task.holdReason}</div>
        )}

        <div className="mt-4 max-w-xs">
          <MoveControl taskId={task.id} status={task.status} />
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Reminders
        </h2>
        <Reminders
          taskId={task.id}
          reminders={task.reminders.map((r) => ({ id: r.id, remindAt: r.remindAt.toISOString(), sent: r.sent }))}
        />
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Attachments &amp; voice notes
        </h2>
        <Attachments taskId={task.id} />
        {task.attachments.length > 0 && (
          <ul className="mt-4 space-y-2">
            {task.attachments.map((a) => (
              <li key={a.id} className="rounded-lg border border-slate-200 p-2">
                {a.kind === "VOICE" ? (
                  <div>
                    <div className="mb-1 text-xs text-slate-500">🎤 Voice note</div>
                    {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                    <audio controls src={a.url} className="w-full" />
                  </div>
                ) : a.kind === "PHOTO" || /\.(png|jpe?g|gif|webp)$/i.test(a.url) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <a href={a.url} target="_blank" rel="noreferrer">
                    <img src={a.url} alt={a.filename ?? "attachment"} className="max-h-48 rounded" />
                  </a>
                ) : (
                  <a href={a.url} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline">
                    📎 {a.filename ?? a.url}
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Comments ({task.comments.length})
        </h2>
        <div className="mb-4 space-y-3">
          {task.comments.map((c) => (
            <div key={c.id} className="flex gap-3">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
                {c.author.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="text-sm">
                  <span className="font-medium">{c.author.name}</span>{" "}
                  <span className="text-xs text-slate-400">{new Date(c.createdAt).toLocaleString()}</span>
                </div>
                <p className="text-sm text-slate-700">{c.body}</p>
              </div>
            </div>
          ))}
          {!task.comments.length && <p className="text-sm text-slate-400">No comments yet.</p>}
        </div>
        <CommentForm taskId={task.id} />
      </Card>
    </div>
  );
}
