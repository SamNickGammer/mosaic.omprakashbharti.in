import { and, eq } from "drizzle-orm";

import {
  getSessionUserId,
  json,
  notFound,
  unauthorized,
} from "@/lib/api";
import { db } from "@/lib/db";
import { agentAccounts } from "@/lib/db/schema";

type Params = { params: { id: string } };

export async function DELETE(_req: Request, { params }: Params) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const [deleted] = await db
    .delete(agentAccounts)
    .where(
      and(eq(agentAccounts.id, params.id), eq(agentAccounts.userId, userId)),
    )
    .returning({ id: agentAccounts.id });

  if (!deleted) return notFound("Agent not found");
  return json({ ok: true });
}
