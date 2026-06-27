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

  let body: { chunk?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const chunk = String(body.chunk ?? "");
  if (!chunk) return Response.json({ error: "chunk is required" }, { status: 400 });

  await db.insert(taskMessages).values({
    taskId: task.id,
    role: "agent",
    content: chunk,
    sessionId: session.id,
    isStreamChunk: true,
  });

  broadcast(task.id, "chunk", { sessionName: session.name, content: chunk });

  return Response.json({ ok: true });
}
