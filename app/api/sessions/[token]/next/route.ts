import { and, asc, eq, inArray, isNull, or } from "drizzle-orm";

import { db } from "@/lib/db";
import { agentSessions, taskAttachments, taskMessages, tasks } from "@/lib/db/schema";
import { roomMessagesForSession } from "@/lib/room";
import { sleep, verifySessionToken } from "@/lib/session-auth";
import type { AgentSession } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

type Params = { params: { token: string } };

/**
 * Atomically claim the oldest unclaimed in-progress task the session is allowed
 * to take: one assigned to it, or any unassigned task (first-come-first-served).
 * Tasks assigned to a different participant are skipped.
 */
async function claimNextTask(session: AgentSession) {
  const [candidate] = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(
      and(
        eq(tasks.projectId, session.projectId),
        eq(tasks.status, "in_progress"),
        isNull(tasks.claimedBySessionId),
        or(
          isNull(tasks.assignedSessionId),
          eq(tasks.assignedSessionId, session.id),
        ),
      ),
    )
    .orderBy(asc(tasks.position), asc(tasks.createdAt))
    .limit(1);
  if (!candidate) return null;

  // Conditional update: only wins if still unclaimed (first-come-first-served).
  const [claimed] = await db
    .update(tasks)
    .set({ claimedBySessionId: session.id, updatedAt: new Date() })
    .where(and(eq(tasks.id, candidate.id), isNull(tasks.claimedBySessionId)))
    .returning();
  return claimed ?? null;
}

export async function GET(req: Request, { params }: Params) {
  const session = await verifySessionToken(params.token);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Heartbeat piggyback.
  await db
    .update(agentSessions)
    .set({ lastSeenAt: new Date(), status: "idle" })
    .where(eq(agentSessions.id, session.id));

  const url = new URL(req.url);
  const waitSeconds = Math.min(
    Math.max(parseInt(url.searchParams.get("wait") ?? "90", 10) || 90, 1),
    90,
  );
  const deadline = Date.now() + waitSeconds * 1000;

  // Unified inbox (opt-in): also deliver the user's room-chat messages through
  // this same long-poll. Old agents don't pass inbox=1 and are unaffected.
  const inbox = url.searchParams.get("inbox") === "1";
  let roomCursor = session.roomCursorAt;
  if (inbox && roomCursor == null) {
    // First inbox poll — start from now so we don't replay old conversation.
    roomCursor = new Date();
    await db
      .update(agentSessions)
      .set({ roomCursorAt: roomCursor })
      .where(eq(agentSessions.id, session.id));
  }

  while (Date.now() < deadline) {
    if (req.signal?.aborted) return new Response(null, { status: 204 });

    const task = await claimNextTask(session);
    if (task) {
      await db
        .update(agentSessions)
        .set({ status: "working", currentTaskId: task.id })
        .where(eq(agentSessions.id, session.id));

      const files = await db
        .select()
        .from(taskAttachments)
        .where(eq(taskAttachments.taskId, task.id));
      // Include user follow-ups AND peer-agent replies (from an ask callback),
      // excluding streamed output chunks. Lets a re-queued task see what the
      // peer said.
      const comments = await db
        .select()
        .from(taskMessages)
        .where(
          and(
            eq(taskMessages.taskId, task.id),
            inArray(taskMessages.role, ["user", "agent"]),
            eq(taskMessages.isStreamChunk, false),
          ),
        )
        .orderBy(asc(taskMessages.createdAt));

      return Response.json({
        success: true,
        type: "task" as const,
        data: {
          id: task.id,
          title: task.title,
          instructions: task.instructions ?? "",
          // Prior result when this task was previously completed and re-queued
          // by a follow-up message — gives the agent continuity.
          previousResult: task.result ?? null,
          assignedToYou: task.assignedSessionId === session.id,
          compactBefore: false,
          clearBefore: false,
          files: files.map((f) => ({
            name: f.name,
            url: f.url,
            mime: f.mime,
            size: f.sizeBytes,
          })),
          comments: comments.map((c) => ({
            authorKind: c.role === "user" ? ("user" as const) : ("agent" as const),
            body: c.content,
            createdAt: c.createdAt.getTime(),
          })),
        },
      });
    }

    // No task — if inbox is on, deliver any new user chat addressed to us.
    if (inbox && roomCursor) {
      const messages = await roomMessagesForSession({
        session,
        since: roomCursor,
        userOnly: true,
      });
      if (messages.length > 0) {
        roomCursor = new Date(Math.max(...messages.map((m) => m.createdAt)));
        await db
          .update(agentSessions)
          .set({ roomCursorAt: roomCursor })
          .where(eq(agentSessions.id, session.id));
        return Response.json({
          success: true,
          type: "message" as const,
          data: { messages },
        });
      }
    }

    await sleep(2000);
  }

  return new Response(null, { status: 204 });
}
