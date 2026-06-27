"use client";

import { useMemo, useState, type ReactElement } from "react";

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
import { PROVIDERS, type AgentProviderId } from "@/types";
import { useCreateAgent } from "@/hooks/queries";
import { useControllableOpen } from "@/hooks/use-controllable-open";

export function AddAgentDialog({
  trigger,
  open: openProp,
  onOpenChange,
}: {
  trigger?: ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const { open, setOpen } = useControllableOpen(openProp, onOpenChange);
  const create = useCreateAgent();

  const [displayName, setDisplayName] = useState("");
  const [provider, setProvider] = useState<AgentProviderId>("anthropic");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const meta = useMemo(
    () => PROVIDERS.find((p) => p.id === provider),
    [provider],
  );

  function reset() {
    setDisplayName("");
    setProvider("anthropic");
    setModel("");
    setApiKey("");
    setBaseUrl("");
    setError(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!displayName.trim()) return setError("Display name is required");
    if (!apiKey.trim()) return setError("API key is required");
    if (meta?.requiresBaseUrl && !baseUrl.trim())
      return setError("Base URL is required for custom providers");

    try {
      await create.mutateAsync({
        displayName: displayName.trim(),
        provider,
        model: model.trim() || undefined,
        apiKey: apiKey.trim(),
        baseUrl: baseUrl.trim() || undefined,
      });
      reset();
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add agent");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      {trigger ? <DialogTrigger render={trigger} /> : null}
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Add agent</DialogTitle>
            <DialogDescription>
              Connect an AI model by API key. Keys are encrypted before they
              touch the database.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="agent-name">Display name</Label>
              <Input
                id="agent-name"
                autoFocus
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. PepsiCo Claude"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Provider</Label>
                <Select
                  value={provider}
                  onValueChange={(v) => {
                    setProvider(v as AgentProviderId);
                    setModel("");
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {(value: unknown) =>
                        PROVIDERS.find((p) => p.id === value)?.label ??
                        "Select"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDERS.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="agent-model">Model</Label>
                <Input
                  id="agent-model"
                  list="agent-model-suggestions"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder={meta?.models[0] ?? "model id"}
                />
                <datalist id="agent-model-suggestions">
                  {meta?.models.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </div>
            </div>

            {meta?.requiresBaseUrl ? (
              <div className="space-y-2">
                <Label htmlFor="agent-baseurl">Base URL</Label>
                <Input
                  id="agent-baseurl"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://api.example.com/v1"
                />
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="agent-key">API key</Label>
              <Input
                id="agent-key"
                type="password"
                autoComplete="off"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={meta?.keyPlaceholder ?? "your-api-key"}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Encrypted with AES-256-GCM. Never logged or shown again.
              </p>
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Adding…" : "Add agent"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
