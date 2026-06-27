import { and, eq, inArray } from "drizzle-orm";

import {
  badRequest,
  getSessionUserId,
  json,
  notFound,
  unauthorized,
} from "@/lib/api";
import { getOwnedProject } from "@/lib/authz";
import { db } from "@/lib/db";
import { agentAccounts, projectAgents, projects } from "@/lib/db/schema";
import type { ProjectAgentDTO } from "@/types";

type Params = { params: { id: string } };

async function loadAgents(projectId: string): Promise<ProjectAgentDTO[]> {
  const rows = await db
    .select({
      id: agentAccounts.id,
      displayName: agentAccounts.displayName,
      provider: agentAccounts.provider,
      role: projectAgents.role,
    })
    .from(projectAgents)
    .innerJoin(
      agentAccounts,
      eq(projectAgents.agentAccountId, agentAccounts.id),
    )
    .where(eq(projectAgents.projectId, projectId));
  return rows;
}

export async function GET(_req: Request, { params }: Params) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const project = await getOwnedProject(userId, params.id);
  if (!project) return notFound("Project not found");

  const agents = await loadAgents(project.id);
  return json({ project: { ...project, agents } });
}

export async function PATCH(req: Request, { params }: Params) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const project = await getOwnedProject(userId, params.id);
  if (!project) return notFound("Project not found");

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

  const reassignAgents =
    body.primaryAgentId !== undefined || body.secondaryAgentIds !== undefined;

  const primaryAgentId =
    body.primaryAgentId !== undefined
      ? body.primaryAgentId || null
      : project.primaryAgentId;
  const secondaryIds = (body.secondaryAgentIds ?? []).filter(
    (id) => id && id !== primaryAgentId,
  );

  if (reassignAgents) {
    const referencedIds = [
      ...new Set(
        [primaryAgentId, ...secondaryIds].filter(
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
  }

  const updates: Partial<typeof projects.$inferInsert> = {};
  if (body.name !== undefined) {
    if (!body.name.trim()) return badRequest("Name cannot be empty");
    updates.name = body.name.trim();
  }
  if (body.description !== undefined)
    updates.description = body.description?.trim() || null;
  if (body.repoUrl !== undefined) updates.repoUrl = body.repoUrl?.trim() || null;
  if (body.context !== undefined) updates.context = body.context?.trim() || null;
  if (body.primaryAgentId !== undefined) updates.primaryAgentId = primaryAgentId;

  if (Object.keys(updates).length > 0) {
    await db.update(projects).set(updates).where(eq(projects.id, project.id));
  }

  if (reassignAgents) {
    await db
      .delete(projectAgents)
      .where(eq(projectAgents.projectId, project.id));
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
    if (joinRows.length > 0) await db.insert(projectAgents).values(joinRows);
  }

  const fresh = await getOwnedProject(userId, project.id);
  const agents = await loadAgents(project.id);
  return json({ project: { ...fresh, agents } });
}
