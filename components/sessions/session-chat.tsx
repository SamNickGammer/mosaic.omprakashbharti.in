"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, SendHorizontal, WifiOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageBubble } from "@/components/chat/message-bubble";
import { StatusDot } from "@/components/sessions/status-dot";
import { AGENT_TYPE_LABEL, SESSION_STATUS_META } from "@/lib/session-meta";
import { useSendSessionChat, useSessionChat } from "@/hooks/queries";

export function SessionChat({ sessionId }: { sessionId: string }) {
  const { data, isLoading } = useSessionChat(sessionId);
  const send = useSendSessionChat(sessionId);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const messages = data?.messages ?? [];
  const session = data?.session;

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length]);

  async function submit() {
    const text = draft.trim();
    if (!text || send.isPending) return;
    setDraft("");
    await send.mutateAsync(text);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        {session ? (
          <>
            <StatusDot status={session.status} />
            <span className="text-sm font-medium">{session.name}</span>
            <span className="text-xs text-muted-foreground">
              {AGENT_TYPE_LABEL[session.agentType]} ·{" "}
              {SESSION_STATUS_META[session.status].label}
            </span>
          </>
        ) : (
          <Skeleton className="h-5 w-40" />
        )}
      </div>

      {session?.status === "offline" ? (
        <div className="flex items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-400">
          <WifiOff className="size-4" />
          Session is offline — it&apos;ll see your messages when it reconnects.
        </div>
      ) : null}

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-auto p-4">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-12 w-2/3" />
            <Skeleton className="ml-auto h-10 w-1/2" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
            <p className="font-medium">Talk to your session</p>
            <p className="max-w-sm">
              Ask a quick question or request a status update. The session reads
              your message in the real project folder and replies here.
            </p>
          </div>
        ) : (
          messages.map((m, i) => (
            <MessageBubble
              key={i}
              role={m.authorKind === "user" ? "user" : "assistant"}
              content={m.content}
              agentName={m.authorKind === "agent" ? session?.name : null}
            />
          ))
        )}
      </div>

      <div className="border-t p-3">
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
            placeholder="Message the session…  (Enter to send)"
            rows={1}
            className="max-h-40 min-h-9 resize-none border-0 bg-transparent p-1 shadow-none focus-visible:ring-0"
          />
          <Button
            size="icon"
            aria-label="Send message"
            disabled={!draft.trim() || send.isPending}
            onClick={() => void submit()}
          >
            {send.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <SendHorizontal className="size-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
