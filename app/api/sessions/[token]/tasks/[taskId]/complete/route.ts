import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { agentSessions, taskMessages, tasks } from "@/lib/db/schema";
import { postRoomMessage } from "@/lib/room";
import { loadTaskForSession, verifySessionToken } from "@/lib/session-auth";
import { broadcast } from "@/lib/sse/broadcast";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: { token: string; taskId: string } };

export async function POST(req: Request, { params }: Params) {
  const session = await verifySessionToken(params.token);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const task = await loadTaskForSession(session, params.taskId);
  if (!task) return Response.json({ error: "Not found" }, { status: 404 });

  let body: { result?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const result = String(body.result ?? "").trim() || null;

  await db
    .update(tasks)
    .set({ status: "done", result, updatedAt: new Date() })
    .where(eq(tasks.id, task.id));
  await db
    .update(agentSessions)
    .set({ status: "idle", currentTaskId: null })
    .where(eq(agentSessions.id, session.id));

  broadcast(task.id, "complete", {
    sessionName: session.name,
    result: result ?? "",
  });

  // If this task was an agent-to-agent "ask", mirror the answer back into the
  // room chat, attributed from the completer to the asker.
  if (task.originSessionId && task.originSessionId !== session.id) {
    await postRoomMessage({
      projectId: session.projectId,
      authorKind: "agent",
      authorSessionId: session.id,
      mentionSessionId: task.originSessionId,
      content: result ?? "(no result provided)",
    });
  }

  // Async callback: if the ask was spawned from another task, attach the reply
  // to that origin task and re-queue it to the asker — so it re-runs, remembers
  // what it was doing, folds in the reply, and posts the final answer. This is
  // what makes "finish your own work now, get re-woken when the peer replies"
  // possible instead of blocking.
  if (task.originTaskId && task.originSessionId) {
    await db.insert(taskMessages).values({
      taskId: task.originTaskId,
      role: "agent",
      sessionId: session.id,
      content: `${session.name} replied to your ask:\n\n${result ?? "(no result provided)"}`,
      isStreamChunk: false,
    });
    await db
      .update(tasks)
      .set({
        status: "in_progress",
        claimedBySessionId: null,
        assignedSessionId: task.originSessionId,
        attentionMessage: null,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, task.originTaskId));
    broadcast(task.originTaskId, "status", { status: "in_progress" });
  }

  return Response.json({ ok: true });
}
