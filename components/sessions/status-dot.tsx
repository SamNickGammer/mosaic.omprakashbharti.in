import { cn } from "@/lib/utils";
import { SESSION_STATUS_META } from "@/lib/session-meta";
import type { AgentSessionStatus } from "@/lib/db/schema";

export function StatusDot({
  status,
  className,
}: {
  status: AgentSessionStatus;
  className?: string;
}) {
  const meta = SESSION_STATUS_META[status];
  return (
    <span className={cn("relative flex size-2.5", className)}>
      {meta.pulse ? (
        <span
          className={cn(
            "absolute inline-flex size-full animate-ping rounded-full opacity-60",
            meta.dot,
          )}
        />
      ) : null}
      <span
        className={cn("relative inline-flex size-2.5 rounded-full", meta.dot)}
      />
    </span>
  );
}
