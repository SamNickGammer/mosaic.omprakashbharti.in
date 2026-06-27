import crypto from "node:crypto";
import { asc, eq } from "drizzle-orm";

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
import { buildBootstrapPrompt } from "@/lib/bootstrap-prompt";

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

  let body: { name?: string; agentType?: string; agent_type?: string };
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

  // 40-char random hex token, stored plain (high-entropy already).
  const token = crypto.randomBytes(20).toString("hex");
  const tokenPrefix = token.slice(0, 8);

  const [session] = await db
    .insert(agentSessions)
    .values({
      projectId: project.id,
      name,
      agentType,
      token,
      tokenPrefix,
      status: "offline",
    })
    .returning();

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const bootstrapPrompt = buildBootstrapPrompt({
    token,
    projectName: project.name,
    baseUrl,
  });

  return json(
    {
      session: {
        id: session.id,
        name: session.name,
        agentType: session.agentType,
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
