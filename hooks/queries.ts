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
      bookmarked?: boolean;
      clearBefore?: boolean;
      compactBefore?: boolean;
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
  isDefault: boolean;
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
    mutationFn: (input: {
      name: string;
      agentType: AgentSessionType;
      makeDefault?: boolean;
    }) =>
      apiSend<CreatedSession>(`/api/projects/${projectId}/sessions`, "POST", input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sessions", projectId] });
      qc.invalidateQueries({ queryKey: ["room", projectId] });
      qc.invalidateQueries({ queryKey: ["overview"] });
    },
  });
}

export function useRevokeSession(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) =>
      apiSend(`/api/projects/${projectId}/sessions/${sessionId}`, "DELETE"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sessions", projectId] });
      qc.invalidateQueries({ queryKey: ["room", projectId] });
      qc.invalidateQueries({ queryKey: ["overview"] });
    },
  });
}

export function useSetSessionDefault(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) =>
      apiSend(`/api/projects/${projectId}/sessions/${sessionId}`, "PATCH", {
        makeDefault: true,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sessions", projectId] });
      qc.invalidateQueries({ queryKey: ["room", projectId] });
    },
  });
}

// ---------------------------------------------------------------------------
// Project room (shared multi-agent chat + debate)
// ---------------------------------------------------------------------------
export interface RoomParticipant {
  id: string;
  name: string;
  agentType: AgentSessionType;
  status: AgentSessionStatus;
  isDefault: boolean;
  lastSeenAt: string | null;
}

export interface RoomMessageView {
  id: string;
  authorKind: "user" | "agent";
  authorSessionId: string | null;
  authorName: string | null;
  agentType: AgentSessionType | null;
  mentionSessionId: string | null;
  mentionName: string | null;
  content: string;
  createdAt: number;
}

export interface RoomData {
  projectId: string;
  defaultSessionId: string | null;
  participants: RoomParticipant[];
  messages: RoomMessageView[];
}

export function useRoom(projectId: string) {
  return useQuery({
    enabled: !!projectId,
    queryKey: ["room", projectId],
    queryFn: () => apiGet<RoomData>(`/api/projects/${projectId}/room`),
    refetchInterval: 3000,
  });
}

export function usePostRoomMessage(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { content: string; to?: string | null }) =>
      apiSend(`/api/projects/${projectId}/room`, "POST", input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["room", projectId] });
    },
  });
}

// ---------------------------------------------------------------------------
// Connectors (client-scoped external services agents can use)
// ---------------------------------------------------------------------------
export type ConnectorType =
  | "slack"
  | "gmail"
  | "google"
  | "whatsapp"
  | "github"
  | "custom";

export interface ConnectorView {
  id: string;
  type: ConnectorType;
  name: string;
  account: string | null;
  details: string | null;
  hasSecret: boolean;
  createdAt: string;
}

export interface ConnectorInput {
  type: ConnectorType;
  name: string;
  account?: string;
  details?: string;
  secret?: string;
}

export function useConnectors(clientId: string) {
  return useQuery({
    enabled: !!clientId,
    queryKey: ["connectors", clientId],
    queryFn: () =>
      apiGet<{ connectors: ConnectorView[] }>(
        `/api/clients/${clientId}/connectors`,
      ).then((r) => r.connectors),
  });
}

export function useCreateConnector(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ConnectorInput) =>
      apiSend(`/api/clients/${clientId}/connectors`, "POST", input),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["connectors", clientId] }),
  });
}

export function useUpdateConnector(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      connectorId,
      ...input
    }: Partial<ConnectorInput> & { connectorId: string; secret?: string | null }) =>
      apiSend(
        `/api/clients/${clientId}/connectors/${connectorId}`,
        "PATCH",
        input,
      ),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["connectors", clientId] }),
  });
}

export function useDeleteConnector(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (connectorId: string) =>
      apiSend(`/api/clients/${clientId}/connectors/${connectorId}`, "DELETE"),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["connectors", clientId] }),
  });
}

// ---------------------------------------------------------------------------
// Review (tasks bookmarked for review, across all clients)
// ---------------------------------------------------------------------------
export interface ReviewTask {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  updatedAt: string;
  projectId: string;
  projectName: string;
  clientId: string;
  clientName: string;
  clientColor: string | null;
}

export function useReview() {
  return useQuery({
    queryKey: ["review"],
    queryFn: () =>
      apiGet<{ tasks: ReviewTask[] }>("/api/review").then((r) => r.tasks),
    refetchInterval: 15000,
  });
}

export function useUnbookmark() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) =>
      apiSend(`/api/tasks/${taskId}`, "PATCH", { bookmarked: false }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["review"] }),
  });
}

// ---------------------------------------------------------------------------
// Task attachments
// ---------------------------------------------------------------------------
export interface TaskAttachment {
  id: string;
  name: string;
  url: string;
  mime: string | null;
  sizeBytes: number | null;
  createdAt: string;
}

export function useTaskAttachments(taskId: string) {
  return useQuery({
    enabled: !!taskId,
    queryKey: ["attachments", taskId],
    queryFn: () =>
      apiGet<{ attachments: TaskAttachment[] }>(
        `/api/tasks/${taskId}/attachments`,
      ).then((r) => r.attachments),
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
