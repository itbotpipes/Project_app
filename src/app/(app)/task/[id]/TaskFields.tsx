import Link from "next/link";
import { TASK_STATUS_LABEL } from "@/lib/constants";
import { relativeTime } from "@/lib/date";
import type { TaskDetailData } from "@/lib/taskDetail";
import { Card, Badge } from "../../_components/ui";
import Avatar from "../../_components/Avatar";
import MoveControl from "../../board/MoveControl";
import CommentForm from "./CommentForm";
import Attachments from "./Attachments";
import Reminders from "./Reminders";
import Checklist from "./Checklist";
import DeleteAttachmentButton from "./DeleteAttachmentButton";
import WatchButton from "./WatchButton";
import DeleteTaskButton from "./DeleteTaskButton";
import EditTaskDialog from "./EditTaskDialog";
import QuickActions from "./QuickActions";
import CommentItem from "./CommentItem";
import TaskTimer from "./TaskTimer";

const STATUS_DOT: Record<string, string> = {
  NEW: "bg-slate-400",
  ACCEPTED: "bg-sky-400",
  IN_PROGRESS: "bg-blue-500",
  ON_HOLD: "bg-amber-400",
  PENDING_REVIEW: "bg-violet-500",
  CLOSED: "bg-emerald-500",
  REOPENED: "bg-red-500",
};

const ACTIVITY_LABEL: Record<string, string> = {
  "task.create": "created this task",
  "task.move": "moved this task",
  "task.reject": "sent this back for rework",
  "task.edit": "edited this task",
  "task.exchange": "exchanged this task",
  "task.delete": "deleted this task",
  "task.restore": "restored this task",
};

/**
 * Pure presentational — no data fetching of its own. Fed by either the
 * server-rendered `/task/[id]` page or the client-side drawer (which fetches
 * the same shape from `/api/tasks/[id]`), so both render identically.
 */
export default function TaskFields({ data: task }: { data: NonNullable<TaskDetailData> }) {
  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">{task.title}</h1>
            {task.description && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{task.description}</p>}
          </div>
          <div className="flex items-center gap-2">
            <WatchButton taskId={task.id} initiallyWatching={task.isWatching} />
            {task.canDelete && <DeleteTaskButton taskId={task.id} />}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {task.kpiTemplate && <Badge className="bg-violet-100 text-violet-700">KPI: {task.kpiTemplate.kpiName}</Badge>}
          {task.sizeLabel && <Badge className="bg-slate-100 text-slate-600">{task.sizeLabel.toLowerCase()}</Badge>}
          {task.project && <Badge className="bg-slate-100 text-slate-600">📁 {task.project.name}</Badge>}
          {task.group && (
            <Link href={`/groups/${task.group.id}`}>
              <Badge className="bg-emerald-100 text-emerald-700">👥 {task.group.name}</Badge>
            </Link>
          )}
          {task.reviewRequired && <Badge className="bg-amber-100 text-amber-700">needs review</Badge>}
          {task.reworkCount > 0 && <Badge className="bg-red-100 text-red-700">↩ reworked {task.reworkCount}×</Badge>}
        </div>

        {/* Field grid — matches the reference layout */}
        <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Assigned To</dt>
            <dd className="mt-1 flex items-center gap-2">
              <Avatar name={task.assignee?.name ?? "Unknown"} url={task.assignee?.avatarUrl} size={26} />
              <span className="font-medium">{task.assignee?.name ?? "Unknown"}</span>
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Assigned By</dt>
            <dd className="mt-1 flex items-center gap-2">
              <Avatar name={task.creator?.name ?? "Unknown"} url={task.creator?.avatarUrl} size={26} />
              <span className="font-medium">{task.creator?.name ?? "Unknown"}</span>
            </dd>
          </div>

          {task.watchers.length > 0 && (
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-400">Subscribers</dt>
              <dd className="mt-1 flex items-center">
                {task.watchers.map((w: any, i: number) => (
                  <span key={w.id} style={{ marginLeft: i === 0 ? 0 : -8, zIndex: 10 - i }} className="relative">
                    <Avatar name={w.employee?.name ?? "Unknown"} url={w.employee?.avatarUrl} size={26} className="ring-2 ring-white" />
                  </span>
                ))}
                <span className="ml-2 text-xs text-slate-400">
                  {task.watchers.map((w: any) => w.employee?.name ?? "Unknown").join(", ")}
                </span>
              </dd>
            </div>
          )}

          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Created At</dt>
            <dd className="mt-1 font-medium">
              {task.createdAt ? new Date(task.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : "—"}
            </dd>
          </div>

          {task.dueAt && (
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-400">Due Date</dt>
              <dd className="mt-1 flex items-center gap-1.5 font-medium text-emerald-700">
                🕐 {new Date(task.dueAt).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })}
              </dd>
            </div>
          )}

          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Status</dt>
            <dd className="mt-1 flex items-center gap-1.5 font-medium">
              <span className={`h-2 w-2 rounded-full ${STATUS_DOT[task.status] ?? "bg-slate-300"}`} />
              {TASK_STATUS_LABEL[task.status] ?? task.status}
            </dd>
          </div>

          {task.category && (
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-400">Category</dt>
              <dd className="mt-1 font-medium">{task.category}</dd>
            </div>
          )}

          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Priority</dt>
            <dd className={`mt-1 flex items-center gap-1.5 font-medium ${task.priority.tone}`}>
              {task.priority.flag} {task.priority.label}
            </dd>
          </div>

          {task.reviewer && (
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-400">Reviewer</dt>
              <dd className="mt-1 font-medium">{task.reviewer.name}</dd>
            </div>
          )}
          {task.estimatedMins != null && (
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-400">Estimate</dt>
              <dd className="mt-1 font-medium">{task.estimatedMins}m</dd>
            </div>
          )}
        </dl>

        <div className="mt-5 border-t border-slate-100 pt-4">
          <TaskTimer
            status={task.status}
            lastStatusChange={task.lastStatusChange}
            statusDurations={task.statusDurations}
          />
        </div>

        {task.status === "ON_HOLD" && task.holdReason && (
          <div className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">On hold: {task.holdReason}</div>
        )}
        {task.status === "REOPENED" && task.rejectionReason && (
          <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            ↩️ Sent back for rework{task.reworkCount > 1 ? ` (${task.reworkCount}x)` : ""}: {task.rejectionReason}
          </div>
        )}

        {/* Quick action row */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <QuickActions taskId={task.id} status={task.status} />
          <div className="flex items-center gap-2">
            {task.canEdit && (
              <EditTaskDialog
                taskId={task.id}
                title={task.title}
                description={task.description}
                category={task.category}
                sizeLabel={task.sizeLabel}
                dueAt={task.dueAtLocalValue}
                urgent={task.urgent}
                important={task.important}
                kpiTemplateId={task.kpiTemplateId}
                kpiOptions={task.kpiOptions}
              />
            )}
            <div className="w-48">
              <MoveControl taskId={task.id} status={task.status} />
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Checklist</h2>
        <Checklist taskId={task.id} items={task.checklistItems} />
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Reminders</h2>
        <Reminders taskId={task.id} reminders={task.reminders as any} />
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Attachments &amp; voice notes</h2>
        <Attachments taskId={task.id} />
        {task.attachments.length > 0 && (
          <ul className="mt-4 space-y-2">
            {task.attachments.map((a: any) => (
              <li key={a.id} className="flex items-start justify-between gap-2 rounded-lg border border-slate-200 p-2">
                <div className="min-w-0 flex-1">
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
                    <a href={a.url} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline truncate max-w-full">
                      📎 {a.filename ?? a.url}
                    </a>
                  )}
                </div>
                <DeleteAttachmentButton attachmentId={a.id} taskId={task.id} filename={a.filename || "attachment"} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="scroll-mt-4" id="comment-box">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Comments ({task.commentsCount ?? 0})</h2>
        <div className="mb-4 space-y-4">
          {task.comments.map((c: any) => (
            <CommentItem key={c.id} comment={c} taskId={task.id} />
          ))}
          {!task.comments.length && <p className="text-sm text-slate-400">No comments yet.</p>}
        </div>
        <CommentForm taskId={task.id} />
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Task Updates</h2>
        {task.activity.length ? (
          <ul className="space-y-2.5">
            {task.activity.map((a: any) => (
              <li key={a.id} className="flex items-start gap-2.5 text-sm">
                <Avatar name={a.actor?.name ?? "System"} url={a.actor?.avatarUrl} size={24} />
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-slate-800">{a.actor?.name ?? "System"}</span>{" "}
                  <span className="text-slate-500">{ACTIVITY_LABEL[a.action] ?? a.action}</span>
                  {a.detail && <span className="text-slate-400"> — {a.detail}</span>}
                </div>
                <span className="shrink-0 text-[11px] text-slate-400">{relativeTime(new Date(a.createdAt))}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-400">No activity recorded yet.</p>
        )}
      </Card>
    </div>
  );
}
