import type { AgentSessionStatus, AgentSessionType } from "@/lib/db/schema";

export const AGENT_TYPE_LABEL: Record<AgentSessionType, string> = {
  claude_code: "Claude Code",
  codex: "Codex",
  copilot: "Copilot",
  custom: "Custom",
};

export interface SessionStatusMeta {
  label: string;
  dot: string; // bg-* for the status dot
  text: string; // text-* for labels
  pulse: boolean;
}

// Per DESIGN/ARCHITECTURE: green = idle/working, amber = needs_attention,
// gray = offline. working/needs_attention pulse.
export const SESSION_STATUS_META: Record<AgentSessionStatus, SessionStatusMeta> =
  {
    idle: {
      label: "Idle",
      dot: "bg-emerald-500",
      text: "text-emerald-400",
      pulse: false,
    },
    working: {
      label: "Working",
      dot: "bg-emerald-500",
      text: "text-emerald-400",
      pulse: true,
    },
    needs_attention: {
      label: "Needs attention",
      dot: "bg-amber-500",
      text: "text-amber-400",
      pulse: true,
    },
    offline: {
      label: "Offline",
      dot: "bg-slate-500",
      text: "text-muted-foreground",
      pulse: false,
    },
  };
