import { asc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { connectors, projects } from "@/lib/db/schema";
import { decrypt } from "@/lib/encryption";
import { verifySessionToken } from "@/lib/session-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: { token: string } };

/**
 * Connectors available to this agent — the client-scoped services (Slack,
 * Gmail, …) the user configured. Secrets are DECRYPTED here (the agent needs
 * them to act); this endpoint is token-auth only and scoped to the session's
 * client. Never log the response.
 */
export async function GET(_req: Request, { params }: Params) {
  const session = await verifySessionToken(params.token);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [project] = await db
    .select({ clientId: projects.clientId })
    .from(projects)
    .where(eq(projects.id, session.projectId))
    .limit(1);
  if (!project) return Response.json({ connectors: [] });

  const rows = await db
    .select()
    .from(connectors)
    .where(eq(connectors.clientId, project.clientId))
    .orderBy(asc(connectors.createdAt));

  return Response.json({
    connectors: rows.map((c) => ({
      id: c.id,
      type: c.type,
      name: c.name,
      account: c.account,
      details: c.details,
      secret: c.secretEncrypted ? decrypt(c.secretEncrypted) : null,
    })),
  });
}
