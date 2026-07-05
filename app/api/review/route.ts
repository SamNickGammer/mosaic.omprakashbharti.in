import { and, desc, eq } from "drizzle-orm";

import { getSessionUserId, json, unauthorized } from "@/lib/api";
import { db } from "@/lib/db";
import { clients, projects, tasks } from "@/lib/db/schema";

export const runtime = "nodejs";

/** All tasks the user bookmarked for review, newest first, with location. */
export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const rows = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      status: tasks.status,
      priority: tasks.priority,
      updatedAt: tasks.updatedAt,
      projectId: projects.id,
      projectName: projects.name,
      clientId: clients.id,
      clientName: clients.name,
      clientColor: clients.color,
    })
    .from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .innerJoin(clients, eq(projects.clientId, clients.id))
    .where(and(eq(clients.userId, userId), eq(tasks.bookmarked, true)))
    .orderBy(desc(tasks.updatedAt));

  return json({
    tasks: rows.map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      priority: r.priority,
      updatedAt: r.updatedAt.toISOString(),
      projectId: r.projectId,
      projectName: r.projectName,
      clientId: r.clientId,
      clientName: r.clientName,
      clientColor: r.clientColor,
    })),
  });
}
