import { db } from "@/lib/db";
import { taskMessages } from "@/lib/db/schema";
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

  let body: { body?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const content = String(body.body ?? "").trim();
  if (!content) return Response.json({ error: "body is required" }, { status: 400 });

  await db.insert(taskMessages).values({
    taskId: task.id,
    role: "agent",
    content,
    sessionId: session.id,
    isStreamChunk: false,
  });

  // Surface the comment to any open browser via the chunk channel.
  broadcast(task.id, "chunk", { sessionName: session.name, content });

  return Response.json({ ok: true });
}
