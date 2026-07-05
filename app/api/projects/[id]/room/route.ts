import { and, eq } from "drizzle-orm";

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
import { listParticipants, listRoomMessages, postRoomMessage } from "@/lib/room";

export const runtime = "nodejs";

type Params = { params: { id: string } };

export async function GET(_req: Request, { params }: Params) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const project = await getOwnedProject(userId, params.id);
  if (!project) return notFound("Project not found");

  const [participants, messages] = await Promise.all([
    listParticipants(project.id),
    listRoomMessages(project.id),
  ]);

  return json({
    projectId: project.id,
    defaultSessionId: participants.find((p) => p.isDefault)?.id ?? null,
    participants,
    messages,
  });
}

export async function POST(req: Request, { params }: Params) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const project = await getOwnedProject(userId, params.id);
  if (!project) return notFound("Project not found");

  let body: { content?: string; to?: string | null };
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const content = body.content?.trim();
  if (!content) return badRequest("content is required");

  // Addressee (if any) must be a participant in this project.
  let mentionSessionId: string | null = null;
  if (body.to) {
    const [target] = await db
      .select({ id: agentSessions.id })
      .from(agentSessions)
      .where(
        and(
          eq(agentSessions.id, body.to),
          eq(agentSessions.projectId, project.id),
        ),
      )
      .limit(1);
    if (!target) return badRequest("Addressee is not in this room");
    mentionSessionId = target.id;
  }

  const message = await postRoomMessage({
    projectId: project.id,
    authorKind: "user",
    authorSessionId: null,
    mentionSessionId,
    content,
  });

  return json({ ok: true, message });
}
