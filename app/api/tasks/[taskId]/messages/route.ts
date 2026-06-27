import { and, asc, eq } from "drizzle-orm";

import {
  badRequest,
  getSessionUserId,
  json,
  notFound,
  unauthorized,
} from "@/lib/api";
import { getOwnedTask } from "@/lib/authz";
import { db } from "@/lib/db";
import { agentSessions, taskMessages, tasks } from "@/lib/db/schema";
import { broadcast } from "@/lib/sse/broadcast";

const ONLINE_WINDOW_MS = 150_000; // 2.5 min

type Params = { params: { taskId: string } };

export async function GET(_req: Request, { params }: Params) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const task = await getOwnedTask(userId, params.taskId);
  if (!task) return notFound("Task not found");

  const rows = await db
    .select()
    .from(taskMessages)
    .where(
      and(eq(taskMessages.taskId, task.id), eq(taskMessages.isTrace, false)),
    )
    .orderBy(asc(taskMessages.createdAt));

  const messages = rows.map((m) => ({
    id: m.id,
    role: m.role,
    authorKind: m.role === "user" ? "user" : "agent",
    content: m.content,
    agentId: m.agentId,
    sessionId: m.sessionId,
    isStreamChunk: m.isStreamChunk,
    createdAt: m.createdAt.toISOString(),
  }));

  return json({ messages });
}

/** User reply to a session (picked up by the session's /poll long-poll). */
export async function POST(req: Request, { params }: Params) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const task = await getOwnedTask(userId, params.taskId);
  if (!task) return notFound("Task not found");

  let body: { body?: string };
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }
  const content = String(body.body ?? "").trim();
  if (!content) return badRequest("body is required");

  const [message] = await db
    .insert(taskMessages)
    .values({ taskId: task.id, role: "user", content })
    .returning();

  // Is a live session actively working this task right now? If so, it will see
  // the message via its /poll long-poll. Otherwise re-queue the task so the next
  // session /next picks it up — with this message + the prior result attached.
  let claiming: typeof agentSessions.$inferSelect | undefined;
  if (task.claimedBySessionId) {
    [claiming] = await db
      .select()
      .from(agentSessions)
      .where(eq(agentSessions.id, task.claimedBySessionId))
      .limit(1);
  }
  const claimingOnline =
    !!claiming?.lastSeenAt &&
    Date.now() - new Date(claiming.lastSeenAt).getTime() < ONLINE_WINDOW_MS;
  const activelyAttached =
    task.status === "in_progress" &&
    !!claiming &&
    claimingOnline &&
    (claiming.status === "working" || claiming.status === "needs_attention");

  let requeued = false;
  if (!activelyAttached) {
    await db
      .update(tasks)
      .set({
        status: "in_progress",
        claimedBySessionId: null,
        attentionMessage: null,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, task.id));
    requeued = true;
    broadcast(task.id, "status", { status: "in_progress" });
  }

  return json({
    message: {
      id: message.id,
      role: message.role,
      authorKind: "user" as const,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
    },
    requeued,
    status: requeued ? "in_progress" : task.status,
  });
}
