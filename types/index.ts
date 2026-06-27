import type {
  AgentProviderId,
  TaskPriority,
  TaskStatus,
} from "@/lib/db/schema";

export type {
  AgentAccount,
  AgentProviderId,
  Client,
  MessageRole,
  OrchestrationTrace,
  Project,
  ProjectAgent,
  ProjectAgentRole,
  Task,
  TaskMessage,
  TaskPriority,
  TaskStatus,
  TraceRole,
  User,
} from "@/lib/db/schema";

// ---------------------------------------------------------------------------
// Provider registry (UI metadata for the agent settings page)
// ---------------------------------------------------------------------------
export interface ProviderMeta {
  id: AgentProviderId;
  label: string;
  /** Suggested models shown in the model picker. */
  models: string[];
  /** Whether a custom base URL is required (OpenAI-compatible endpoints). */
  requiresBaseUrl: boolean;
  keyPlaceholder: string;
}

export const PROVIDERS: ProviderMeta[] = [
  {
    id: "anthropic",
    label: "Anthropic (Claude)",
    models: [
      "claude-opus-4-6",
      "claude-sonnet-4-6",
      "claude-haiku-4-5",
    ],
    requiresBaseUrl: false,
    keyPlaceholder: "sk-ant-...",
  },
  {
    id: "openai",
    label: "OpenAI (GPT / Codex)",
    models: ["gpt-4o", "gpt-4o-mini", "o4-mini", "codex"],
    requiresBaseUrl: false,
    keyPlaceholder: "sk-...",
  },
  {
    id: "github_copilot",
    label: "GitHub Copilot",
    models: ["gpt-4o-copilot"],
    requiresBaseUrl: false,
    keyPlaceholder: "ghu_...",
  },
  {
    id: "custom",
    label: "Custom (OpenAI-compatible)",
    models: [],
    requiresBaseUrl: true,
    keyPlaceholder: "your-api-key",
  },
];

export function providerLabel(id: AgentProviderId): string {
  return PROVIDERS.find((p) => p.id === id)?.label ?? id;
}

// ---------------------------------------------------------------------------
// Kanban board columns
// ---------------------------------------------------------------------------
export const TASK_STATUSES: { id: TaskStatus; label: string }[] = [
  { id: "backlog", label: "Backlog" },
  { id: "in_progress", label: "In Progress" },
  { id: "review", label: "Review" },
  { id: "done", label: "Done" },
];

export const TASK_PRIORITIES: { id: TaskPriority; label: string }[] = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
  { id: "critical", label: "Critical" },
];

// ---------------------------------------------------------------------------
// Public DTOs (what API routes return — never includes secrets)
// ---------------------------------------------------------------------------
export interface AgentAccountDTO {
  id: string;
  displayName: string;
  provider: AgentProviderId;
  model: string | null;
  baseUrl: string | null;
  keyPreview: string; // masked, never the real key
  createdAt: string;
}

export interface ProjectAgentDTO {
  id: string;
  displayName: string;
  provider: AgentProviderId;
  role: "primary" | "secondary";
}
