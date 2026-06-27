"use client";

import Link from "next/link";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, MessageSquare } from "lucide-react";

import { cn } from "@/lib/utils";
import { PriorityBadge } from "@/components/board/badges";
import type { Task } from "@/types";

export function TaskCardView({
  task,
  href,
  handleProps,
  dragging,
  className,
}: {
  task: Task;
  href?: string;
  handleProps?: React.HTMLAttributes<HTMLButtonElement>;
  dragging?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "group rounded-lg border bg-card p-3 shadow-card transition-all duration-150",
        "hover:border-primary/40",
        dragging && "rotate-1 opacity-90 shadow-card-hover",
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <Link
          href={href ?? "#"}
          className="min-w-0 flex-1"
          onClick={(e) => {
            if (!href) e.preventDefault();
          }}
        >
          <p className="line-clamp-2 text-sm font-medium leading-snug">
            {task.title}
          </p>
        </Link>
        <button
          type="button"
          aria-label="Drag task"
          className="-mr-1 cursor-grab touch-none rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100 active:cursor-grabbing"
          {...handleProps}
        >
          <GripVertical className="size-4" />
        </button>
      </div>

      {task.instructions ? (
        <p className="mt-1.5 line-clamp-2 text-xs leading-normal text-muted-foreground">
          {task.instructions}
        </p>
      ) : null}

      <div className="mt-3 flex items-center justify-between">
        <PriorityBadge priority={task.priority} />
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <MessageSquare className="size-3" />
          Chat
        </span>
      </div>
    </div>
  );
}

export function SortableTaskCard({
  task,
  href,
}: {
  task: Task;
  href: string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
      }}
      className={cn(isDragging && "opacity-40")}
    >
      <TaskCardView
        task={task}
        href={href}
        handleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}
