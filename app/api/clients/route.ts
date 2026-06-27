import { and, asc, eq } from "drizzle-orm";

import { badRequest, getSessionUserId, json, unauthorized } from "@/lib/api";
import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema";

export async function GET(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const includeArchived = new URL(req.url).searchParams.get("archived") === "1";

  const rows = await db.query.clients.findMany({
    where: includeArchived
      ? eq(clients.userId, userId)
      : and(eq(clients.userId, userId), eq(clients.archived, false)),
    orderBy: [asc(clients.createdAt)],
    with: {
      projects: {
        columns: { id: true, name: true },
        orderBy: (p, { asc }) => [asc(p.createdAt)],
      },
    },
  });

  return json({ clients: rows });
}

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  let body: {
    name?: string;
    color?: string;
    icon?: string;
    description?: string;
  };
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const name = body.name?.trim();
  if (!name) return badRequest("Name is required");

  const [client] = await db
    .insert(clients)
    .values({
      userId,
      name,
      color: body.color ?? null,
      icon: body.icon ?? null,
      description: body.description?.trim() || null,
    })
    .returning();

  return json({ client: { ...client, projects: [] } }, { status: 201 });
}
