"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeftRight,
  Bot,
  Crown,
  Loader2,
  Plus,
  Radio,
  SendHorizontal,
  Trash2,
  User,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Markdown } from "@/components/markdown";
import { StatusDot } from "@/components/sessions/status-dot";
import { NewSessionDialog } from "@/components/sessions/new-session-dialog";
import { AGENT_TYPE_LABEL } from "@/lib/session-meta";
import { cn } from "@/lib/utils";
import {
  useRevokeSession,
  useRoom,
  usePostRoomMessage,
  useSessions,
  useSetSessionDefault,
  type RoomMessageView,
  type RoomParticipant,
} from "@/hooks/queries";

export function RoomView({ projectId }: { projectId: string }) {
  const { data: room, isLoading } = useRoom(projectId);
  const { data: sessions } = useSessions(projectId);
  const post = usePostRoomMessage(projectId);
  const setDefault = useSetSessionDefault(projectId);
  const revoke = useRevokeSession(projectId);
  const qc = useQueryClient();

  const [draft, setDraft] = useState("");
  // Addressee: null = room / default agent; otherwise a participant id.
  const [to, setTo] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const participants = useMemo(
    () => room?.participants ?? [],
    [room?.participants],
  );
  const messages = room?.messages ?? [];
  const byId = useMemo(
    () => new Map(participants.map((p) => [p.id, p])),
    [participants],
  );

  // Live updates: any room_message event re-fetches the thread.
  useEffect(() => {
    if (!projectId) return;
    const es = new EventSource(`/api/projects/${projectId}/room/stream`);
    es.addEventListener("room_message", () => {
      qc.invalidateQueries({ queryKey: ["room", projectId] });
    });
    return () => es.close();
  }, [projectId, qc]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length]);

  // Drop a stale addressee if that agent was revoked.
  useEffect(() => {
    if (to && !byId.has(to)) setTo(null);
  }, [to, byId]);

  async function submit() {
    const content = draft.trim();
    if (!content || post.isPending) return;
    setDraft("");
    await post.mutateAsync({ content, to });
  }

  const defaultAgent = participants.find((p) => p.isDefault) ?? null;

  return (
    <div className="mx-auto flex h-full max-w-5xl flex-col gap-4 p-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Room</h1>
          <p className="text-sm text-muted-foreground">
            One shared workspace for every agent on this project. Ask the default
            agent, or address one directly — they can bring each other in.
          </p>
        </div>
        <NewSessionDialog
          projectId={projectId}
          trigger={
            <Button>
              <Plus className="size-4" /> Add agent
            </Button>
          }
        />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-[16rem_1fr]">
        {/* Participants */}
        <div className="space-y-2 md:overflow-auto">
          <p className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Agents
          </p>
          {isLoading ? (
            <Skeleton className="h-20 rounded-xl" />
          ) : participants.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center gap-2 py-6 text-center">
                <Radio className="size-5 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No agents connected yet.
                </p>
              </CardContent>
            </Card>
          ) : (
            participants.map((p) => (
              <ParticipantCard
                key={p.id}
                p={p}
                onSetDefault={() => setDefault.mutate(p.id)}
                onRevoke={() => {
                  if (
                    confirm(
                      `Remove "${p.name}" from the room? Its token stops working immediately.`,
                    )
                  ) {
                    revoke.mutate(p.id);
                  }
                }}
                busy={setDefault.isPending || revoke.isPending}
              />
            ))
          )}
        </div>

        {/* Chat */}
        <Card className="flex min-h-0 flex-col">
          <div
            ref={scrollRef}
            className="min-h-0 flex-1 space-y-4 overflow-auto p-4"
          >
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-12 w-2/3" />
                <Skeleton className="ml-auto h-10 w-1/2" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
                <p className="font-medium">Start the conversation</p>
                <p className="max-w-sm">
                  {defaultAgent
                    ? `Ask ${defaultAgent.name} anything, or @-address another agent below.`
                    : "Add an agent to start talking to this project."}
                </p>
              </div>
            ) : (
              messages.map((m) => (
                <RoomBubble
                  key={m.id}
                  m={m}
                  isDefaultAuthor={
                    m.authorSessionId != null &&
                    m.authorSessionId === room?.defaultSessionId
                  }
                />
              ))
            )}
          </div>

          {/* Composer */}
          <div className="border-t p-3">
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-foreground">To:</span>
              <AddresseeChip
                active={to === null}
                onClick={() => setTo(null)}
                label={
                  defaultAgent ? `${defaultAgent.name} (default)` : "Room"
                }
              />
              {participants
                .filter((p) => !p.isDefault)
                .map((p) => (
                  <AddresseeChip
                    key={p.id}
                    active={to === p.id}
                    onClick={() => setTo(p.id)}
                    label={p.name}
                  />
                ))}
            </div>
            <div className="flex items-end gap-2 rounded-xl border bg-background p-2 focus-within:border-ring">
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void submit();
                  }
                }}
                placeholder={
                  participants.length === 0
                    ? "Add an agent first…"
                    : "Message the room…  (Enter to send)"
                }
                rows={1}
                disabled={participants.length === 0}
                className="max-h-40 min-h-9 resize-none border-0 bg-transparent p-1 shadow-none focus-visible:ring-0"
              />
              <Button
                size="icon"
                aria-label="Send message"
                disabled={!draft.trim() || post.isPending}
                onClick={() => void submit()}
              >
                {post.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <SendHorizontal className="size-4" />
                )}
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Keep revoked/legacy sessions visible for cleanup awareness. */}
      {sessions && sessions.some((s) => s.revoked) ? (
        <p className="text-xs text-muted-foreground">
          {sessions.filter((s) => s.revoked).length} revoked token(s) hidden.
        </p>
      ) : null}
    </div>
  );
}

function AddresseeChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border text-muted-foreground hover:bg-muted",
      )}
    >
      {label}
    </button>
  );
}

function ParticipantCard({
  p,
  onSetDefault,
  onRevoke,
  busy,
}: {
  p: RoomParticipant;
  onSetDefault: () => void;
  onRevoke: () => void;
  busy: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-2.5 py-3">
        <StatusDot status={p.status} className="mt-1.5" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-medium">{p.name}</p>
            {p.isDefault ? (
              <Badge variant="outline" className="gap-1 border-amber-500/40 text-amber-500">
                <Crown className="size-3" /> Default
              </Badge>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            {AGENT_TYPE_LABEL[p.agentType]}
          </p>
          <div className="mt-1.5 flex items-center gap-1">
            {!p.isDefault ? (
              <Button
                variant="outline"
                size="sm"
                className="h-6 px-2 text-xs"
                disabled={busy}
                onClick={onSetDefault}
              >
                Make default
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Remove ${p.name}`}
              className="size-6 text-muted-foreground hover:text-destructive"
              disabled={busy}
              onClick={onRevoke}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RoomBubble({
  m,
  isDefaultAuthor,
}: {
  m: RoomMessageView;
  isDefaultAuthor: boolean;
}) {
  const isUser = m.authorKind === "user";
  // Agent talking to another agent = behind-the-scenes chatter, shown soft.
  const isInterAgent = !isUser && m.mentionSessionId != null;

  if (isInterAgent) {
    return (
      <div className="flex items-start gap-2 pl-9 text-muted-foreground/80">
        <ArrowLeftRight className="mt-0.5 size-3.5 shrink-0 opacity-60" />
        <div className="min-w-0 space-y-0.5">
          <p className="text-[11px] font-medium uppercase tracking-wide opacity-70">
            {m.authorName ?? "Agent"} → {m.mentionName ?? "agent"}
          </p>
          <p className="whitespace-pre-wrap break-words text-xs italic leading-relaxed">
            {m.content}
          </p>
        </div>
      </div>
    );
  }

  const author = isUser ? "You" : m.authorName ?? "Agent";

  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full",
          isUser
            ? "bg-secondary text-secondary-foreground"
            : "bg-gradient-brand text-white",
        )}
      >
        {isUser ? <User className="size-4" /> : <Bot className="size-4" />}
      </div>
      <div className={cn("min-w-0 max-w-[85%] space-y-1", isUser && "items-end")}>
        <p
          className={cn(
            "flex items-center gap-1.5 text-xs font-medium text-muted-foreground",
            isUser && "justify-end text-right",
          )}
        >
          {author}
          {!isUser && m.agentType ? (
            <span className="font-normal opacity-70">
              · {AGENT_TYPE_LABEL[m.agentType]}
            </span>
          ) : null}
          {isDefaultAuthor ? (
            <span className="inline-flex items-center gap-0.5 rounded-full border border-amber-500/40 px-1.5 text-[10px] font-medium text-amber-500">
              <Crown className="size-2.5" /> Lead
            </span>
          ) : null}
        </p>
        <div
          className={cn(
            "rounded-xl px-3.5 py-2.5 text-sm leading-relaxed",
            isUser
              ? "bg-primary text-primary-foreground"
              : isDefaultAuthor
                ? "border border-amber-500/25 bg-amber-500/5 text-card-foreground"
                : "border bg-card text-card-foreground",
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap break-words">{m.content}</p>
          ) : (
            <Markdown content={m.content} />
          )}
        </div>
      </div>
    </div>
  );
}
