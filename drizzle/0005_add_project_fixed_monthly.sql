ALTER TABLE "projects" ADD COLUMN "fixed_monthly_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "fixed_monthly_fee" real;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "fixed_monthly_start_date" date;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "fixed_monthly_end_date" date;
