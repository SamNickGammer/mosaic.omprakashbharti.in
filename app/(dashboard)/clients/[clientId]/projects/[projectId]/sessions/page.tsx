import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { getSessionUserId } from "@/lib/api";
import { getOwnedProject } from "@/lib/authz";
import { SessionsManager } from "@/components/sessions/sessions-manager";
import { WorkspaceSync } from "@/components/layout/workspace-sync";

export default async function SessionsPage({
  params,
}: {
  params: { clientId: string; projectId: string };
}) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const project = await getOwnedProject(userId, params.projectId);
  if (!project || project.clientId !== params.clientId) notFound();

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
      <div className="min-h-0 flex-1 overflow-auto">
        <SessionsManager projectId={params.projectId} />
      </div>
    </div>
  );
}
