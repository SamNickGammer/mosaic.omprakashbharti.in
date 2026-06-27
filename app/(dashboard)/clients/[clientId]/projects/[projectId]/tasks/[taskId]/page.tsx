import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { getSessionUserId } from "@/lib/api";
import { getOwnedTask } from "@/lib/authz";
import { WorkspaceSync } from "@/components/layout/workspace-sync";
import { TaskWorkspace } from "@/components/tasks/task-workspace";

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

      <TaskWorkspace
        clientId={params.clientId}
        projectId={params.projectId}
        initialTask={task}
      />
    </div>
  );
}
