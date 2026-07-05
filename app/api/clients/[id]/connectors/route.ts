import { asc, eq } from "drizzle-orm";

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
import type { Connector, ConnectorType } from "@/lib/db/schema";
import { encrypt } from "@/lib/encryption";

export const runtime = "nodejs";

type Params = { params: { id: string } };

const CONNECTOR_TYPES: ConnectorType[] = [
  "slack",
  "gmail",
  "google",
  "whatsapp",
  "github",
  "custom",
];

/** Browser-safe view — never leaks the secret, only whether one is set. */
function toView(c: Connector) {
  return {
    id: c.id,
    type: c.type,
    name: c.name,
    account: c.account,
    details: c.details,
    hasSecret: c.secretEncrypted !== null,
    createdAt: c.createdAt.toISOString(),
  };
}

export async function GET(_req: Request, { params }: Params) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const client = await getOwnedClient(userId, params.id);
  if (!client) return notFound("Client not found");

  const rows = await db
    .select()
    .from(connectors)
    .where(eq(connectors.clientId, client.id))
    .orderBy(asc(connectors.createdAt));

  return json({ connectors: rows.map(toView) });
}

export async function POST(req: Request, { params }: Params) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const client = await getOwnedClient(userId, params.id);
  if (!client) return notFound("Client not found");

  let body: {
    type?: string;
    name?: string;
    account?: string;
    details?: string;
    secret?: string;
  };
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const name = body.name?.trim();
  if (!name) return badRequest("Name is required");
  if (!CONNECTOR_TYPES.includes(body.type as ConnectorType)) {
    return badRequest("A valid connector type is required");
  }

  const secret = body.secret?.trim();
  const [row] = await db
    .insert(connectors)
    .values({
      clientId: client.id,
      type: body.type as ConnectorType,
      name,
      account: body.account?.trim() || null,
      details: body.details?.trim() || null,
      secretEncrypted: secret ? encrypt(secret) : null,
    })
    .returning();

  return json({ connector: toView(row) }, { status: 201 });
}
