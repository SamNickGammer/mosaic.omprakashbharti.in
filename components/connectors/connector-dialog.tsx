"use client";

import { useState, type ReactElement } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CONNECTOR_META, CONNECTOR_TYPES } from "@/lib/connector-meta";
import {
  useCreateConnector,
  useUpdateConnector,
  type ConnectorType,
  type ConnectorView,
} from "@/hooks/queries";
import { useControllableOpen } from "@/hooks/use-controllable-open";

export function ConnectorDialog({
  clientId,
  connector,
  trigger,
}: {
  clientId: string;
  connector?: ConnectorView;
  trigger: ReactElement;
}) {
  const editing = !!connector;
  const { open, setOpen } = useControllableOpen();
  const create = useCreateConnector(clientId);
  const update = useUpdateConnector(clientId);

  const [type, setType] = useState<ConnectorType>(connector?.type ?? "slack");
  const [name, setName] = useState(connector?.name ?? "");
  const [account, setAccount] = useState(connector?.account ?? "");
  const [details, setDetails] = useState(connector?.details ?? "");
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string | null>(null);

  const meta = CONNECTOR_META[type];
  const busy = create.isPending || update.isPending;

  function reset() {
    setType(connector?.type ?? "slack");
    setName(connector?.name ?? "");
    setAccount(connector?.account ?? "");
    setDetails(connector?.details ?? "");
    setSecret("");
    setError(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Name is required");
    try {
      if (editing) {
        await update.mutateAsync({
          connectorId: connector.id,
          name: name.trim(),
          account: account.trim(),
          details: details.trim(),
          // Only send secret if the user typed a new one.
          ...(secret.trim() ? { secret: secret.trim() } : {}),
        });
      } else {
        await create.mutateAsync({
          type,
          name: name.trim(),
          account: account.trim(),
          details: details.trim(),
          secret: secret.trim() || undefined,
        });
      }
      setOpen(false);
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save connector");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        reset();
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit connector" : "Add connector"}</DialogTitle>
            <DialogDescription>
              A service this client connects (Slack, Gmail, …). Its details are
              handed to the client&apos;s agents so they can act on it.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Service</Label>
              {editing ? (
                <div className="flex h-9 items-center rounded-md border bg-muted/40 px-3 text-sm">
                  {CONNECTOR_META[connector.type].label}
                </div>
              ) : (
                <Select
                  value={type}
                  onValueChange={(v) => setType(v as ConnectorType)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {(value: unknown) =>
                        CONNECTOR_META[value as ConnectorType]?.label ?? "Select"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {CONNECTOR_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {CONNECTOR_META[t].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="conn-name">Name</Label>
              <Input
                id="conn-name"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={`e.g. ${meta.label} — Support`}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="conn-account">{meta.accountLabel}</Label>
              <Input
                id="conn-account"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                placeholder={meta.accountPlaceholder}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="conn-details">Instructions for the agent</Label>
              <Textarea
                id="conn-details"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="How the agent should use this — channel to post in, tone, when to message, etc."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="conn-secret">{meta.secretLabel}</Label>
              <Input
                id="conn-secret"
                type="password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder={
                  editing && connector.hasSecret
                    ? "•••••••• (leave blank to keep)"
                    : "Stored encrypted; only agents receive it"
                }
              />
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOpen(false);
                reset();
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : editing ? "Save" : "Add connector"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
