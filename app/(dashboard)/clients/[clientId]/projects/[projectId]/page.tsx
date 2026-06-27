import { notFound, redirect } from "next/navigation";

import { getSessionUserId } from "@/lib/api";
import { getOwnedProject } from "@/lib/authz";
import { ProjectHeader } from "@/components/projects/project-header";
import { KanbanBoard } from "@/components/board/kanban-board";
import { WorkspaceSync } from "@/components/layout/workspace-sync";

export default async function ProjectBoardPage({
  params,
}: {
  params: { clientId: string; projectId: string };
}) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const project = await getOwnedProject(userId, params.projectId);
  if (!project || project.clientId !== params.clientId) notFound();

  return (
    <div className="flex h-full flex-col">
      <WorkspaceSync clientId={params.clientId} projectId={params.projectId} />
      <ProjectHeader projectId={params.projectId} />
      <div className="min-h-0 flex-1">
        <KanbanBoard
          clientId={params.clientId}
          projectId={params.projectId}
        />
      </div>
    </div>
  );
}
