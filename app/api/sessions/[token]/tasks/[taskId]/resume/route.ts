import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { agentSessions, tasks } from "@/lib/db/schema";
import { loadTaskForSession, verifySessionToken } from "@/lib/session-auth";
import { broadcast } from "@/lib/sse/broadcast";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: { token: string; taskId: string } };

export async function POST(_req: Request, { params }: Params) {
  const session = await verifySessionToken(params.token);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const task = await loadTaskForSession(session, params.taskId);
  if (!task) return Response.json({ error: "Not found" }, { status: 404 });

  await db
    .update(tasks)
    .set({ attentionMessage: null, updatedAt: new Date() })
    .where(eq(tasks.id, task.id));
  await db
    .update(agentSessions)
    .set({ status: "working" })
    .where(eq(agentSessions.id, session.id));

  broadcast(task.id, "status", { sessionId: session.id, status: "working" });

  return Response.json({ ok: true });
}
