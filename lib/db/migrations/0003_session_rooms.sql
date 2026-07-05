CREATE TABLE "room_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"author_kind" text NOT NULL,
	"author_session_id" uuid,
	"mention_session_id" uuid,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_sessions" ADD COLUMN "is_default" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "assigned_session_id" uuid;--> statement-breakpoint
ALTER TABLE "room_messages" ADD CONSTRAINT "room_messages_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_messages" ADD CONSTRAINT "room_messages_author_session_id_agent_sessions_id_fk" FOREIGN KEY ("author_session_id") REFERENCES "public"."agent_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_messages" ADD CONSTRAINT "room_messages_mention_session_id_agent_sessions_id_fk" FOREIGN KEY ("mention_session_id") REFERENCES "public"."agent_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "room_messages_project_created_idx" ON "room_messages" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "room_messages_mention_idx" ON "room_messages" USING btree ("mention_session_id");--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_session_id_agent_sessions_id_fk" FOREIGN KEY ("assigned_session_id") REFERENCES "public"."agent_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Backfill: make the earliest live session in each project its room's default.
UPDATE "agent_sessions" a SET "is_default" = true WHERE a."token" IS NOT NULL AND a."id" = (SELECT a2."id" FROM "agent_sessions" a2 WHERE a2."project_id" = a."project_id" AND a2."token" IS NOT NULL ORDER BY a2."created_at" ASC, a2."id" ASC LIMIT 1);
