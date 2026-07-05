"use client";

import { useState, type ReactElement } from "react";
import { Check, CircleCheck, Copy, TriangleAlert } from "lucide-react";

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

  // Close via a button: base-ui doesn't re-fire onOpenChange when we flip the
  // controlled `open` prop ourselves, so reset here too or the next open shows
  // the stale "created" screen.
  function close() {
    setOpen(false);
    reset();
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
        // Always start fresh on open (and clean up on close).
        reset();
      }}
    >
      {trigger ? <DialogTrigger render={trigger} /> : null}
      <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-xl">
        {!created ? (
          <form onSubmit={onSubmit}>
            <DialogHeader>
              <DialogTitle>Add an agent</DialogTitle>
              <DialogDescription>
                Connect a live AI process to this project&apos;s room. It shares
                the task queue and chat with the other agents here.
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
              <Button type="button" variant="outline" onClick={close}>
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
              <DialogTitle className="flex items-center gap-2">
                <CircleCheck className="size-5 text-emerald-500" />
                {created.session.name} is connected
              </DialogTitle>
              <DialogDescription>
                Paste the bootstrap prompt below into a fresh{" "}
                {AGENT_TYPE_LABEL[agentType]} session running inside this
                project&apos;s folder. The agent then self-drives off this room.
              </DialogDescription>
            </DialogHeader>

            <div className="min-w-0 space-y-4 py-4">
              <div className="flex min-w-0 items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-500">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                <div className="min-w-0 space-y-1">
                  <p className="font-medium">
                    Copy this now — the token is shown only once.
                  </p>
                  <p className="text-xs text-amber-500/80">
                    Token prefix{" "}
                    <code className="rounded bg-amber-500/15 px-1 py-0.5 font-mono">
                      {created.session.tokenPrefix}…
                    </code>
                  </p>
                </div>
              </div>

              <div className="min-w-0 overflow-hidden rounded-xl border bg-card">
                <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Bootstrap prompt
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant={copied ? "outline" : "default"}
                    className="h-7 gap-1.5 px-2.5 text-xs"
                    onClick={copyPrompt}
                  >
                    {copied ? (
                      <>
                        <Check className="size-3.5" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="size-3.5" /> Copy prompt
                      </>
                    )}
                  </Button>
                </div>
                <pre className="no-scrollbar max-h-[22rem] min-w-0 overflow-y-auto overflow-x-hidden whitespace-pre-wrap [overflow-wrap:anywhere] bg-background/40 p-3.5 font-mono text-[11px] leading-relaxed text-muted-foreground">
                  {created.bootstrapPrompt}
                </pre>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" onClick={close}>
                Done
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
