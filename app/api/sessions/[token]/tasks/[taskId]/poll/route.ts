import { and, asc, eq, gt } from "drizzle-orm";

import { db } from "@/lib/db";
import { taskMessages, tasks } from "@/lib/db/schema";
import { loadTaskForSession, sleep, verifySessionToken } from "@/lib/session-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

type Params = { params: { token: string; taskId: string } };

export async function GET(req: Request, { params }: Params) {
  const session = await verifySessionToken(params.token);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const initial = await loadTaskForSession(session, params.taskId);
  if (!initial) return Response.json({ error: "Not found" }, { status: 404 });

  const url = new URL(req.url);
  const since = new Date(parseInt(url.searchParams.get("since") ?? "0", 10) || 0);
  const waitSeconds = Math.min(
    Math.max(parseInt(url.searchParams.get("wait") ?? "90", 10) || 90, 1),
    90,
  );
  const deadline = Date.now() + waitSeconds * 1000;
  const initialStatus = initial.status;

  const fetchNewComments = () =>
    db
      .select()
      .from(taskMessages)
      .where(
        and(
          eq(taskMessages.taskId, initial.id),
          eq(taskMessages.role, "user"),
          gt(taskMessages.createdAt, since),
        ),
      )
      .orderBy(asc(taskMessages.createdAt));

  while (Date.now() < deadline) {
    if (req.signal?.aborted) break;

    const [task] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, initial.id))
      .limit(1);
    const newComments = await fetchNewComments();

    if (!task || newComments.length > 0 || task.status !== initialStatus) {
      return Response.json({
        status: task?.status ?? initialStatus,
        attentionMessage: task?.attentionMessage ?? null,
        result: task?.result ?? null,
        newComments: newComments.map((c) => ({
          authorKind: "user" as const,
          body: c.content,
          createdAt: c.createdAt.getTime(),
        })),
      });
    }

    await sleep(2000);
  }

  const [task] = await db
    .select()
    .from(tasks)
    .where(eq(tasks.id, initial.id))
    .limit(1);
  return Response.json({
    status: task?.status ?? initialStatus,
    attentionMessage: task?.attentionMessage ?? null,
    result: task?.result ?? null,
    newComments: [],
  });
}
