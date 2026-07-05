import { and, eq } from "drizzle-orm";

import {
  badRequest,
  getSessionUserId,
  json,
  notFound,
  unauthorized,
} from "@/lib/api";
import { getOwnedClient } from "@/lib/authz";
import { db } from "@/lib/db";
import { connectors } from "@/lib/db/schema";
import { encrypt } from "@/lib/encryption";

export const runtime = "nodejs";

type Params = { params: { id: string; connectorId: string } };

async function loadConnector(clientId: string, connectorId: string) {
  const [row] = await db
    .select()
    .from(connectors)
    .where(
      and(
        eq(connectors.id, connectorId),
        eq(connectors.clientId, clientId),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function PATCH(req: Request, { params }: Params) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const client = await getOwnedClient(userId, params.id);
  if (!client) return notFound("Client not found");
  const connector = await loadConnector(client.id, params.connectorId);
  if (!connector) return notFound("Connector not found");

  let body: {
    name?: string;
    account?: string;
    details?: string;
    secret?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const updates: Partial<typeof connectors.$inferInsert> = {};
  if (body.name !== undefined) {
    if (!body.name.trim()) return badRequest("Name cannot be empty");
    updates.name = body.name.trim();
  }
  if (body.account !== undefined) updates.account = body.account?.trim() || null;
  if (body.details !== undefined) updates.details = body.details?.trim() || null;
  // secret: "" / null clears it; a string replaces it; undefined leaves it as-is.
  if (body.secret !== undefined) {
    const s = body.secret?.trim();
    updates.secretEncrypted = s ? encrypt(s) : null;
  }

  if (Object.keys(updates).length === 0) return badRequest("Nothing to update");
  updates.updatedAt = new Date();

  await db
    .update(connectors)
    .set(updates)
    .where(eq(connectors.id, connector.id));

  return json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Params) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const client = await getOwnedClient(userId, params.id);
  if (!client) return notFound("Client not found");
  const connector = await loadConnector(client.id, params.connectorId);
  if (!connector) return notFound("Connector not found");

  await db.delete(connectors).where(eq(connectors.id, connector.id));
  return json({ ok: true });
}
