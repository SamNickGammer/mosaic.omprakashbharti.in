import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { agentSessions, tasks } from "@/lib/db/schema";
import { postRoomMessage } from "@/lib/room";
import { verifySessionToken } from "@/lib/session-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: { token: string } };

/**
 * One agent dispatches a task to another agent in the same room ("ask Codex to
 * review this"). The task is created already-claimable and assigned to the
 * target, so the target's /next long-poll picks it up immediately. The ask is
 * also mirrored into the room chat for visibility. The asker then polls
 * /tasks/<taskId>/poll to pull the result.
 */
export async function POST(req: Request, { params }: Params) {
  const session = await verifySessionToken(params.token);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    to?: string;
    question?: string;
    title?: string;
    fromTaskId?: string;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const question = body.question?.trim();
  if (!question) {
    return Response.json({ error: "question is required" }, { status: 400 });
  }
  if (!body.to) {
    return Response.json({ error: "to (agent id) is required" }, { status: 400 });
  }
  if (body.to === session.id) {
    return Response.json({ error: "Cannot ask yourself" }, { status: 400 });
  }

  const [target] = await db
    .select({ id: agentSessions.id, name: agentSessions.name })
    .from(agentSessions)
    .where(
      and(
        eq(agentSessions.id, body.to),
        eq(agentSessions.projectId, session.projectId),
      ),
    )
    .limit(1);
  if (!target) {
    return Response.json(
      { error: "Addressee is not in this room" },
      { status: 400 },
    );
  }

  const title = body.title?.trim() || `Ask from ${session.name}`;

  // Only accept a fromTaskId that belongs to this project (the asker's task).
  let originTaskId: string | null = null;
  if (body.fromTaskId) {
    const [origin] = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(
        and(
          eq(tasks.id, body.fromTaskId),
          eq(tasks.projectId, session.projectId),
        ),
      )
      .limit(1);
    originTaskId = origin?.id ?? null;
  }

  const [task] = await db
    .insert(tasks)
    .values({
      projectId: session.projectId,
      title,
      instructions: question,
      status: "in_progress",
      assignedSessionId: target.id,
      originSessionId: session.id,
      originTaskId,
      createdBySessionId: session.id,
    })
    .returning();

  // Mirror the ask into the room chat so the user sees "<asker> → <target>".
  await postRoomMessage({
    projectId: session.projectId,
    authorKind: "agent",
    authorSessionId: session.id,
    mentionSessionId: target.id,
    content: question,
  });

  return Response.json({ ok: true, taskId: task.id });
}
