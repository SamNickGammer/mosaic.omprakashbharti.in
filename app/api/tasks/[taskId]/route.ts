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
import { agentSessions, tasks } from "@/lib/db/schema";
import { broadcast } from "@/lib/sse/broadcast";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/types";
import type { TaskPriority, TaskStatus } from "@/types";

const STATUS_SET = new Set<TaskStatus>(TASK_STATUSES.map((s) => s.id));
const PRIORITY_SET = new Set<TaskPriority>(TASK_PRIORITIES.map((p) => p.id));

type Params = { params: { taskId: string } };

export async function GET(_req: Request, { params }: Params) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const task = await getOwnedTask(userId, params.taskId);
  if (!task) return notFound("Task not found");
  return json({ task });
}

export async function PATCH(req: Request, { params }: Params) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const task = await getOwnedTask(userId, params.taskId);
  if (!task) return notFound("Task not found");

  let body: {
    title?: string;
    instructions?: string;
    status?: TaskStatus;
    priority?: TaskPriority;
    position?: number;
    bookmarked?: boolean;
    // Force-status / override controls (used by the task page):
    clearClaim?: boolean; // unclaim so any session can re-claim it
    attentionMessage?: string | null; // flag/clear "needs you"
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
  if (body.bookmarked !== undefined) updates.bookmarked = body.bookmarked;
  if (body.clearClaim) updates.claimedBySessionId = null;
  if (body.attentionMessage !== undefined) {
    updates.attentionMessage = body.attentionMessage?.trim() || null;
  }

  if (Object.keys(updates).length === 0) return badRequest("Nothing to update");
  updates.updatedAt = new Date();

  const [updated] = await db
    .update(tasks)
    .set(updates)
    .where(eq(tasks.id, task.id))
    .returning();

  // Keep the claiming session's status in sync with a forced attention flag.
  if (body.attentionMessage !== undefined && updated.claimedBySessionId) {
    await db
      .update(agentSessions)
      .set({
        status: updates.attentionMessage ? "needs_attention" : "working",
      })
      .where(eq(agentSessions.id, updated.claimedBySessionId));
  }

  // Notify any open task page (status / claim / attention changed).
  if (
    body.status !== undefined ||
    body.clearClaim ||
    body.attentionMessage !== undefined
  ) {
    broadcast(task.id, "status", { status: updated.status });
  }

  return json({ task: updated });
}

export async function DELETE(_req: Request, { params }: Params) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const task = await getOwnedTask(userId, params.taskId);
  if (!task) return notFound("Task not found");

  await db.delete(tasks).where(eq(tasks.id, task.id));
  return json({ ok: true });
}
