import { and, asc, eq, isNotNull, ne } from "drizzle-orm";

import {
  badRequest,
  getSessionUserId,
  json,
  notFound,
  unauthorized,
} from "@/lib/api";
import { getOwnedProject } from "@/lib/authz";
import { db } from "@/lib/db";
import { agentSessions } from "@/lib/db/schema";

export const runtime = "nodejs";

type Params = { params: { id: string; sessionId: string } };

async function loadSessionInProject(projectId: string, sessionId: string) {
  const [session] = await db
    .select()
    .from(agentSessions)
    .where(
      and(
        eq(agentSessions.id, sessionId),
        eq(agentSessions.projectId, projectId),
      ),
    )
    .limit(1);
  return session ?? null;
}

/** Rename a participant and/or promote it to the room's default (lead) agent. */
export async function PATCH(req: Request, { params }: Params) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const project = await getOwnedProject(userId, params.id);
  if (!project) return notFound("Project not found");

  const session = await loadSessionInProject(project.id, params.sessionId);
  if (!session) return notFound("Session not found");

  let body: { makeDefault?: boolean; name?: string };
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const name = body.name?.trim();
  if (name !== undefined && name.length === 0) {
    return badRequest("Name cannot be empty");
  }

  if (name) {
    await db
      .update(agentSessions)
      .set({ name })
      .where(eq(agentSessions.id, session.id));
  }

  if (body.makeDefault === true) {
    // Demote every other participant, then promote this one.
    await db
      .update(agentSessions)
      .set({ isDefault: false })
      .where(
        and(
          eq(agentSessions.projectId, project.id),
          ne(agentSessions.id, session.id),
        ),
      );
    await db
      .update(agentSessions)
      .set({ isDefault: true })
      .where(eq(agentSessions.id, session.id));
  }

  return json({ ok: true });
}

/** Revoke a participant. Promotes another live agent to default if needed. */
export async function DELETE(_req: Request, { params }: Params) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const project = await getOwnedProject(userId, params.id);
  if (!project) return notFound("Project not found");

  const session = await loadSessionInProject(project.id, params.sessionId);
  if (!session) return notFound("Session not found");

  await db
    .update(agentSessions)
    .set({ token: null, status: "offline", isDefault: false })
    .where(eq(agentSessions.id, session.id));

  // If we just revoked the default, hand the lead role to the oldest remaining
  // live participant so the room keeps a default.
  if (session.isDefault) {
    const [next] = await db
      .select({ id: agentSessions.id })
      .from(agentSessions)
      .where(
        and(
          eq(agentSessions.projectId, project.id),
          isNotNull(agentSessions.token),
        ),
      )
      .orderBy(asc(agentSessions.createdAt))
      .limit(1);
    if (next) {
      await db
        .update(agentSessions)
        .set({ isDefault: true })
        .where(eq(agentSessions.id, next.id));
    }
  }

  return json({ ok: true });
}
