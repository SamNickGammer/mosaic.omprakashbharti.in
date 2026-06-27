"use client";

import { useState, type ReactElement } from "react";
import { Check, Copy, TriangleAlert } from "lucide-react";

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
import { AGENT_TYPE_LABEL } from "@/lib/session-meta";
import { useCreateSession, type CreatedSession } from "@/hooks/queries";
import { useControllableOpen } from "@/hooks/use-controllable-open";
import type { AgentSessionType } from "@/lib/db/schema";

const AGENT_TYPES: AgentSessionType[] = [
  "claude_code",
  "codex",
  "copilot",
  "custom",
];

export function NewSessionDialog({
  projectId,
  trigger,
}: {
  projectId: string;
  trigger?: ReactElement;
}) {
  const { open, setOpen } = useControllableOpen();
  const create = useCreateSession(projectId);

  const [name, setName] = useState("");
  const [agentType, setAgentType] = useState<AgentSessionType>("claude_code");
  const [created, setCreated] = useState<CreatedSession | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName("");
    setAgentType("claude_code");
    setCreated(null);
    setCopied(false);
    setError(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Name is required");
    try {
      const res = await create.mutateAsync({ name: name.trim(), agentType });
      setCreated(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create session");
    }
  }

  async function copyPrompt() {
    if (!created) return;
    await navigator.clipboard.writeText(created.bootstrapPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        {!created ? (
          <form onSubmit={onSubmit}>
            <DialogHeader>
              <DialogTitle>New session</DialogTitle>
              <DialogDescription>
                Connect a live AI process running inside this project&apos;s
                folder.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="session-name">Name</Label>
                <Input
                  id="session-name"
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Claude Code — Frontend"
                />
              </div>
              <div className="space-y-2">
                <Label>Agent type</Label>
                <Select
                  value={agentType}
                  onValueChange={(v) => setAgentType(v as AgentSessionType)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {(value: unknown) =>
                        AGENT_TYPE_LABEL[value as AgentSessionType] ??
                        "Select"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {AGENT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {AGENT_TYPE_LABEL[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {error ? (
                <p className="text-sm text-destructive">{error}</p>
              ) : null}
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
                {create.isPending ? "Creating…" : "Create session"}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Session created ✓</DialogTitle>
              <DialogDescription>
                Paste this bootstrap prompt into a {AGENT_TYPE_LABEL[agentType]}{" "}
                session running inside the project folder.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-4">
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-400">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                <span>
                  Save this now — the token is shown only once. Token prefix:{" "}
                  <span className="font-mono">{created.session.tokenPrefix}…</span>
                </span>
              </div>

              <div className="relative">
                <pre className="max-h-72 overflow-auto rounded-lg border bg-muted/50 p-3 pr-12 font-mono text-xs leading-relaxed text-muted-foreground">
                  {created.bootstrapPrompt}
                </pre>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="outline"
                  aria-label="Copy bootstrap prompt"
                  className="absolute right-2 top-2"
                  onClick={copyPrompt}
                >
                  {copied ? (
                    <Check className="size-4" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                </Button>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" onClick={() => setOpen(false)}>
                Done
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
