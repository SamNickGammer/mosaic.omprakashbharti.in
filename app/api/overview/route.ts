import { and, desc, eq, isNotNull } from "drizzle-orm";

import { getSessionUserId, json, unauthorized } from "@/lib/api";
import { db } from "@/lib/db";
import { agentSessions, clients, projects, tasks } from "@/lib/db/schema";

export const runtime = "nodejs";

/** Cross-project aggregate for the dashboard + sidebar status dots. */
export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const sessionRows = await db
    .select({
      id: agentSessions.id,
      name: agentSessions.name,
      agentType: agentSessions.agentType,
      status: agentSessions.status,
      currentTaskId: agentSessions.currentTaskId,
      lastSeenAt: agentSessions.lastSeenAt,
      projectId: projects.id,
      projectName: projects.name,
      clientId: clients.id,
    })
    .from(agentSessions)
    .innerJoin(projects, eq(agentSessions.projectId, projects.id))
    .innerJoin(clients, eq(projects.clientId, clients.id))
    .where(eq(clients.userId, userId));

  const attentionRows = await db
    .select({
      taskId: tasks.id,
      title: tasks.title,
      attentionMessage: tasks.attentionMessage,
      projectId: projects.id,
      projectName: projects.name,
      clientId: clients.id,
    })
    .from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .innerJoin(clients, eq(projects.clientId, clients.id))
    .where(and(eq(clients.userId, userId), isNotNull(tasks.attentionMessage)))
    .orderBy(desc(tasks.updatedAt));

  return json({
    sessions: sessionRows.map((s) => ({
      ...s,
      lastSeenAt: s.lastSeenAt?.toISOString() ?? null,
    })),
    attention: attentionRows,
  });
}
