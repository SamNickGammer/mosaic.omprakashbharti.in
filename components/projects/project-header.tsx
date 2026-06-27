"use client";

import { useState } from "react";
import { ExternalLink, Plus, Settings2, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { AGENT_BADGE } from "@/lib/agent-style";
import { providerLabel } from "@/types";
import { useProject } from "@/hooks/queries";
import { CreateTaskDialog } from "@/components/board/create-task-dialog";
import { EditProjectDialog } from "@/components/projects/edit-project-dialog";

export function ProjectHeader({ projectId }: { projectId: string }) {
  const { data: project, isLoading } = useProject(projectId);
  const [showContext, setShowContext] = useState(false);

  if (isLoading || !project) {
    return (
      <div className="border-b px-6 py-4">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>
    );
  }

  const primary = project.agents.find((a) => a.role === "primary");
  const secondaries = project.agents.filter((a) => a.role === "secondary");

  return (
    <div className="border-b px-6 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-xl font-bold tracking-tight">
              {project.name}
            </h1>
            {project.repoUrl ? (
              <a
                href={project.repoUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <ExternalLink className="size-3" /> Repo
              </a>
            ) : null}
          </div>
          {project.description ? (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {project.description}
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <EditProjectDialog
            projectId={projectId}
            trigger={
              <Button variant="outline" size="sm">
                <Settings2 className="size-4" /> Edit
              </Button>
            }
          />
          <CreateTaskDialog
            projectId={projectId}
            trigger={
              <Button size="sm">
                <Plus className="size-4" /> New task
              </Button>
            }
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {project.agents.length === 0 ? (
          <span className="text-xs text-muted-foreground">
            No agents assigned — add some in Edit.
          </span>
        ) : (
          <>
            {primary ? (
              <Badge
                variant="outline"
                className={cn("gap-1", AGENT_BADGE[primary.provider])}
              >
                <Sparkles className="size-3" />
                {primary.displayName}
                <span className="opacity-70">· primary</span>
              </Badge>
            ) : null}
            {secondaries.map((a) => (
              <Badge
                key={a.id}
                variant="outline"
                className={AGENT_BADGE[a.provider]}
                title={providerLabel(a.provider)}
              >
                {a.displayName}
              </Badge>
            ))}
          </>
        )}
      </div>

      {project.context ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowContext((s) => !s)}
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            {showContext ? "Hide" : "Show"} project context
          </button>
          {showContext ? (
            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border bg-muted/50 p-3 font-mono text-xs text-muted-foreground">
              {project.context}
            </pre>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
