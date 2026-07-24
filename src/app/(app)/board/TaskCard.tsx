import { Badge } from "../_components/ui";
import { priorityQuadrant } from "@/lib/constants";
import MoveControl from "./MoveControl";
import TaskLink from "../_components/TaskLink";

type TaskLike = {
  id: string;
  title: string;
  status: string;
  sizeLabel: string | null;
  urgent: boolean;
  important: boolean;
  estimatedMins: number | null;
  dueAt: Date | null;
  holdReason: string | null;
  reviewRequired: boolean;
  carryCount: number;
  kpiTemplate: { kpiName: string } | null;
  project: { name: string } | null;
  assignee?: { name: string } | null;
  creator?: { name: string } | null;
};

const quadTone: Record<string, string> = {
  "Do First": "bg-red-100 text-red-700",
  Schedule: "bg-blue-100 text-blue-700",
  Delegate: "bg-amber-100 text-amber-700",
  Eliminate: "bg-slate-100 text-slate-500",
};

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
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <TaskLink
        taskId={task.id}
        className="text-sm font-medium leading-snug text-slate-900 hover:text-blue-600 hover:underline"
      >
        {task.title}
      </TaskLink>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <Badge className={quadTone[quad]}>{quad}</Badge>
        {task.kpiTemplate && (
          <Badge className="bg-violet-100 text-violet-700">{task.kpiTemplate.kpiName}</Badge>
        )}
        {task.sizeLabel && (
          <Badge className="bg-slate-100 text-slate-600">{task.sizeLabel.toLowerCase()}</Badge>
        )}
        {task.reviewRequired && (
          <Badge className="bg-amber-100 text-amber-700">review</Badge>
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

      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
        {task.project && <span>📁 {task.project.name}</span>}
        {task.estimatedMins != null && <span>⏱ {task.estimatedMins}m</span>}
        {task.dueAt && <span>📅 {new Date(task.dueAt).toLocaleDateString()}</span>}
        {showAssignee && task.assignee && <span>👤 {task.assignee.name}</span>}
      </div>

      {task.status === "ON_HOLD" && task.holdReason && (
        <div className="mt-2 rounded-md bg-amber-50 px-2 py-1 text-[11px] text-amber-700">
          On hold: {task.holdReason}
        </div>
      )}

      <MoveControl taskId={task.id} status={task.status} />
    </div>
  );
}
