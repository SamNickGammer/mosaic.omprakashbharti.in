"use client";

import { useMemo, useState, type ReactElement } from "react";
import { Check } from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { providerLabel } from "@/types";
import { useAgents, useCreateProject } from "@/hooks/queries";
import { useControllableOpen } from "@/hooks/use-controllable-open";

export function CreateProjectDialog({
  clientId,
  clientName,
  trigger,
  open: openProp,
  onOpenChange,
}: {
  clientId: string;
  clientName?: string;
  trigger?: ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const { open, setOpen } = useControllableOpen(openProp, onOpenChange);
  const { data: agents } = useAgents();
  const create = useCreateProject(clientId);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [context, setContext] = useState("");
  const [primaryAgentId, setPrimaryAgentId] = useState<string>("");
  const [secondaryIds, setSecondaryIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const secondaryCandidates = useMemo(
    () => (agents ?? []).filter((a) => a.id !== primaryAgentId),
    [agents, primaryAgentId],
  );

  function reset() {
    setName("");
    setDescription("");
    setRepoUrl("");
    setContext("");
    setPrimaryAgentId("");
    setSecondaryIds(new Set());
    setError(null);
  }

  function toggleSecondary(id: string) {
    setSecondaryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    try {
      await create.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        repoUrl: repoUrl.trim() || undefined,
        context: context.trim() || undefined,
        primaryAgentId: primaryAgentId || null,
        secondaryAgentIds: [...secondaryIds].filter(
          (id) => id !== primaryAgentId,
        ),
      });
      reset();
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    }
  }

  const hasAgents = (agents ?? []).length > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      {trigger ? <DialogTrigger render={trigger} /> : null}
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>
              New project{clientName ? ` in ${clientName}` : ""}
            </DialogTitle>
            <DialogDescription>
              A project is a codebase or workstream. Assign agents to power its
              tasks.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="project-name">Name</Label>
              <Input
                id="project-name"
                value={name}
                autoFocus
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Frontend"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="project-repo">Repo URL</Label>
                <Input
                  id="project-repo"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  placeholder="https://github.com/…"
                />
              </div>
              <div className="space-y-2">
                <Label>Primary agent</Label>
                <Select
                  value={primaryAgentId}
                  onValueChange={(v) => setPrimaryAgentId((v as string) ?? "")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {(value: unknown) =>
                        (agents ?? []).find((a) => a.id === value)
                          ?.displayName ?? "None"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {(agents ?? []).map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Secondary agents</Label>
              {!hasAgents ? (
                <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                  No agents yet. Add agents in Settings → Agents to assign them.
                </p>
              ) : secondaryCandidates.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No other agents available.
                </p>
              ) : (
                <div className="space-y-1">
                  {secondaryCandidates.map((a) => {
                    const selected = secondaryIds.has(a.id);
                    return (
                      <button
                        type="button"
                        key={a.id}
                        onClick={() => toggleSecondary(a.id)}
                        className={cn(
                          "flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors",
                          selected
                            ? "border-primary/40 bg-primary/5"
                            : "hover:bg-accent",
                        )}
                      >
                        <span>
                          <span className="font-medium">{a.displayName}</span>
                          <span className="ml-2 text-xs text-muted-foreground">
                            {providerLabel(a.provider)}
                          </span>
                        </span>
                        <span
                          className={cn(
                            "flex size-4 items-center justify-center rounded border",
                            selected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-input",
                          )}
                        >
                          {selected ? <Check className="size-3" /> : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="project-context">Project context</Label>
              <Textarea
                id="project-context"
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="Standing instructions injected into every agent call. e.g. React 18, TypeScript, Tailwind. Do not modify /v1 routes."
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="project-desc">Description</Label>
              <Textarea
                id="project-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
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
              {create.isPending ? "Creating…" : "Create project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
