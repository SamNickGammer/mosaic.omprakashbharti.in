import { and, asc, eq, gt, isNotNull, isNull, ne, or } from "drizzle-orm";

import { db } from "@/lib/db";
import { agentSessions, roomMessages } from "@/lib/db/schema";
import type {
  AgentSession,
  RoomMessage,
  SessionAuthorKind,
} from "@/lib/db/schema";
import { broadcast, roomChannel } from "@/lib/sse/broadcast";

export interface RoomParticipant {
  id: string;
  name: string;
  agentType: string;
  status: string;
  isDefault: boolean;
  lastSeenAt: string | null;
}

/** The wire shape of a room message returned to browsers and agents. */
export interface RoomMessageView {
  id: string;
  authorKind: SessionAuthorKind;
  authorSessionId: string | null;
  authorName: string | null;
  agentType: string | null;
  mentionSessionId: string | null;
  mentionName: string | null;
  content: string;
  createdAt: number;
}

/** All live (non-revoked) participants in a project's room, oldest first. */
export async function listParticipants(
  projectId: string,
): Promise<RoomParticipant[]> {
  const rows = await db
    .select()
    .from(agentSessions)
    .where(
      and(
        eq(agentSessions.projectId, projectId),
        isNotNull(agentSessions.token),
      ),
    )
    .orderBy(asc(agentSessions.createdAt));
  return rows.map((s) => ({
    id: s.id,
    name: s.name,
    agentType: s.agentType,
    status: s.status,
    isDefault: s.isDefault,
    lastSeenAt: s.lastSeenAt?.toISOString() ?? null,
  }));
}

function toView(
  row: RoomMessage,
  byId: Map<string, RoomParticipant>,
): RoomMessageView {
  const author = row.authorSessionId ? byId.get(row.authorSessionId) : null;
  const mention = row.mentionSessionId ? byId.get(row.mentionSessionId) : null;
  return {
    id: row.id,
    authorKind: row.authorKind,
    authorSessionId: row.authorSessionId,
    authorName: author?.name ?? null,
    agentType: author?.agentType ?? null,
    mentionSessionId: row.mentionSessionId,
    mentionName: mention?.name ?? null,
    content: row.content,
    createdAt: row.createdAt.getTime(),
  };
}

/** Full room history (all authors), oldest first — for the browser room view. */
export async function listRoomMessages(
  projectId: string,
): Promise<RoomMessageView[]> {
  const [rows, participants] = await Promise.all([
    db
      .select()
      .from(roomMessages)
      .where(eq(roomMessages.projectId, projectId))
      .orderBy(asc(roomMessages.createdAt)),
    listParticipants(projectId),
  ]);
  const byId = new Map(participants.map((p) => [p.id, p]));
  return rows.map((r) => toView(r, byId));
}

/**
 * Room messages a given participant should receive since `since`, newest-cursor
 * semantics. A participant gets messages addressed to it; the default (lead)
 * agent additionally gets unaddressed messages (user questions, room
 * broadcasts). A participant never receives its own messages.
 */
export async function roomMessagesForSession(params: {
  session: AgentSession;
  since: Date;
  userOnly?: boolean;
}): Promise<RoomMessageView[]> {
  const { session, since, userOnly } = params;
  const addressing = session.isDefault
    ? or(
        eq(roomMessages.mentionSessionId, session.id),
        isNull(roomMessages.mentionSessionId),
      )
    : eq(roomMessages.mentionSessionId, session.id);

  const rows = await db
    .select()
    .from(roomMessages)
    .where(
      and(
        eq(roomMessages.projectId, session.projectId),
        gt(roomMessages.createdAt, since),
        or(
          isNull(roomMessages.authorSessionId),
          ne(roomMessages.authorSessionId, session.id),
        ),
        // Inbox only surfaces the human's messages; agent-to-agent coordination
        // rides tasks/asks, so agents never re-handle each other's chat here.
        userOnly ? eq(roomMessages.authorKind, "user") : undefined,
        addressing,
      ),
    )
    .orderBy(asc(roomMessages.createdAt));

  const participants = await listParticipants(session.projectId);
  const byId = new Map(participants.map((p) => [p.id, p]));
  return rows.map((r) => toView(r, byId));
}

/**
 * Insert a room message, broadcast it to the project's SSE channel, and return
 * the wire view. `authorSessionId` is null for user messages; `mentionSessionId`
 * is null for messages addressed to the room / default agent.
 */
export async function postRoomMessage(params: {
  projectId: string;
  authorKind: SessionAuthorKind;
  authorSessionId: string | null;
  mentionSessionId: string | null;
  content: string;
}): Promise<RoomMessageView> {
  const [row] = await db
    .insert(roomMessages)
    .values({
      projectId: params.projectId,
      authorKind: params.authorKind,
      authorSessionId: params.authorSessionId,
      mentionSessionId: params.mentionSessionId,
      content: params.content,
    })
    .returning();

  const participants = await listParticipants(params.projectId);
  const byId = new Map(participants.map((p) => [p.id, p]));
  const view = toView(row, byId);

  broadcast(roomChannel(params.projectId), "room_message", { message: view });
  return view;
}
