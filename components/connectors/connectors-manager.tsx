"use client";

import { Pencil, Plug, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ConnectorDialog } from "@/components/connectors/connector-dialog";
import { CONNECTOR_META } from "@/lib/connector-meta";
import {
  useClients,
  useConnectors,
  useDeleteConnector,
  type ClientTreeNode,
  type ConnectorView,
} from "@/hooks/queries";

export function ConnectorsManager() {
  const { data: clients, isLoading } = useClients();

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Connectors</h1>
        <p className="text-sm text-muted-foreground">
          Services each client has connected — Slack, Gmail, WhatsApp and more.
          Agents on that client&apos;s projects receive these details to act on
          them (post a message, send an email, …).
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : !clients || clients.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Plug className="size-6 text-muted-foreground" />
            <p className="font-medium">No clients yet</p>
            <p className="text-sm text-muted-foreground">
              Create a client first, then connect its services here.
            </p>
          </CardContent>
        </Card>
      ) : (
        clients.map((c) => <ClientConnectors key={c.id} client={c} />)
      )}
    </div>
  );
}

function ClientConnectors({ client }: { client: ClientTreeNode }) {
  const { data: connectors, isLoading } = useConnectors(client.id);
  const del = useDeleteConnector(client.id);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="size-2.5 rounded-full"
            style={{ backgroundColor: client.color ?? "var(--primary)" }}
          />
          <h2 className="font-semibold">{client.name}</h2>
          <span className="text-xs text-muted-foreground">
            {connectors?.length ?? 0} connected
          </span>
        </div>
        <ConnectorDialog
          clientId={client.id}
          trigger={
            <Button variant="outline" size="sm">
              <Plus className="size-4" /> Add connector
            </Button>
          }
        />
      </div>

      {isLoading ? (
        <Skeleton className="h-16 rounded-xl" />
      ) : !connectors || connectors.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            No connectors for this client yet.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {connectors.map((conn) => (
            <ConnectorRow
              key={conn.id}
              clientId={client.id}
              conn={conn}
              onDelete={() => {
                if (confirm(`Delete connector "${conn.name}"?`)) {
                  del.mutate(conn.id);
                }
              }}
              deleting={del.isPending}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function ConnectorRow({
  clientId,
  conn,
  onDelete,
  deleting,
}: {
  clientId: string;
  conn: ConnectorView;
  onDelete: () => void;
  deleting: boolean;
}) {
  const meta = CONNECTOR_META[conn.type];
  const Icon = meta.Icon;
  return (
    <li>
      <Card>
        <CardContent className="flex items-start gap-3 py-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
            <Icon className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate font-medium">{conn.name}</p>
              <Badge variant="outline">{meta.label}</Badge>
              {conn.hasSecret ? (
                <Badge variant="outline" className="text-emerald-500">
                  secret set
                </Badge>
              ) : null}
            </div>
            {conn.account ? (
              <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                {conn.account}
              </p>
            ) : null}
            {conn.details ? (
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {conn.details}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <ConnectorDialog
              clientId={clientId}
              connector={conn}
              trigger={
                <Button variant="ghost" size="icon" aria-label="Edit connector">
                  <Pencil className="size-4" />
                </Button>
              }
            />
            <Button
              variant="ghost"
              size="icon"
              aria-label="Delete connector"
              disabled={deleting}
              className="text-muted-foreground hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </li>
  );
}
