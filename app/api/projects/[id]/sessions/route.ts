import crypto from "node:crypto";
import { and, asc, eq, isNotNull } from "drizzle-orm";

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
import type { AgentSessionType } from "@/lib/db/schema";
import { AGENT_TYPE_LABEL } from "@/lib/session-meta";
import { buildBootstrapPrompt } from "@/lib/bootstrap-prompt";
import { resolveBaseUrl } from "@/lib/base-url";

export const runtime = "nodejs";

type Params = { params: { id: string } };

const AGENT_TYPES: AgentSessionType[] = [
  "claude_code",
  "codex",
  "copilot",
  "custom",
];

export async function GET(_req: Request, { params }: Params) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const project = await getOwnedProject(userId, params.id);
  if (!project) return notFound("Project not found");

  const rows = await db
    .select()
    .from(agentSessions)
    .where(eq(agentSessions.projectId, project.id))
    .orderBy(asc(agentSessions.createdAt));

  return json({
    sessions: rows.map((s) => ({
      id: s.id,
      name: s.name,
      agentType: s.agentType,
      isDefault: s.isDefault,
      tokenPrefix: s.tokenPrefix,
      status: s.status,
      currentTaskId: s.currentTaskId,
      lastSeenAt: s.lastSeenAt?.toISOString() ?? null,
      revoked: s.token === null,
    })),
  });
}

export async function POST(req: Request, { params }: Params) {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const project = await getOwnedProject(userId, params.id);
  if (!project) return notFound("Project not found");

  let body: {
    name?: string;
    agentType?: string;
    agent_type?: string;
    makeDefault?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const name = body.name?.trim();
  if (!name) return badRequest("Name is required");
  const agentTypeRaw = body.agentType ?? body.agent_type;
  if (!AGENT_TYPES.includes(agentTypeRaw as AgentSessionType)) {
    return badRequest("A valid agent type is required");
  }
  const agentType = agentTypeRaw as AgentSessionType;

  // The first live (non-revoked) participant in a project becomes the room's
  // default (lead) agent. Callers can also force it with `makeDefault: true`.
  const existing = await db
    .select({ id: agentSessions.id })
    .from(agentSessions)
    .where(
      and(
        eq(agentSessions.projectId, project.id),
        isNotNull(agentSessions.token),
      ),
    )
    .limit(1);
  const isDefault = body.makeDefault === true || existing.length === 0;

  // 40-char random hex token, stored plain (high-entropy already).
  const token = crypto.randomBytes(20).toString("hex");
  const tokenPrefix = token.slice(0, 8);

  const [session] = await db
    .insert(agentSessions)
    .values({
      projectId: project.id,
      name,
      agentType,
      isDefault,
      token,
      tokenPrefix,
      status: "offline",
    })
    .returning();

  // Only one default per room — demote any others.
  if (isDefault) {
    await db
      .update(agentSessions)
      .set({ isDefault: false })
      .where(
        and(
          eq(agentSessions.projectId, project.id),
          isNotNull(agentSessions.token),
        ),
      );
    await db
      .update(agentSessions)
      .set({ isDefault: true })
      .where(eq(agentSessions.id, session.id));
  }

  const baseUrl = resolveBaseUrl(req);
  const bootstrapPrompt = buildBootstrapPrompt({
    token,
    projectName: project.name,
    baseUrl,
    sessionName: session.name,
    agentTypeLabel: AGENT_TYPE_LABEL[agentType],
    isDefault,
  });

  return json(
    {
      session: {
        id: session.id,
        name: session.name,
        agentType: session.agentType,
        isDefault,
        tokenPrefix: session.tokenPrefix,
        status: session.status,
        currentTaskId: session.currentTaskId,
        lastSeenAt: null,
      },
      token, // only returned at creation time
      bootstrapPrompt,
    },
    { status: 201 },
  );
}
