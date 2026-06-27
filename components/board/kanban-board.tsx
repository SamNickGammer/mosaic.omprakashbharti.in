"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Loader2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SortableTaskCard, TaskCardView } from "@/components/board/task-card";
import { CreateTaskDialog } from "@/components/board/create-task-dialog";
import { TASK_STATUSES } from "@/types";
import type { Task, TaskStatus } from "@/types";
import { useTasks, useUpdateTask } from "@/hooks/queries";

type Board = Record<TaskStatus, Task[]>;

function emptyBoard(): Board {
  return { backlog: [], in_progress: [], review: [], done: [] };
}

function groupTasks(tasks: Task[]): Board {
  const board = emptyBoard();
  for (const status of TASK_STATUSES) {
    board[status.id] = tasks
      .filter((t) => t.status === status.id)
      .sort((a, b) => a.position - b.position);
  }
  return board;
}

export function KanbanBoard({
  clientId,
  projectId,
}: {
  clientId: string;
  projectId: string;
}) {
  const { data: tasks, isLoading } = useTasks(projectId);
  const update = useUpdateTask(projectId);

  const [board, setBoard] = useState<Board>(emptyBoard());
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (tasks) setBoard(groupTasks(tasks));
  }, [tasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const activeTask = useMemo(() => {
    if (!activeId) return null;
    for (const status of TASK_STATUSES) {
      const found = board[status.id].find((t) => t.id === activeId);
      if (found) return found;
    }
    return null;
  }, [activeId, board]);

  function findContainer(id: string): TaskStatus | null {
    if (id in board) return id as TaskStatus;
    for (const status of TASK_STATUSES) {
      if (board[status.id].some((t) => t.id === id)) return status.id;
    }
    return null;
  }

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function onDragOver(e: DragOverEvent) {
    const { active, over } = e;
    if (!over) return;
    const activeC = findContainer(String(active.id));
    const overC = findContainer(String(over.id));
    if (!activeC || !overC || activeC === overC) return;

    setBoard((prev) => {
      const activeItems = prev[activeC];
      const overItems = prev[overC];
      const movingIndex = activeItems.findIndex((t) => t.id === active.id);
      if (movingIndex < 0) return prev;
      const moving = activeItems[movingIndex];

      const overIndex = overItems.findIndex((t) => t.id === over.id);
      const insertAt = overIndex >= 0 ? overIndex : overItems.length;

      return {
        ...prev,
        [activeC]: activeItems.filter((t) => t.id !== active.id),
        [overC]: [
          ...overItems.slice(0, insertAt),
          { ...moving, status: overC },
          ...overItems.slice(insertAt),
        ],
      };
    });
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setActiveId(null);
    if (!over) return;

    const activeC = findContainer(String(active.id));
    const overC = findContainer(String(over.id));
    if (!activeC || !overC) return;

    let finalStatus = overC;
    let finalIndex = 0;

    setBoard((prev) => {
      const next = { ...prev };
      if (activeC === overC) {
        const items = prev[overC];
        const oldIndex = items.findIndex((t) => t.id === active.id);
        const newIndex = items.findIndex((t) => t.id === over.id);
        if (oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex) {
          next[overC] = arrayMove(items, oldIndex, newIndex);
        }
      }
      finalStatus = overC;
      finalIndex = next[overC].findIndex((t) => t.id === active.id);
      return next;
    });

    // Persist the moved card's column + position.
    update.mutate({
      id: String(active.id),
      status: finalStatus,
      position: Math.max(0, finalIndex),
    });
  }

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
    >
      <div className="flex h-full gap-4 overflow-x-auto p-4">
        {TASK_STATUSES.map((status) => (
          <Column
            key={status.id}
            status={status.id}
            label={status.label}
            tasks={board[status.id]}
            clientId={clientId}
            projectId={projectId}
          />
        ))}
      </div>

      <DragOverlay>
        {activeTask ? (
          <TaskCardView task={activeTask} dragging className="w-[248px]" />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({
  status,
  label,
  tasks,
  clientId,
  projectId,
}: {
  status: TaskStatus;
  label: string;
  tasks: Task[];
  clientId: string;
  projectId: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div className="flex w-[280px] shrink-0 flex-col">
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </h3>
          <span className="rounded-full bg-secondary px-1.5 text-[10px] font-medium text-muted-foreground">
            {tasks.length}
          </span>
        </div>
        <CreateTaskDialog
          projectId={projectId}
          defaultStatus={status}
          trigger={
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`Add task to ${label}`}
              className="text-muted-foreground"
            >
              <Plus className="size-4" />
            </Button>
          }
        />
      </div>

      <div
        ref={setNodeRef}
        className={cnColumn(isOver)}
      >
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">
              Drop tasks here
            </p>
          ) : (
            tasks.map((task) => (
              <SortableTaskCard
                key={task.id}
                task={task}
                href={`/clients/${clientId}/projects/${projectId}/tasks/${task.id}`}
              />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  );
}

function cnColumn(isOver: boolean) {
  return [
    "flex min-h-40 flex-1 flex-col gap-2 rounded-xl border border-dashed p-2 transition-colors",
    isOver ? "border-primary/50 bg-primary/5" : "border-border bg-muted/30",
  ].join(" ");
}
