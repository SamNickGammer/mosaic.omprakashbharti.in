import { eq } from "drizzle-orm";

import { getSessionUserId, json, notFound, unauthorized } from "@/lib/api";
import { getOwnedSession } from "@/lib/authz";
import { db } from "@/lib/db";
import { agentSessions } from "@/lib/db/schema";

export const runtime = "nodejs";

// NOTE: the dynamic segment is named [token] to share the /api/sessions/* slug
// with the webhook routes, but this browser-facing DELETE receives a session
// *id* (the UI never holds the raw token).
type Params = { params: { token: string } };

export async function DELETE(_req: Request, { params }: Params) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const sessionId = params.token;
  const owned = await getOwnedSession(userId, sessionId);
  if (!owned) return notFound("Session not found");

  // Revoke: null the token so future webhook polls return 401.
  await db
    .update(agentSessions)
    .set({ token: null, status: "offline" })
    .where(eq(agentSessions.id, sessionId));

  return json({ ok: true });
}
