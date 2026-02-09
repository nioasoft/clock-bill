CREATE TABLE "tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'todo',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "tasks_status_check" CHECK ("tasks"."status" IN ('todo', 'in_progress', 'done'))
);
--> statement-breakpoint
ALTER TABLE "rate_overrides" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "rate_overrides" CASCADE;--> statement-breakpoint
ALTER TABLE "projects" DROP CONSTRAINT "projects_pricing_model_check";--> statement-breakpoint
ALTER TABLE "time_entries" ADD COLUMN "task_id" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_tasks_project_id" ON "tasks" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_tasks_user_id" ON "tasks" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_time_entries_task_id" ON "time_entries" USING btree ("task_id");--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "pricing_model";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "hourly_rate";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "package_price";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "package_hours";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "overage_rate";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "fixed_budget";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "retainer_monthly_fee";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "retainer_hours";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "currency";