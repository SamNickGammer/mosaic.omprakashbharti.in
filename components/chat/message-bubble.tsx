import { Bot, User } from "lucide-react";

import { cn } from "@/lib/utils";
import { Markdown } from "@/components/markdown";

export function MessageBubble({
  role,
  content,
  agentName,
  children,
}: {
  role: "user" | "assistant";
  content?: string;
  agentName?: string | null;
  children?: React.ReactNode;
}) {
  const isUser = role === "user";
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
        {!isUser && agentName ? (
          <p className="text-xs font-medium text-muted-foreground">
            {agentName}
          </p>
        ) : null}
        <div
          className={cn(
            "rounded-xl px-3.5 py-2.5 text-sm leading-relaxed",
            isUser
              ? "bg-primary text-primary-foreground"
              : "border bg-card text-card-foreground",
          )}
        >
          {children ??
            (isUser ? (
              <p className="whitespace-pre-wrap break-words">{content}</p>
            ) : (
              <Markdown content={content ?? ""} />
            ))}
        </div>
      </div>
    </div>
  );
}
