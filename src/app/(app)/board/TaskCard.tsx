import { Badge } from "../_components/ui";
import { priorityQuadrant } from "@/lib/constants";
import { cn } from "@/lib/cn";
import MoveControl from "./MoveControl";
import TaskLink from "../_components/TaskLink";
import { getTaskVisuals } from "./KanbanBoard";

type TaskLike = {
  id: string;
  title: string;
  status: string;
  sizeLabel: string | null;
  urgent: boolean;
  important: boolean;
  estimatedMins: number | null;
  dueAt: Date | string | null;
  holdReason: string | null;
  reviewRequired: boolean;
  carryCount: number;
  reworkCount?: number;
  concernedContact?: string | null;
  rejectionReason?: string | null;
  kpiTemplate: { kpiName: string } | null;
  kpiPoints?: { earnedPoints: number; maxPoints: number } | null;
  project: { name: string } | null;
  assignee?: { name: string } | null;
  creator?: { name: string } | null;
  managerScore?: number | null;
  canScore?: boolean;
};

const quadTone: Record<string, string> = {
  "Do First": "bg-red-100 text-red-700",
  Schedule: "bg-blue-100 text-blue-700",
  Delegate: "bg-amber-100 text-amber-700",
  Eliminate: "bg-slate-100 text-slate-500",
};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function fmtDate(d: Date | string | null): string | null {
  if (!d) return null;
  const date = typeof d === "string" ? new Date(d) : d;
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export default function TaskCard({
  task,
  showAssignee = false,
  delegatedBy,
}: {
  task: TaskLike;
  showAssignee?: boolean;
  /** Set to the creator's name when this task was delegated from outside the normal reporting line. */
  delegatedBy?: string | null;
}) {
  const quad = priorityQuadrant(task.urgent, task.important);
  const visuals = getTaskVisuals(task, Date.now());

  return (
    <div className={cn("rounded-xl border p-3 shadow-sm transition-all", visuals.cardStyles, visuals.borderLeft)}>
      <TaskLink
        taskId={task.id}
        className="text-sm font-medium leading-snug text-slate-900 hover:text-blue-600 hover:underline"
      >
        {task.title}
      </TaskLink>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Badge className={quadTone[quad]}>{quad}</Badge>

        {/* Delay & Urgency Badges */}
        {visuals.delayState === "overdue" && (
          <span className="rounded-full bg-rose-100 border border-rose-300 px-2 py-0.5 text-xs font-semibold text-rose-800 inline-flex items-center gap-1 shadow-xs">
            🚨 Delayed ({visuals.overdueDays}d)
          </span>
        )}
        {visuals.delayState === "slightly_delayed" && (
          <span className="rounded-full bg-amber-100 border border-amber-300 px-2 py-0.5 text-xs font-semibold text-amber-800 inline-flex items-center gap-1 shadow-xs">
            ⚠️ Slightly Delayed
          </span>
        )}
        {visuals.delayState === "due_soon" && (
          <span className="rounded-full bg-yellow-100 border border-yellow-300 px-2 py-0.5 text-xs font-medium text-yellow-800 inline-flex items-center gap-1">
            ⏰ Due Soon
          </span>
        )}

        {/* Rework Badge */}
        {visuals.isRework && (
          <span className="rounded-full bg-orange-100 border border-orange-300 px-2 py-0.5 text-xs font-semibold text-orange-800 inline-flex items-center gap-1">
            ↩️ Rework{task.reworkCount ? ` (${task.reworkCount}×)` : ""}
          </span>
        )}

        {/* Status Badge */}
        {task.status === "PENDING_REVIEW" && (
          <span className="rounded-full bg-violet-100 border border-violet-200 px-2 py-0.5 text-xs font-semibold text-violet-800">
            👀 Under Review
          </span>
        )}

        {task.kpiTemplate && (
          <Badge className="bg-violet-100 text-violet-700">{task.kpiTemplate.kpiName}</Badge>
        )}
        {task.kpiPoints && (
          <Badge className="bg-violet-600 text-white font-semibold">
            ⭐ {task.kpiPoints.earnedPoints} pts
          </Badge>
        )}
        {task.sizeLabel && (
          <Badge className="bg-slate-100 text-slate-600">{task.sizeLabel.toLowerCase()}</Badge>
        )}
        {task.reviewRequired && (
          <Badge className="bg-amber-100 text-amber-700">review</Badge>
        )}
        {task.managerScore != null && (
          <Badge className="bg-amber-100 text-amber-800 font-semibold" title={`Manager quality score: ${task.managerScore}%`}>
            🏅 {task.managerScore}%
          </Badge>
        )}
        {task.carryCount > 0 && (
          <Badge className="bg-red-50 text-red-600" title="Carried forward from a previous day">
            ↻ carried {task.carryCount}×
          </Badge>
        )}
        {delegatedBy && (
          <Badge className="bg-indigo-100 text-indigo-700" title={`Delegated by ${delegatedBy}`}>
            ↪ delegated by {delegatedBy}
          </Badge>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
        {task.project && <span>📁 {task.project.name}</span>}
        {task.estimatedMins != null && <span>⏱ {task.estimatedMins}m</span>}
        {task.dueAt && <span>📅 {fmtDate(task.dueAt)}</span>}
        {task.concernedContact && (
          <span className="font-medium text-slate-700 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-[11px] inline-flex items-center gap-1">
            👤 Contact: {task.concernedContact}
          </span>
        )}
        {showAssignee && task.assignee && <span>👤 {task.assignee.name}</span>}
      </div>

      {task.status === "ON_HOLD" && task.holdReason && (
        <div className="mt-2 rounded-md bg-amber-50 border border-amber-200 px-2 py-1 text-[11px] text-amber-800">
          <span className="font-medium">On hold:</span> {task.holdReason}
        </div>
      )}

      {task.rejectionReason && task.status !== "CLOSED" && (
        <div className="mt-2 rounded-md bg-rose-50 border border-rose-200 px-2 py-1 text-[11px] text-rose-800">
          <span className="font-semibold">Rejection note:</span> {task.rejectionReason}
        </div>
      )}

      <MoveControl taskId={task.id} status={task.status} canScore={task.canScore} />
    </div>
  );
}
