import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { agentSessions } from "@/lib/db/schema";
import { postRoomMessage } from "@/lib/room";
import { verifySessionToken } from "@/lib/session-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: { token: string } };

export async function POST(req: Request, { params }: Params) {
  const session = await verifySessionToken(params.token);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { content?: string; to?: string | null };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const content = body.content?.trim();
  if (!content) {
    return Response.json({ error: "content is required" }, { status: 400 });
  }

  // If addressed, the target must be a participant in this same project room.
  let mentionSessionId: string | null = null;
  if (body.to) {
    const [target] = await db
      .select({ id: agentSessions.id })
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
    mentionSessionId = target.id;
  }

  const message = await postRoomMessage({
    projectId: session.projectId,
    authorKind: "agent",
    authorSessionId: session.id,
    mentionSessionId,
    content,
  });

  return Response.json({ ok: true, message });
}
