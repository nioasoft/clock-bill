ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "currency" text DEFAULT 'ILS';--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "is_retainer" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "retainer_hours" real;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "retainer_monthly_fee" real;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "overage_rate" real;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_clients_user_id_is_active" ON "clients" USING btree ("user_id","is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_projects_user_id_status" ON "projects" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_time_entries_user_id_date" ON "time_entries" USING btree ("user_id","date");