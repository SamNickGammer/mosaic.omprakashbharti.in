import { and, eq, inArray } from "drizzle-orm";

import {
  badRequest,
  getSessionUserId,
  json,
  notFound,
  unauthorized,
} from "@/lib/api";
import { db } from "@/lib/db";
import { agentAccounts, clients, projectAgents, projects } from "@/lib/db/schema";

type Params = { params: { id: string } };

export async function GET(_req: Request, { params }: Params) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const [client] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.id, params.id), eq(clients.userId, userId)))
    .limit(1);
  if (!client) return notFound("Client not found");

  const rows = await db.query.projects.findMany({
    where: eq(projects.clientId, params.id),
    orderBy: (p, { asc }) => [asc(p.createdAt)],
  });

  return json({ projects: rows });
}

export async function POST(req: Request, { params }: Params) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  // Verify the client belongs to this user.
  const [client] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.id, params.id), eq(clients.userId, userId)))
    .limit(1);
  if (!client) return notFound("Client not found");

  let body: {
    name?: string;
    description?: string;
    repoUrl?: string;
    context?: string;
    primaryAgentId?: string | null;
    secondaryAgentIds?: string[];
  };
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const name = body.name?.trim();
  if (!name) return badRequest("Name is required");

  // Verify every referenced agent belongs to this user.
  const secondaryIds = (body.secondaryAgentIds ?? []).filter(
    (id) => id && id !== body.primaryAgentId,
  );
  const referencedIds = [
    ...new Set(
      [body.primaryAgentId, ...secondaryIds].filter(
        (v): v is string => typeof v === "string" && v.length > 0,
      ),
    ),
  ];
  if (referencedIds.length > 0) {
    const owned = await db
      .select({ id: agentAccounts.id })
      .from(agentAccounts)
      .where(
        and(
          eq(agentAccounts.userId, userId),
          inArray(agentAccounts.id, referencedIds),
        ),
      );
    if (owned.length !== referencedIds.length) {
      return badRequest("One or more agents are invalid");
    }
  }

  const primaryAgentId = body.primaryAgentId || null;

  const [project] = await db
    .insert(projects)
    .values({
      clientId: params.id,
      name,
      description: body.description?.trim() || null,
      repoUrl: body.repoUrl?.trim() || null,
      context: body.context?.trim() || null,
      primaryAgentId,
    })
    .returning();

  const joinRows = [
    ...(primaryAgentId
      ? [
          {
            projectId: project.id,
            agentAccountId: primaryAgentId,
            role: "primary" as const,
          },
        ]
      : []),
    ...secondaryIds.map((agentAccountId) => ({
      projectId: project.id,
      agentAccountId,
      role: "secondary" as const,
    })),
  ];
  if (joinRows.length > 0) {
    await db.insert(projectAgents).values(joinRows);
  }

  return json({ project }, { status: 201 });
}
