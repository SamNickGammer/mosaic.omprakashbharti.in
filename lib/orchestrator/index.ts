import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  agentAccounts,
  projectAgents,
  projects,
} from "@/lib/db/schema";
import type { AgentAccount, Project, Task } from "@/lib/db/schema";
import { decrypt } from "@/lib/encryption";

export interface PrimaryAgentContext {
  project: Project;
  agent: AgentAccount;
  /** Decrypted API key — keep in memory only, never log or persist. */
  apiKey: string;
}

/**
 * Resolves the primary agent for a task's project and decrypts its key.
 * Prefers the `project_agents` row with role='primary', falling back to
 * `projects.primary_agent_id`. Returns null if no primary agent is configured.
 */
export async function loadPrimaryAgent(
  task: Task,
): Promise<PrimaryAgentContext | null> {
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, task.projectId))
    .limit(1);
  if (!project) return null;

  let agentId: string | null = project.primaryAgentId;
  const [pa] = await db
    .select({ id: projectAgents.agentAccountId })
    .from(projectAgents)
    .where(
      and(
        eq(projectAgents.projectId, project.id),
        eq(projectAgents.role, "primary"),
      ),
    )
    .limit(1);
  if (pa) agentId = pa.id;
  if (!agentId) return null;

  const [agent] = await db
    .select()
    .from(agentAccounts)
    .where(eq(agentAccounts.id, agentId))
    .limit(1);
  if (!agent) return null;

  return { project, agent, apiKey: decrypt(agent.apiKeyEncrypted) };
}

/**
 * Builds the system prompt for an agent call: project context (standing
 * instructions) + task framing. Injected into every call for the project.
 */
export function buildSystemPrompt(project: Project, task: Task): string {
  const parts: string[] = [
    `You are an AI agent working inside Mosaic on the project "${project.name}".`,
  ];
  if (project.context?.trim()) {
    parts.push(
      `Project context (standing instructions — always follow these):\n${project.context.trim()}`,
    );
  }
  parts.push(`You are helping with this task: "${task.title}".`);
  if (task.instructions?.trim()) {
    parts.push(`Task instructions:\n${task.instructions.trim()}`);
  }
  parts.push(
    "Respond helpfully and concisely. Use Markdown for code and structure when useful.",
  );
  return parts.join("\n\n");
}

/** Default model per provider when an agent has no model configured. */
export function defaultModelFor(provider: string): string {
  switch (provider) {
    case "anthropic":
      return "claude-sonnet-4-6";
    case "openai":
      return "gpt-4o";
    default:
      return "claude-sonnet-4-6";
  }
}
