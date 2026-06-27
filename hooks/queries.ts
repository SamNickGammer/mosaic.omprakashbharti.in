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
    }) => apiSend(`/api/tasks/${id}`, "PATCH", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks", projectId] }),
  });
}
