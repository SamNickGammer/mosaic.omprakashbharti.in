import { and, asc, eq, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { agentSessions, taskAttachments, taskMessages, tasks } from "@/lib/db/schema";
import { sleep, verifySessionToken } from "@/lib/session-auth";
import type { AgentSession } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

type Params = { params: { token: string } };

/** Atomically claim the oldest unclaimed in-progress task in the project. */
async function claimNextTask(session: AgentSession) {
  const [candidate] = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(
      and(
        eq(tasks.projectId, session.projectId),
        eq(tasks.status, "in_progress"),
        isNull(tasks.claimedBySessionId),
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
      const comments = await db
        .select()
        .from(taskMessages)
        .where(
          and(eq(taskMessages.taskId, task.id), eq(taskMessages.role, "user")),
        )
        .orderBy(asc(taskMessages.createdAt));

      return Response.json({
        success: true,
        data: {
          id: task.id,
          title: task.title,
          instructions: task.instructions ?? "",
          // Prior result when this task was previously completed and re-queued
          // by a follow-up message — gives the agent continuity.
          previousResult: task.result ?? null,
          compactBefore: false,
          clearBefore: false,
          files: files.map((f) => ({
            name: f.name,
            url: f.url,
            mime: f.mime,
            size: f.sizeBytes,
          })),
          comments: comments.map((c) => ({
            authorKind: "user" as const,
            body: c.content,
            createdAt: c.createdAt.getTime(),
          })),
        },
      });
    }

    await sleep(2000);
  }

  return new Response(null, { status: 204 });
}
