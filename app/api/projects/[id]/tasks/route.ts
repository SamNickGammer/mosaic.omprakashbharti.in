import { asc, eq } from "drizzle-orm";

import {
  badRequest,
  getSessionUserId,
  json,
  notFound,
  unauthorized,
} from "@/lib/api";
import { getOwnedProject } from "@/lib/authz";
import { db } from "@/lib/db";
import { tasks } from "@/lib/db/schema";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/types";
import type { TaskPriority, TaskStatus } from "@/types";

const STATUS_SET = new Set<TaskStatus>(TASK_STATUSES.map((s) => s.id));
const PRIORITY_SET = new Set<TaskPriority>(TASK_PRIORITIES.map((p) => p.id));

type Params = { params: { id: string } };

export async function GET(_req: Request, { params }: Params) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const project = await getOwnedProject(userId, params.id);
  if (!project) return notFound("Project not found");

  const rows = await db
    .select()
    .from(tasks)
    .where(eq(tasks.projectId, project.id))
    .orderBy(asc(tasks.position), asc(tasks.createdAt));

  return json({ tasks: rows });
}

export async function POST(req: Request, { params }: Params) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const project = await getOwnedProject(userId, params.id);
  if (!project) return notFound("Project not found");

  let body: {
    title?: string;
    instructions?: string;
    status?: TaskStatus;
    priority?: TaskPriority;
    bookmarked?: boolean;
    clearBefore?: boolean;
    compactBefore?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const title = body.title?.trim();
  if (!title) return badRequest("Title is required");

  const status =
    body.status && STATUS_SET.has(body.status) ? body.status : "backlog";
  const priority =
    body.priority && PRIORITY_SET.has(body.priority) ? body.priority : "medium";

  // Place at the end of its column.
  const existing = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(eq(tasks.projectId, project.id));

  const [task] = await db
    .insert(tasks)
    .values({
      projectId: project.id,
      title,
      instructions: body.instructions?.trim() || null,
      status,
      priority,
      position: existing.length,
      bookmarked: body.bookmarked === true,
      clearBefore: body.clearBefore === true,
      compactBefore: body.compactBefore === true,
    })
    .returning();

  return json({ task }, { status: 201 });
}
