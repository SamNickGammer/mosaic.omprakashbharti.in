"use client";

import Link from "next/link";
import { ArrowRight, Boxes, FolderKanban, Plus, Bot } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAgents, useClients } from "@/hooks/queries";
import { CreateClientDialog } from "@/components/clients/create-client-dialog";

export default function DashboardPage() {
  const { data: clients, isLoading } = useClients();
  const { data: agents } = useAgents();

  const projectCount =
    clients?.reduce((sum, c) => sum + c.projects.length, 0) ?? 0;

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            All your clients, projects, and agents in one place.
          </p>
        </div>
        <CreateClientDialog
          trigger={
            <Button>
              <Plus className="size-4" /> New client
            </Button>
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={<Boxes className="size-4" />}
          label="Clients"
          value={isLoading ? null : (clients?.length ?? 0)}
        />
        <StatCard
          icon={<FolderKanban className="size-4" />}
          label="Projects"
          value={isLoading ? null : projectCount}
        />
        <StatCard
          icon={<Bot className="size-4" />}
          label="Agents"
          value={agents ? agents.length : null}
        />
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Clients
        </h2>
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        ) : !clients || clients.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <Boxes className="size-8 text-muted-foreground" />
              <div>
                <p className="font-medium">No clients yet</p>
                <p className="text-sm text-muted-foreground">
                  Create a client to start organizing projects and agents.
                </p>
              </div>
              <CreateClientDialog
                trigger={
                  <Button size="sm">
                    <Plus className="size-4" /> New client
                  </Button>
                }
              />
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {clients.map((client) => (
              <Card key={client.id}>
                <CardHeader className="flex-row items-center gap-2 space-y-0">
                  <span
                    className="size-3 rounded-full"
                    style={{
                      backgroundColor: client.color ?? "var(--primary)",
                    }}
                  />
                  <CardTitle className="text-base">{client.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {client.projects.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No projects yet
                    </p>
                  ) : (
                    <ul className="space-y-1">
                      {client.projects.slice(0, 4).map((p) => (
                        <li key={p.id}>
                          <Link
                            href={`/clients/${client.id}/projects/${p.id}`}
                            className="flex items-center justify-between rounded-md px-2 py-1 text-sm hover:bg-accent"
                          >
                            <span className="flex items-center gap-2 truncate">
                              <FolderKanban className="size-3.5 text-muted-foreground" />
                              {p.name}
                            </span>
                            <ArrowRight className="size-3.5 text-muted-foreground" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | null;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-5">
        <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          {icon}
        </div>
        <div>
          {value === null ? (
            <Skeleton className="h-7 w-10" />
          ) : (
            <p className="text-2xl font-semibold">{value}</p>
          )}
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
