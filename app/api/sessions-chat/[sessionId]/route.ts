import { asc, eq } from "drizzle-orm";

import {
  badRequest,
  getSessionUserId,
  json,
  notFound,
  unauthorized,
} from "@/lib/api";
import { getOwnedSession } from "@/lib/authz";
import { db } from "@/lib/db";
import { sessionMessages } from "@/lib/db/schema";

export const runtime = "nodejs";

// Browser-facing wrapper for direct session chat. The UI never holds the raw
// token, so it talks to the session by id here; the session itself reads/writes
// via /api/sessions/[token]/chat(+/poll).
type Params = { params: { sessionId: string } };

export async function GET(_req: Request, { params }: Params) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const session = await getOwnedSession(userId, params.sessionId);
  if (!session) return notFound("Session not found");

  const rows = await db
    .select()
    .from(sessionMessages)
    .where(eq(sessionMessages.sessionId, session.id))
    .orderBy(asc(sessionMessages.createdAt));

  return json({
    session: {
      id: session.id,
      name: session.name,
      agentType: session.agentType,
      status: session.status,
      projectId: session.projectId,
    },
    messages: rows.map((m) => ({
      authorKind: m.authorKind,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    })),
  });
}

export async function POST(req: Request, { params }: Params) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const session = await getOwnedSession(userId, params.sessionId);
  if (!session) return notFound("Session not found");

  let body: { message?: string };
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }
  const content = String(body.message ?? "").trim();
  if (!content) return badRequest("message is required");

  await db.insert(sessionMessages).values({
    sessionId: session.id,
    authorKind: "user",
    content,
  });

  return json({ ok: true });
}
