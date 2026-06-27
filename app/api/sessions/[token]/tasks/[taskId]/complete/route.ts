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

  return Response.json({ ok: true });
}
