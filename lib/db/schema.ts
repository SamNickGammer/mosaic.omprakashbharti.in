import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Enum-like string unions (stored as TEXT per PRD data model)
// ---------------------------------------------------------------------------
export type AgentProviderId =
  | "anthropic"
  | "openai"
  | "github_copilot"
  | "custom";
export type ProjectAgentRole = "primary" | "secondary";
export type TaskStatus = "backlog" | "in_progress" | "review" | "done";
export type TaskPriority = "low" | "medium" | "high" | "critical";
// `role` doubles as the author kind on task_messages. "agent" = live session
// output; "assistant" = legacy direct-call replies; "system" = system notices.
export type MessageRole =
  | "user"
  | "assistant"
  | "agent"
  | "agent_trace"
  | "system";
export type TraceRole =
  | "primary_analysis"
  | "secondary_review"
  | "final_merge";
export type AgentSessionType = "claude_code" | "codex" | "copilot" | "custom";
export type AgentSessionStatus =
  | "idle"
  | "working"
  | "needs_attention"
  | "offline";
export type SessionAuthorKind = "user" | "agent";

// ---------------------------------------------------------------------------
// users
// ---------------------------------------------------------------------------
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  image: text("image"),
  // scrypt hash (salt:hash hex) for email/password sign-in. Null for OAuth-only
  // accounts. Never logged or returned to the client.
  passwordHash: text("password_hash"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ---------------------------------------------------------------------------
// clients
// ---------------------------------------------------------------------------
export const clients = pgTable("clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color"),
  icon: text("icon"),
  description: text("description"),
  archived: boolean("archived").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ---------------------------------------------------------------------------
// agent_accounts (encrypted credentials)
// ---------------------------------------------------------------------------
export const agentAccounts = pgTable("agent_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  provider: text("provider").$type<AgentProviderId>().notNull(),
  model: text("model"),
  apiKeyEncrypted: text("api_key_encrypted").notNull(),
  baseUrl: text("base_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ---------------------------------------------------------------------------
// projects
// ---------------------------------------------------------------------------
export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  repoUrl: text("repo_url"),
  context: text("context"),
  primaryAgentId: uuid("primary_agent_id").references(() => agentAccounts.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ---------------------------------------------------------------------------
// project_agents (project <-> agent join, secondaries + primary role)
// ---------------------------------------------------------------------------
export const projectAgents = pgTable(
  "project_agents",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    agentAccountId: uuid("agent_account_id")
      .notNull()
      .references(() => agentAccounts.id, { onDelete: "cascade" }),
    role: text("role").$type<ProjectAgentRole>().default("secondary").notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.projectId, t.agentAccountId] }),
  }),
);

// ---------------------------------------------------------------------------
// tasks
// ---------------------------------------------------------------------------
export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  instructions: text("instructions"),
  status: text("status").$type<TaskStatus>().default("backlog").notNull(),
  priority: text("priority").$type<TaskPriority>().default("medium").notNull(),
  position: integer("position").default(0).notNull(),
  // Set when a live session claims the task (first-come-first-served).
  claimedBySessionId: uuid("claimed_by_session_id").references(
    () => agentSessions.id,
    { onDelete: "set null" },
  ),
  // Optional: aim a task at one participant. Null = the default (or any) claims.
  assignedSessionId: uuid("assigned_session_id").references(
    () => agentSessions.id,
    { onDelete: "set null" },
  ),
  // Set when one agent dispatched this task to another ("ask"): the asker to
  // report the result back to (mirrored into the room chat on completion).
  originSessionId: uuid("origin_session_id").references(
    () => agentSessions.id,
    { onDelete: "set null" },
  ),
  // For an "ask" task: the task the asker was working on. When the ask
  // completes, that origin task is re-queued with the reply so the asker
  // re-runs and folds it in. Self-ref, so declared as a plain column below.
  originTaskId: uuid("origin_task_id"),
  // Who created this task: an agent session (via /room/ask), or null = the user
  // (created from the board). Surfaces "added by" in the UI.
  createdBySessionId: uuid("created_by_session_id").references(
    () => agentSessions.id,
    { onDelete: "set null" },
  ),
  // Set when a session raises an attention flag; cleared on resume.
  attentionMessage: text("attention_message"),
  // One-line summary set when a session marks the task complete.
  result: text("result"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ---------------------------------------------------------------------------
// task_messages
// ---------------------------------------------------------------------------
export const taskMessages = pgTable("task_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  role: text("role").$type<MessageRole>().notNull(),
  content: text("content").notNull(),
  agentId: uuid("agent_id").references(() => agentAccounts.id, {
    onDelete: "set null",
  }),
  // Set when the message came from / is destined for a live agent session.
  sessionId: uuid("session_id").references(() => agentSessions.id, {
    onDelete: "set null",
  }),
  // True for streamed session output chunks (vs. discrete comments/messages).
  isStreamChunk: boolean("is_stream_chunk").default(false).notNull(),
  isTrace: boolean("is_trace").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ---------------------------------------------------------------------------
// orchestration_traces
// ---------------------------------------------------------------------------
export const orchestrationTraces = pgTable("orchestration_traces", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskMessageId: uuid("task_message_id")
    .notNull()
    .references(() => taskMessages.id, { onDelete: "cascade" }),
  step: integer("step").notNull(),
  agentId: uuid("agent_id").references(() => agentAccounts.id, {
    onDelete: "set null",
  }),
  role: text("role").$type<TraceRole>().notNull(),
  input: text("input"),
  output: text("output"),
  tokensUsed: integer("tokens_used"),
  durationMs: integer("duration_ms"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ---------------------------------------------------------------------------
// agent_sessions (live webhook-connected AI sessions)
// ---------------------------------------------------------------------------
export const agentSessions = pgTable("agent_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  agentType: text("agent_type").$type<AgentSessionType>().notNull(),
  // Exactly one participant per project room is the default: it fields
  // unaddressed user questions and leads cross-agent debates.
  isDefault: boolean("is_default").default(false).notNull(),
  // 40-char random hex bearer token, stored plain (already high-entropy).
  // Nullable so revoke can null it out (NULLs are exempt from UNIQUE).
  token: text("token").unique(),
  tokenPrefix: text("token_prefix").notNull(),
  status: text("status")
    .$type<AgentSessionStatus>()
    .default("offline")
    .notNull(),
  currentTaskId: uuid("current_task_id"),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  // Cursor for the unified inbox: room messages with created_at after this have
  // not yet been delivered to this session via /next?inbox=1. Set to "now" on
  // first inbox poll so a fresh agent doesn't replay old chat.
  roomCursorAt: timestamp("room_cursor_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ---------------------------------------------------------------------------
// task_attachments (files referenced by a task; stored in Blob — Phase 2+)
// ---------------------------------------------------------------------------
export const taskAttachments = pgTable("task_attachments", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  url: text("url").notNull(),
  mime: text("mime"),
  sizeBytes: integer("size_bytes"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ---------------------------------------------------------------------------
// session_messages (direct chat with a session, outside of tasks)
// ---------------------------------------------------------------------------
export const sessionMessages = pgTable("session_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => agentSessions.id, { onDelete: "cascade" }),
  authorKind: text("author_kind").$type<SessionAuthorKind>().notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ---------------------------------------------------------------------------
// room_messages (the shared project "room" chat + cross-agent debate bus)
// ---------------------------------------------------------------------------
// One conversation per project. Every participant (agent session) and the user
// post here; each message carries who authored it and, optionally, who it is
// addressed to. Non-default agents only "wake" for messages addressed to them;
// the default agent also fields unaddressed user questions.
export const roomMessages = pgTable("room_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  authorKind: text("author_kind").$type<SessionAuthorKind>().notNull(),
  // Which participant authored this (null when authorKind === "user").
  authorSessionId: uuid("author_session_id").references(
    () => agentSessions.id,
    { onDelete: "set null" },
  ),
  // Directed message: the participant this is addressed to. Null = addressed to
  // the room's default agent (user questions) / a broadcast.
  mentionSessionId: uuid("mention_session_id").references(
    () => agentSessions.id,
    { onDelete: "set null" },
  ),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}, (t) => ({
  projectCreatedIdx: index("room_messages_project_created_idx").on(
    t.projectId,
    t.createdAt,
  ),
  mentionIdx: index("room_messages_mention_idx").on(t.mentionSessionId),
}));

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------
export const usersRelations = relations(users, ({ many }) => ({
  clients: many(clients),
  agentAccounts: many(agentAccounts),
}));

export const clientsRelations = relations(clients, ({ one, many }) => ({
  user: one(users, { fields: [clients.userId], references: [users.id] }),
  projects: many(projects),
}));

export const agentAccountsRelations = relations(
  agentAccounts,
  ({ one, many }) => ({
    user: one(users, {
      fields: [agentAccounts.userId],
      references: [users.id],
    }),
    projectAgents: many(projectAgents),
  }),
);

export const projectsRelations = relations(projects, ({ one, many }) => ({
  client: one(clients, {
    fields: [projects.clientId],
    references: [clients.id],
  }),
  primaryAgent: one(agentAccounts, {
    fields: [projects.primaryAgentId],
    references: [agentAccounts.id],
  }),
  projectAgents: many(projectAgents),
  tasks: many(tasks),
  sessions: many(agentSessions),
  roomMessages: many(roomMessages),
}));

export const projectAgentsRelations = relations(projectAgents, ({ one }) => ({
  project: one(projects, {
    fields: [projectAgents.projectId],
    references: [projects.id],
  }),
  agentAccount: one(agentAccounts, {
    fields: [projectAgents.agentAccountId],
    references: [agentAccounts.id],
  }),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id],
  }),
  claimedBySession: one(agentSessions, {
    fields: [tasks.claimedBySessionId],
    references: [agentSessions.id],
  }),
  messages: many(taskMessages),
  attachments: many(taskAttachments),
}));

export const agentSessionsRelations = relations(
  agentSessions,
  ({ one, many }) => ({
    project: one(projects, {
      fields: [agentSessions.projectId],
      references: [projects.id],
    }),
    messages: many(sessionMessages),
  }),
);

export const taskAttachmentsRelations = relations(
  taskAttachments,
  ({ one }) => ({
    task: one(tasks, {
      fields: [taskAttachments.taskId],
      references: [tasks.id],
    }),
  }),
);

export const sessionMessagesRelations = relations(
  sessionMessages,
  ({ one }) => ({
    session: one(agentSessions, {
      fields: [sessionMessages.sessionId],
      references: [agentSessions.id],
    }),
  }),
);

export const roomMessagesRelations = relations(roomMessages, ({ one }) => ({
  project: one(projects, {
    fields: [roomMessages.projectId],
    references: [projects.id],
  }),
  author: one(agentSessions, {
    fields: [roomMessages.authorSessionId],
    references: [agentSessions.id],
    relationName: "room_message_author",
  }),
  mention: one(agentSessions, {
    fields: [roomMessages.mentionSessionId],
    references: [agentSessions.id],
    relationName: "room_message_mention",
  }),
}));

export const taskMessagesRelations = relations(
  taskMessages,
  ({ one, many }) => ({
    task: one(tasks, {
      fields: [taskMessages.taskId],
      references: [tasks.id],
    }),
    traces: many(orchestrationTraces),
  }),
);

export const orchestrationTracesRelations = relations(
  orchestrationTraces,
  ({ one }) => ({
    taskMessage: one(taskMessages, {
      fields: [orchestrationTraces.taskMessageId],
      references: [taskMessages.id],
    }),
  }),
);

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
export type AgentAccount = typeof agentAccounts.$inferSelect;
export type NewAgentAccount = typeof agentAccounts.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type ProjectAgent = typeof projectAgents.$inferSelect;
export type NewProjectAgent = typeof projectAgents.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type TaskMessage = typeof taskMessages.$inferSelect;
export type NewTaskMessage = typeof taskMessages.$inferInsert;
export type OrchestrationTrace = typeof orchestrationTraces.$inferSelect;
export type NewOrchestrationTrace = typeof orchestrationTraces.$inferInsert;
export type AgentSession = typeof agentSessions.$inferSelect;
export type NewAgentSession = typeof agentSessions.$inferInsert;
export type TaskAttachment = typeof taskAttachments.$inferSelect;
export type NewTaskAttachment = typeof taskAttachments.$inferInsert;
export type SessionMessage = typeof sessionMessages.$inferSelect;
export type NewSessionMessage = typeof sessionMessages.$inferInsert;
export type RoomMessage = typeof roomMessages.$inferSelect;
export type NewRoomMessage = typeof roomMessages.$inferInsert;
