"use client";

import Link from "next/link";
import { MessageSquare, Plus, Radio, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusDot } from "@/components/sessions/status-dot";
import { NewSessionDialog } from "@/components/sessions/new-session-dialog";
import { AGENT_TYPE_LABEL, SESSION_STATUS_META } from "@/lib/session-meta";
import { relativeTime } from "@/lib/time";
import { useRevokeSession, useSessions, useTasks } from "@/hooks/queries";

export function SessionsManager({ projectId }: { projectId: string }) {
  const { data: sessions, isLoading } = useSessions(projectId);
  const { data: tasks } = useTasks(projectId);
  const revoke = useRevokeSession(projectId);

  const taskTitle = (id: string | null) =>
    id ? tasks?.find((t) => t.id === id)?.title ?? null : null;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sessions</h1>
          <p className="text-sm text-muted-foreground">
            Live AI processes connected to this project via webhook tokens.
          </p>
        </div>
        <NewSessionDialog
          projectId={projectId}
          trigger={
            <Button>
              <Plus className="size-4" /> New session
            </Button>
          }
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : !sessions || sessions.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <Radio className="size-6" />
            </div>
            <div>
              <p className="font-medium">No sessions yet</p>
              <p className="text-sm text-muted-foreground">
                Create a session to connect Claude Code or Codex to this project.
              </p>
            </div>
            <NewSessionDialog
              projectId={projectId}
              trigger={
                <Button size="sm">
                  <Plus className="size-4" /> New session
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {sessions.map((s) => {
            const current = taskTitle(s.currentTaskId);
            return (
              <li key={s.id}>
                <Card>
                  <CardContent className="flex items-start gap-4 py-4">
                    <StatusDot status={s.status} className="mt-1.5" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium">{s.name}</p>
                        <Badge variant="outline">
                          {AGENT_TYPE_LABEL[s.agentType]}
                        </Badge>
                        {s.revoked ? (
                          <Badge
                            variant="outline"
                            className="border-destructive/30 text-destructive"
                          >
                            Revoked
                          </Badge>
                        ) : null}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        <span
                          className={SESSION_STATUS_META[s.status].text}
                        >
                          {SESSION_STATUS_META[s.status].label}
                        </span>
                        <span className="font-mono">{s.tokenPrefix}…</span>
                        <span>Last seen {relativeTime(s.lastSeenAt)}</span>
                      </div>
                      {current ? (
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          Working on:{" "}
                          <span className="text-foreground">{current}</span>
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        render={<Link href={`/sessions/${s.id}/chat`} />}
                      >
                        <MessageSquare className="size-4" /> Chat
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Revoke ${s.name}`}
                        disabled={revoke.isPending || s.revoked}
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          if (
                            confirm(
                              `Revoke "${s.name}"? Its token stops working immediately.`,
                            )
                          ) {
                            revoke.mutate(s.id);
                          }
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
