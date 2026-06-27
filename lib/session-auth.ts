import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { agentSessions, tasks } from "@/lib/db/schema";
import type { AgentSession, AgentSessionStatus, Task } from "@/lib/db/schema";

export const SESSION_STATUSES: AgentSessionStatus[] = [
  "idle",
  "working",
  "needs_attention",
  "offline",
];

export const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Verifies a session bearer token from the URL. Revoked sessions have a NULL
 * token and can never match. Never log the token.
 */
export async function verifySessionToken(
  token: string | undefined,
): Promise<AgentSession | null> {
  if (!token) return null;
  const [session] = await db
    .select()
    .from(agentSessions)
    .where(eq(agentSessions.token, token))
    .limit(1);
  return session ?? null;
}

/**
 * Loads a task only if it belongs to the same project as the session — prevents
 * a session from acting on tasks outside its project.
 */
export async function loadTaskForSession(
  session: AgentSession,
  taskId: string,
): Promise<Task | null> {
  const [task] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.projectId, session.projectId)))
    .limit(1);
  return task ?? null;
}
