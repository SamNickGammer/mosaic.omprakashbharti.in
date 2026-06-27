import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { getSessionUserId } from "@/lib/api";
import { getOwnedProject, getOwnedSession } from "@/lib/authz";
import { SessionChat } from "@/components/sessions/session-chat";
import { WorkspaceSync } from "@/components/layout/workspace-sync";

export default async function SessionChatPage({
  params,
}: {
  params: { id: string };
}) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const session = await getOwnedSession(userId, params.id);
  if (!session) notFound();

  const project = await getOwnedProject(userId, session.projectId);
  if (!project) notFound();

  const sessionsHref = `/clients/${project.clientId}/projects/${project.id}/sessions`;

  return (
    <div className="flex h-full flex-col">
      <WorkspaceSync clientId={project.clientId} projectId={project.id} />
      <div className="flex items-center gap-3 border-b px-6 py-3">
        <Link
          href={sessionsHref}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Sessions
        </Link>
        <span className="text-sm text-muted-foreground">· {project.name}</span>
      </div>
      <SessionChat sessionId={session.id} />
    </div>
  );
}
