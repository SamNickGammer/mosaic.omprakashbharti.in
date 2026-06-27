import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, MessageSquare } from "lucide-react";

import { getSessionUserId } from "@/lib/api";
import { getOwnedTask } from "@/lib/authz";
import { StatusBadge, PriorityBadge } from "@/components/board/badges";
import { WorkspaceSync } from "@/components/layout/workspace-sync";

export default async function TaskDetailPage({
  params,
}: {
  params: { clientId: string; projectId: string; taskId: string };
}) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const task = await getOwnedTask(userId, params.taskId);
  if (!task || task.projectId !== params.projectId) notFound();

  const boardHref = `/clients/${params.clientId}/projects/${params.projectId}`;

  return (
    <div className="flex h-full flex-col">
      <WorkspaceSync clientId={params.clientId} projectId={params.projectId} />

      <div className="flex items-center gap-3 border-b px-6 py-3">
        <Link
          href={boardHref}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Board
        </Link>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        {/* Task details */}
        <div className="space-y-5 overflow-auto border-r p-6">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={task.status} />
            <PriorityBadge priority={task.priority} />
          </div>
          <h1 className="text-2xl font-bold leading-tight tracking-tight">
            {task.title}
          </h1>
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Instructions
            </h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
              {task.instructions || "No instructions provided."}
            </p>
          </div>
        </div>

        {/* Chat thread (Phase 2) */}
        <div className="flex min-h-0 flex-col">
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
            <div className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <MessageSquare className="size-6" />
            </div>
            <div>
              <p className="font-medium">Task chat</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Single-agent streaming chat arrives in Phase 2, followed by
                multi-agent orchestration in Phase 3. Assign agents to this
                project to get ready.
              </p>
            </div>
          </div>
          <div className="border-t p-4">
            <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              <span className="flex-1">Message input — coming in Phase 2</span>
              <span className="streaming-dot" />
              <span className="streaming-dot" />
              <span className="streaming-dot" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
