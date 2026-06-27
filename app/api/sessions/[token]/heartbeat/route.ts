import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { agentSessions } from "@/lib/db/schema";
import { SESSION_STATUSES, verifySessionToken } from "@/lib/session-auth";
import type { AgentSessionStatus } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: { token: string } };

export async function POST(req: Request, { params }: Params) {
  const session = await verifySessionToken(params.token);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { status?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* status optional */
  }

  const status: AgentSessionStatus = SESSION_STATUSES.includes(
    body.status as AgentSessionStatus,
  )
    ? (body.status as AgentSessionStatus)
    : "idle";

  await db
    .update(agentSessions)
    .set({ lastSeenAt: new Date(), status })
    .where(eq(agentSessions.id, session.id));

  return Response.json({ ok: true });
}
