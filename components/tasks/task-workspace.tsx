"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  CircleDot,
  Loader2,
  Paperclip,
  Pencil,
  Play,
  RotateCcw,
  SendHorizontal,
  Trash2,
  TriangleAlert,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PriorityBadge, StatusBadge } from "@/components/board/badges";
import { MessageBubble } from "@/components/chat/message-bubble";
import { Markdown } from "@/components/markdown";
import { StatusDot } from "@/components/sessions/status-dot";
import { EditTaskDialog } from "@/components/board/edit-task-dialog";
import { cn } from "@/lib/utils";
import {
  useDeleteTask,
  usePostTaskMessage,
  useSessions,
  useTask,
  useTaskMessages,
  useUpdateTask,
  type ChatMessage,
} from "@/hooks/queries";
import type { Task } from "@/types";

const MAX_CHARS = 200_000;

interface Grouped {
  key: string;
  kind: "user" | "stream" | "comment";
  text: string;
}

function groupMessages(messages: ChatMessage[]): Grouped[] {
  const out: Grouped[] = [];
  for (const m of messages) {
    if (m.role === "user") {
      out.push({ key: m.id, kind: "user", text: m.content });
    } else if (m.isStreamChunk) {
      const last = out[out.length - 1];
      if (last && last.kind === "stream") last.text += m.content;
      else out.push({ key: m.id, kind: "stream", text: m.content });
    } else {
      out.push({ key: m.id, kind: "comment", text: m.content });
    }
  }
  return out;
}

export function TaskWorkspace({
  clientId,
  projectId,
  initialTask,
}: {
  clientId: string;
  projectId: string;
  initialTask: Task;
}) {
  const qc = useQueryClient();
  const router = useRouter();
  const { data: task = initialTask } = useTask(initialTask.id);
  const { data: messages } = useTaskMessages(initialTask.id);
  const { data: sessions } = useSessions(projectId);
  const update = useUpdateTask(projectId);
  const del = useDeleteTask(projectId);
  const post = usePostTaskMessage(initialTask.id);

  const [live, setLive] = useState("");
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const claimingSession = useMemo(
    () => sessions?.find((s) => s.id === task.claimedBySessionId) ?? null,
    [sessions, task.claimedBySessionId],
  );

  // Live SSE stream of session output for this task.
  useEffect(() => {
    const es = new EventSource(`/api/tasks/${initialTask.id}/stream`);
    es.addEventListener("chunk", (e) => {
      try {
        const d = JSON.parse((e as MessageEvent).data);
        setLive((prev) => prev + (d.content ?? ""));
      } catch {
        /* ignore */
      }
    });
    es.addEventListener("attention", () => {
      qc.invalidateQueries({ queryKey: ["task", initialTask.id] });
    });
    es.addEventListener("complete", () => {
      setLive("");
      qc.invalidateQueries({ queryKey: ["task", initialTask.id] });
      qc.invalidateQueries({ queryKey: ["task-messages", initialTask.id] });
    });
    es.addEventListener("status", () => {
      qc.invalidateQueries({ queryKey: ["task", initialTask.id] });
      qc.invalidateQueries({ queryKey: ["sessions", projectId] });
    });
    return () => es.close();
  }, [initialTask.id, projectId, qc]);

  const groups = useMemo(() => groupMessages(messages ?? []), [messages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [groups, live]);

  async function send() {
    const text = draft.trim();
    if (!text || post.isPending) return;
    setDraft("");
    await post.mutateAsync(text);
  }

  const isWorking = claimingSession?.status === "working";
  // A message re-queues unless a live session is actively working this task.
  const willRequeue = !(
    task.status === "in_progress" && claimingSession?.status === "working"
  );

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      {/* Left: task details */}
      <div className="space-y-5 overflow-auto border-r p-6">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={task.status} />
          <PriorityBadge priority={task.priority} />
        </div>
        <h1 className="text-2xl font-bold leading-tight tracking-tight">
          {task.title}
        </h1>

        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Instructions
          </h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
            {task.instructions || "No instructions provided."}
          </p>
        </div>

        <div>
          <h2 className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Paperclip className="size-3" /> Attachments
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            No attachments. File upload arrives with Vercel Blob.
          </p>
        </div>

        {/* Force status — override the agent without posting a comment */}
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-amber-500">
            Force status
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Override the agent without posting a comment. Use when a task is
            stuck and you want to re-claim it, or to mark something done by hand.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={update.isPending}
              title="Re-queue: make this task claimable by any session"
              onClick={() =>
                update.mutate({
                  id: task.id,
                  status: "in_progress",
                  clearClaim: true,
                  attentionMessage: null,
                })
              }
            >
              <RotateCcw className="size-4" /> Queue
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={update.isPending}
              title="Mark as actively running"
              onClick={() =>
                update.mutate({
                  id: task.id,
                  status: "in_progress",
                  attentionMessage: null,
                })
              }
            >
              <Play className="size-4" /> Running
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={update.isPending}
              title="Flag that this task needs your attention"
              onClick={() =>
                update.mutate({
                  id: task.id,
                  attentionMessage: "Flagged for your attention — please review.",
                })
              }
            >
              <TriangleAlert className="size-4" /> Needs you
            </Button>
            <Button
              size="sm"
              disabled={update.isPending || task.status === "done"}
              onClick={() => update.mutate({ id: task.id, status: "done" })}
            >
              <CheckCircle2 className="size-4" /> Done
            </Button>
          </div>
        </div>

        {/* Task actions */}
        <div className="rounded-xl border p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Task actions
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <EditTaskDialog
              projectId={projectId}
              task={task}
              trigger={
                <Button variant="outline" size="sm">
                  <Pencil className="size-4" /> Edit
                </Button>
              }
            />
            <Button
              variant="outline"
              size="sm"
              disabled={del.isPending}
              className="text-destructive hover:text-destructive"
              onClick={() => {
                if (confirm(`Delete "${task.title}"? This cannot be undone.`)) {
                  del.mutate(task.id, {
                    onSuccess: () =>
                      router.push(
                        `/clients/${clientId}/projects/${projectId}`,
                      ),
                  });
                }
              }}
            >
              <Trash2 className="size-4" /> Delete
            </Button>
          </div>
        </div>
      </div>

      {/* Right: live session output */}
      <div className="flex min-h-0 flex-col">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          {claimingSession ? (
            <>
              <StatusDot status={claimingSession.status} />
              <span className="text-sm font-medium">{claimingSession.name}</span>
            </>
          ) : (
            <>
              <CircleDot className="size-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                No session attached yet
              </span>
            </>
          )}
        </div>

        {task.attentionMessage ? (
          <div className="flex items-start gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-medium">Session needs your input</p>
              <p className="text-amber-400/90">{task.attentionMessage}</p>
            </div>
          </div>
        ) : null}

        {task.status === "done" ? (
          <div className="flex items-start gap-2 border-b border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-medium">Task complete</p>
              {task.result ? (
                <p className="text-emerald-400/90">{task.result}</p>
              ) : null}
            </div>
          </div>
        ) : null}

        <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-auto p-4">
          {groups.length === 0 && !live ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
              <p className="font-medium">Waiting for session output</p>
              <p className="max-w-sm">
                Queue this task and a connected session will pick it up, then
                stream its work here in real time.
              </p>
            </div>
          ) : (
            groups.map((g) =>
              g.kind === "user" ? (
                <MessageBubble key={g.key} role="user" content={g.text} />
              ) : g.kind === "comment" ? (
                <MessageBubble
                  key={g.key}
                  role="assistant"
                  content={g.text}
                  agentName={claimingSession?.name}
                />
              ) : (
                <StreamBlock key={g.key} text={g.text} />
              ),
            )
          )}

          {live ? <StreamBlock text={live} streaming /> : null}
          {isWorking && !live ? (
            <div className="flex items-center gap-2 text-xs text-mosaic-teal">
              <span className="streaming-dot" />
              <span className="streaming-dot" />
              <span className="streaming-dot" />
              <span className="text-muted-foreground">Session is working…</span>
            </div>
          ) : null}
        </div>

        <div className="border-t p-3">
          {willRequeue ? (
            <p className="mb-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              {task.status === "done"
                ? "This task is marked done. "
                : ""}
              Sending a message <span className="font-medium">re-queues it</span>{" "}
              — the next agent poll picks it up with your message and the
              existing result attached.
            </p>
          ) : null}
          <div className="rounded-xl border bg-background p-2 focus-within:border-ring">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, MAX_CHARS))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder={
                willRequeue
                  ? "Add a follow-up — ⌘/Ctrl+Enter to send and re-queue"
                  : "Reply to the session — ⌘/Ctrl+Enter to send"
              }
              rows={2}
              className="max-h-48 min-h-12 resize-none border-0 bg-transparent p-1 shadow-none focus-visible:ring-0"
            />
            <div className="mt-1 flex items-center justify-between gap-2 px-1">
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <button
                  type="button"
                  disabled
                  title="File upload arrives with Vercel Blob"
                  className="inline-flex items-center gap-1 opacity-50"
                >
                  <Paperclip className="size-3.5" /> Attach
                </button>
                <span>
                  {draft.length.toLocaleString()} /{" "}
                  {MAX_CHARS.toLocaleString()} · ⌘ Enter to send
                </span>
              </div>
              <Button
                size="sm"
                disabled={!draft.trim() || post.isPending}
                onClick={() => void send()}
              >
                {post.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <SendHorizontal className="size-4" />
                )}
                {willRequeue ? "Send + Re-queue" : "Send"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StreamBlock({
  text,
  streaming,
}: {
  text: string;
  streaming?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-muted/40 p-3 text-foreground/90",
        streaming && "border-mosaic-teal/30",
      )}
    >
      {streaming ? (
        <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed">
          {text}
          <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-mosaic-teal align-middle" />
        </pre>
      ) : (
        <Markdown content={text} />
      )}
    </div>
  );
}
