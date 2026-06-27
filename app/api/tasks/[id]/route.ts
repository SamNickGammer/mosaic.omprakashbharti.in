import { eq } from "drizzle-orm";

import {
  badRequest,
  getSessionUserId,
  json,
  notFound,
  unauthorized,
} from "@/lib/api";
import { getOwnedTask } from "@/lib/authz";
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

  const task = await getOwnedTask(userId, params.id);
  if (!task) return notFound("Task not found");
  return json({ task });
}

export async function PATCH(req: Request, { params }: Params) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const task = await getOwnedTask(userId, params.id);
  if (!task) return notFound("Task not found");

  let body: {
    title?: string;
    instructions?: string;
    status?: TaskStatus;
    priority?: TaskPriority;
    position?: number;
  };
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const updates: Partial<typeof tasks.$inferInsert> = {};
  if (body.title !== undefined) {
    if (!body.title.trim()) return badRequest("Title cannot be empty");
    updates.title = body.title.trim();
  }
  if (body.instructions !== undefined)
    updates.instructions = body.instructions?.trim() || null;
  if (body.status !== undefined) {
    if (!STATUS_SET.has(body.status)) return badRequest("Invalid status");
    updates.status = body.status;
  }
  if (body.priority !== undefined) {
    if (!PRIORITY_SET.has(body.priority)) return badRequest("Invalid priority");
    updates.priority = body.priority;
  }
  if (body.position !== undefined && Number.isFinite(body.position)) {
    updates.position = Math.max(0, Math.trunc(body.position));
  }

  if (Object.keys(updates).length === 0) return badRequest("Nothing to update");
  updates.updatedAt = new Date();

  const [updated] = await db
    .update(tasks)
    .set(updates)
    .where(eq(tasks.id, task.id))
    .returning();

  return json({ task: updated });
}

export async function DELETE(_req: Request, { params }: Params) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const task = await getOwnedTask(userId, params.id);
  if (!task) return notFound("Task not found");

  await db.delete(tasks).where(eq(tasks.id, task.id));
  return json({ ok: true });
}
