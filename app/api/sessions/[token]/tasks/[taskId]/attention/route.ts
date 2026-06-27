import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { agentSessions, tasks } from "@/lib/db/schema";
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

  let body: { message?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const message = String(body.message ?? "").trim();
  if (!message) return Response.json({ error: "message is required" }, { status: 400 });

  await db
    .update(tasks)
    .set({ attentionMessage: message, updatedAt: new Date() })
    .where(eq(tasks.id, task.id));
  await db
    .update(agentSessions)
    .set({ status: "needs_attention" })
    .where(eq(agentSessions.id, session.id));

  broadcast(task.id, "attention", { sessionName: session.name, message });

  return Response.json({ ok: true });
}
