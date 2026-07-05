ALTER TABLE "tasks" ADD COLUMN "origin_task_id" uuid;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "created_by_session_id" uuid;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_session_id_agent_sessions_id_fk" FOREIGN KEY ("created_by_session_id") REFERENCES "public"."agent_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_origin_task_id_tasks_id_fk" FOREIGN KEY ("origin_task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;
