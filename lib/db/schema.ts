import { relations } from "drizzle-orm";
import {
  boolean,
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
export type MessageRole = "user" | "assistant" | "agent_trace";
export type TraceRole =
  | "primary_analysis"
  | "secondary_review"
  | "final_merge";

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
  messages: many(taskMessages),
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
