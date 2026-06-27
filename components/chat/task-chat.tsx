"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, MessageSquare, SendHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageBubble } from "@/components/chat/message-bubble";
import { useAgents, useTaskMessages } from "@/hooks/queries";

export function TaskChat({ taskId }: { taskId: string }) {
  const qc = useQueryClient();
  const { data: messages, isLoading } = useTaskMessages(taskId);
  const { data: agents } = useAgents();

  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [agentName, setAgentName] = useState<string | null>(null);
  const [pendingUser, setPendingUser] = useState<string | null>(null);
  const [assistantDraft, setAssistantDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  const agentNameById = useMemo(() => {
    const map = new Map<string, string>();
    (agents ?? []).forEach((a) => map.set(a.id, a.displayName));
    return map;
  }, [agents]);

  // Auto-scroll to the latest content.
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, pendingUser, assistantDraft, streaming]);

  function handleEvent(block: string) {
    let event = "message";
    let dataStr = "";
    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) dataStr += line.slice(5).trim();
    }
    let data: { content?: string; agentName?: string; message?: string } = {};
    try {
      if (dataStr) data = JSON.parse(dataStr);
    } catch {
      return;
    }

    switch (event) {
      case "primary_start":
        setAgentName(data.agentName ?? "Agent");
        break;
      case "primary_stream":
        setAssistantDraft((prev) => prev + (data.content ?? ""));
        break;
      case "error":
        setError(data.message ?? "Something went wrong");
        break;
      // primary_done / done handled by stream completion
    }
  }

  async function send() {
    const text = draft.trim();
    if (!text || streaming) return;

    setDraft("");
    setError(null);
    setPendingUser(text);
    setAssistantDraft("");
    setAgentName(null);
    setStreaming(true);

    try {
      const res = await fetch(`/api/tasks/${taskId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      if (!res.ok || !res.body) {
        const t = await res.text().catch(() => "");
        setError(t || "Request failed");
        setStreaming(false);
        setPendingUser(null);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";
        for (const block of blocks) {
          if (block.trim()) handleEvent(block);
        }
      }
      if (buffer.trim()) handleEvent(buffer);
    } catch {
      setError("Connection lost. Please try again.");
    } finally {
      await qc.invalidateQueries({ queryKey: ["task-messages", taskId] });
      setStreaming(false);
      setAgentName(null);
      setPendingUser(null);
      setAssistantDraft("");
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  const isEmpty =
    !isLoading && (messages?.length ?? 0) === 0 && !pendingUser && !streaming;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-auto p-4">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-16 w-2/3" />
            <Skeleton className="ml-auto h-12 w-1/2" />
          </div>
        ) : isEmpty ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <div className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <MessageSquare className="size-6" />
            </div>
            <div>
              <p className="font-medium">Start the conversation</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Send a message and the project&apos;s primary agent will respond,
                with your project context applied automatically.
              </p>
            </div>
          </div>
        ) : (
          <>
            {messages?.map((m) =>
              m.role === "user" || m.role === "assistant" ? (
                <MessageBubble
                  key={m.id}
                  role={m.role}
                  content={m.content}
                  agentName={m.agentId ? agentNameById.get(m.agentId) : null}
                />
              ) : null,
            )}

            {pendingUser ? (
              <MessageBubble role="user" content={pendingUser} />
            ) : null}

            {streaming ? (
              <MessageBubble role="assistant" agentName={agentName}>
                {assistantDraft ? (
                  <p className="whitespace-pre-wrap break-words">
                    {assistantDraft}
                  </p>
                ) : (
                  <span className="flex items-center gap-2 text-mosaic-teal">
                    <span className="streaming-dot" />
                    <span className="streaming-dot" />
                    <span className="streaming-dot" />
                    <span className="text-xs text-muted-foreground">
                      {agentName ? `${agentName} is analyzing…` : "Thinking…"}
                    </span>
                  </span>
                )}
              </MessageBubble>
            ) : null}
          </>
        )}

        {error ? (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}
      </div>

      <div className="border-t p-3">
        <div className="flex items-end gap-2 rounded-xl border bg-background p-2 focus-within:border-ring">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Message the primary agent…  (Enter to send, Shift+Enter for newline)"
            rows={1}
            className="max-h-40 min-h-9 resize-none border-0 bg-transparent p-1 shadow-none focus-visible:ring-0"
          />
          <Button
            size="icon"
            aria-label="Send message"
            disabled={!draft.trim() || streaming}
            onClick={() => void send()}
          >
            <SendHorizontal className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
