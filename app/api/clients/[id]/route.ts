import { and, eq } from "drizzle-orm";

import {
  badRequest,
  getSessionUserId,
  json,
  notFound,
  unauthorized,
} from "@/lib/api";
import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema";

type Params = { params: { id: string } };

export async function PATCH(req: Request, { params }: Params) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  let body: {
    name?: string;
    color?: string;
    icon?: string;
    description?: string;
    archived?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const updates: Partial<typeof clients.$inferInsert> = {};
  if (body.name !== undefined) {
    if (!body.name.trim()) return badRequest("Name cannot be empty");
    updates.name = body.name.trim();
  }
  if (body.color !== undefined) updates.color = body.color;
  if (body.icon !== undefined) updates.icon = body.icon;
  if (body.description !== undefined)
    updates.description = body.description?.trim() || null;
  if (body.archived !== undefined) updates.archived = body.archived;

  if (Object.keys(updates).length === 0) return badRequest("Nothing to update");

  const [updated] = await db
    .update(clients)
    .set(updates)
    .where(and(eq(clients.id, params.id), eq(clients.userId, userId)))
    .returning();

  if (!updated) return notFound("Client not found");
  return json({ client: updated });
}

export async function DELETE(_req: Request, { params }: Params) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const [archived] = await db
    .update(clients)
    .set({ archived: true })
    .where(and(eq(clients.id, params.id), eq(clients.userId, userId)))
    .returning();

  if (!archived) return notFound("Client not found");
  return json({ ok: true });
}
