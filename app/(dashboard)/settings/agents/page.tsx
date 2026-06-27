"use client";

import { Bot, KeyRound, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { AGENT_BADGE } from "@/lib/agent-style";
import { providerLabel } from "@/types";
import { useAgents, useDeleteAgent } from "@/hooks/queries";
import { AddAgentDialog } from "@/components/agents/add-agent-dialog";

export default function AgentsSettingsPage() {
  const { data: agents, isLoading } = useAgents();
  const del = useDeleteAgent();

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agents</h1>
          <p className="text-sm text-muted-foreground">
            Connect AI models by API key, then assign them to projects.
          </p>
        </div>
        <AddAgentDialog
          trigger={
            <Button>
              <Plus className="size-4" /> Add agent
            </Button>
          }
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : !agents || agents.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <Bot className="size-6" />
            </div>
            <div>
              <p className="font-medium">No agents connected</p>
              <p className="text-sm text-muted-foreground">
                Add your first AI agent to start orchestrating tasks.
              </p>
            </div>
            <AddAgentDialog
              trigger={
                <Button size="sm">
                  <Plus className="size-4" /> Add agent
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {agents.map((agent) => (
            <li key={agent.id}>
              <Card>
                <CardContent className="flex items-center gap-4 py-4">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Bot className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium">
                        {agent.displayName}
                      </p>
                      <Badge
                        variant="outline"
                        className={cn(
                          "uppercase tracking-wide",
                          AGENT_BADGE[agent.provider],
                        )}
                      >
                        {providerLabel(agent.provider)}
                      </Badge>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      {agent.model ? (
                        <span className="font-mono">{agent.model}</span>
                      ) : null}
                      <span className="flex items-center gap-1 font-mono">
                        <KeyRound className="size-3" />
                        {agent.keyPreview}
                      </span>
                      {agent.baseUrl ? (
                        <span className="truncate">{agent.baseUrl}</span>
                      ) : null}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${agent.displayName}`}
                    disabled={del.isPending}
                    onClick={() => {
                      if (
                        confirm(`Remove "${agent.displayName}"? This cannot be undone.`)
                      ) {
                        del.mutate(agent.id);
                      }
                    }}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
