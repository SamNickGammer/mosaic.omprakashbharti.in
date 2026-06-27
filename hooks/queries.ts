"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { apiGet, apiSend } from "@/lib/fetcher";
import type {
  AgentAccountDTO,
  AgentProviderId,
  ProjectAgentDTO,
  Task,
  TaskPriority,
  TaskStatus,
} from "@/types";
import type {
  AgentSessionStatus,
  AgentSessionType,
} from "@/lib/db/schema";

// ---------------------------------------------------------------------------
// Shapes returned by the API
// ---------------------------------------------------------------------------
export interface ClientTreeProject {
  id: string;
  name: string;
}
export interface ClientTreeNode {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  description: string | null;
  archived: boolean;
  projects: ClientTreeProject[];
}

export interface ProjectDetail {
  id: string;
  clientId: string;
  name: string;
  description: string | null;
  repoUrl: string | null;
  context: string | null;
  primaryAgentId: string | null;
  agents: ProjectAgentDTO[];
}

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------
export function useClients(includeArchived = false) {
  return useQuery({
    queryKey: ["clients", { includeArchived }],
    queryFn: () =>
      apiGet<{ clients: ClientTreeNode[] }>(
        `/api/clients?archived=${includeArchived ? "1" : "0"}`,
      ).then((r) => r.clients),
  });
}

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      name: string;
      color?: string;
      icon?: string;
      description?: string;
    }) => apiSend<{ client: ClientTreeNode }>("/api/clients", "POST", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients"] }),
  });
}

export function useUpdateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...input
    }: {
      id: string;
      name?: string;
      color?: string;
      icon?: string;
      description?: string;
      archived?: boolean;
    }) => apiSend(`/api/clients/${id}`, "PATCH", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients"] }),
  });
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------
export function useProject(projectId: string | null) {
  return useQuery({
    enabled: !!projectId,
    queryKey: ["project", projectId],
    queryFn: () =>
      apiGet<{ project: ProjectDetail }>(`/api/projects/${projectId}`).then(
        (r) => r.project,
      ),
  });
}

export interface ProjectUpsertInput {
  name: string;
  description?: string;
  repoUrl?: string;
  context?: string;
  primaryAgentId?: string | null;
  secondaryAgentIds?: string[];
}

export function useCreateProject(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ProjectUpsertInput) =>
      apiSend(`/api/clients/${clientId}/projects`, "POST", input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
  });
}

export function useUpdateProject(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<ProjectUpsertInput>) =>
      apiSend(`/api/projects/${projectId}`, "PATCH", input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["project", projectId] });
    },
  });
}

// ---------------------------------------------------------------------------
// Agent accounts
// ---------------------------------------------------------------------------
export function useAgents() {
  return useQuery({
    queryKey: ["agents"],
    queryFn: () =>
      apiGet<{ agents: AgentAccountDTO[] }>("/api/settings/agents").then(
        (r) => r.agents,
      ),
  });
}

export function useCreateAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      displayName: string;
      provider: AgentProviderId;
      model?: string;
      apiKey: string;
      baseUrl?: string;
    }) => apiSend("/api/settings/agents", "POST", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agents"] }),
  });
}

export function useDeleteAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiSend(`/api/settings/agents/${id}`, "DELETE"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agents"] }),
  });
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------
export function useTasks(projectId: string) {
  return useQuery({
    enabled: !!projectId,
    queryKey: ["tasks", projectId],
    queryFn: () =>
      apiGet<{ tasks: Task[] }>(`/api/projects/${projectId}/tasks`).then(
        (r) => r.tasks,
      ),
  });
}

export function useCreateTask(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      title: string;
      instructions?: string;
      priority?: TaskPriority;
      status?: TaskStatus;
    }) => apiSend(`/api/projects/${projectId}/tasks`, "POST", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks", projectId] }),
  });
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "agent" | "agent_trace" | "system";
  authorKind: "user" | "agent";
  content: string;
  agentId: string | null;
  sessionId: string | null;
  isStreamChunk: boolean;
  createdAt: string;
}

export function useTaskMessages(taskId: string) {
  return useQuery({
    enabled: !!taskId,
    queryKey: ["task-messages", taskId],
    queryFn: () =>
      apiGet<{ messages: ChatMessage[] }>(
        `/api/tasks/${taskId}/messages`,
      ).then((r) => r.messages),
  });
}

// ---------------------------------------------------------------------------
// Agent sessions
// ---------------------------------------------------------------------------
export interface SessionRow {
  id: string;
  name: string;
  agentType: AgentSessionType;
  tokenPrefix: string;
  status: AgentSessionStatus;
  currentTaskId: string | null;
  lastSeenAt: string | null;
  revoked: boolean;
}

export interface CreatedSession {
  session: Omit<SessionRow, "revoked">;
  token: string;
  bootstrapPrompt: string;
}

export function useSessions(projectId: string) {
  return useQuery({
    enabled: !!projectId,
    queryKey: ["sessions", projectId],
    queryFn: () =>
      apiGet<{ sessions: SessionRow[] }>(
        `/api/projects/${projectId}/sessions`,
      ).then((r) => r.sessions),
    refetchInterval: 15000,
  });
}

export function useCreateSession(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; agentType: AgentSessionType }) =>
      apiSend<CreatedSession>(`/api/projects/${projectId}/sessions`, "POST", input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sessions", projectId] });
      qc.invalidateQueries({ queryKey: ["overview"] });
    },
  });
}

export function useRevokeSession(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) =>
      apiSend(`/api/sessions/${sessionId}`, "DELETE"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sessions", projectId] });
      qc.invalidateQueries({ queryKey: ["overview"] });
    },
  });
}

// ---------------------------------------------------------------------------
// Dashboard overview (sessions + attention across all projects)
// ---------------------------------------------------------------------------
export interface OverviewSession {
  id: string;
  name: string;
  agentType: AgentSessionType;
  status: AgentSessionStatus;
  currentTaskId: string | null;
  lastSeenAt: string | null;
  projectId: string;
  projectName: string;
  clientId: string;
}
export interface OverviewAttention {
  taskId: string;
  title: string;
  attentionMessage: string | null;
  projectId: string;
  projectName: string;
  clientId: string;
}

export function useOverview() {
  return useQuery({
    queryKey: ["overview"],
    queryFn: () =>
      apiGet<{ sessions: OverviewSession[]; attention: OverviewAttention[] }>(
        "/api/overview",
      ),
    refetchInterval: 15000,
  });
}

// ---------------------------------------------------------------------------
// Single task + user replies
// ---------------------------------------------------------------------------
export function useTask(taskId: string) {
  return useQuery({
    enabled: !!taskId,
    queryKey: ["task", taskId],
    queryFn: () =>
      apiGet<{ task: Task }>(`/api/tasks/${taskId}`).then((r) => r.task),
  });
}

export function usePostTaskMessage(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      apiSend(`/api/tasks/${taskId}/messages`, "POST", { body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["task-messages", taskId] });
      qc.invalidateQueries({ queryKey: ["task", taskId] });
    },
  });
}

// ---------------------------------------------------------------------------
// Direct session chat
// ---------------------------------------------------------------------------
export interface SessionChatMessage {
  authorKind: "user" | "agent";
  content: string;
  createdAt: string;
}
export interface SessionChatData {
  session: {
    id: string;
    name: string;
    agentType: AgentSessionType;
    status: AgentSessionStatus;
    projectId: string;
  };
  messages: SessionChatMessage[];
}

export function useSessionChat(sessionId: string) {
  return useQuery({
    enabled: !!sessionId,
    queryKey: ["session-chat", sessionId],
    queryFn: () => apiGet<SessionChatData>(`/api/sessions-chat/${sessionId}`),
    refetchInterval: 3000,
  });
}

export function useSendSessionChat(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (message: string) =>
      apiSend(`/api/sessions-chat/${sessionId}`, "POST", { message }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["session-chat", sessionId] }),
  });
}

export function useUpdateTask(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...input
    }: {
      id: string;
      title?: string;
      instructions?: string;
      status?: TaskStatus;
      priority?: TaskPriority;
      position?: number;
      clearClaim?: boolean;
      attentionMessage?: string | null;
    }) => apiSend<{ task: Task }>(`/api/tasks/${id}`, "PATCH", input),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["tasks", projectId] });
      qc.invalidateQueries({ queryKey: ["task", vars.id] });
      qc.invalidateQueries({ queryKey: ["sessions", projectId] });
      qc.invalidateQueries({ queryKey: ["overview"] });
    },
  });
}

export function useDeleteTask(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiSend(`/api/tasks/${id}`, "DELETE"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks", projectId] }),
  });
}
