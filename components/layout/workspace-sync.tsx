"use client";

import { useEffect } from "react";

import { useWorkspace } from "@/stores/workspace";

/** Syncs the active client/project in the workspace store from the route. */
export function WorkspaceSync({
  clientId,
  projectId,
}: {
  clientId: string;
  projectId?: string;
}) {
  const setActiveClient = useWorkspace((s) => s.setActiveClient);
  const setActiveProject = useWorkspace((s) => s.setActiveProject);

  useEffect(() => {
    setActiveClient(clientId);
    if (projectId) setActiveProject(projectId);
  }, [clientId, projectId, setActiveClient, setActiveProject]);

  return null;
}
