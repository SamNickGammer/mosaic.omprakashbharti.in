import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { clients, projects, tasks } from "@/lib/db/schema";
import type { Project, Task } from "@/lib/db/schema";

/**
 * Returns the project if it belongs to the given user (via its client),
 * otherwise null. Enforces row-level isolation for project-scoped routes.
 */
export async function getOwnedProject(
  userId: string,
  projectId: string,
): Promise<Project | null> {
  const [row] = await db
    .select({ project: projects })
    .from(projects)
    .innerJoin(clients, eq(projects.clientId, clients.id))
    .where(and(eq(projects.id, projectId), eq(clients.userId, userId)))
    .limit(1);
  return row?.project ?? null;
}

/**
 * Returns the task if it belongs to the given user (via project → client),
 * otherwise null.
 */
export async function getOwnedTask(
  userId: string,
  taskId: string,
): Promise<Task | null> {
  const [row] = await db
    .select({ task: tasks })
    .from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .innerJoin(clients, eq(projects.clientId, clients.id))
    .where(and(eq(tasks.id, taskId), eq(clients.userId, userId)))
    .limit(1);
  return row?.task ?? null;
}
