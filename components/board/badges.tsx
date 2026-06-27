import { cn } from "@/lib/utils";
import type { TaskPriority, TaskStatus } from "@/types";

const STATUS_STYLE: Record<TaskStatus, string> = {
  backlog: "bg-secondary text-muted-foreground border-border",
  in_progress: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  review: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  done: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
};

const STATUS_LABEL: Record<TaskStatus, string> = {
  backlog: "Backlog",
  in_progress: "In Progress",
  review: "Review",
  done: "Done",
};

export function StatusBadge({ status }: { status: TaskStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        STATUS_STYLE[status],
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

const PRIORITY_STYLE: Record<TaskPriority, string> = {
  low: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  medium: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  high: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  critical: "bg-red-500/10 text-red-400 border-red-500/20",
};

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize",
        PRIORITY_STYLE[priority],
      )}
    >
      {priority}
    </span>
  );
}
