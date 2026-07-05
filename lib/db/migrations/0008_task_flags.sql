ALTER TABLE "tasks" ADD COLUMN "bookmarked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "clear_before" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "compact_before" boolean DEFAULT false NOT NULL;