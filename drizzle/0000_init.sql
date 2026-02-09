CREATE TABLE "clients" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"contact_name" text,
	"email" text,
	"phone" text,
	"address" text,
	"default_rate" real,
	"notes" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "currency_rates" (
	"id" text PRIMARY KEY NOT NULL,
	"base_currency" text NOT NULL,
	"target_currency" text NOT NULL,
	"rate" real NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "currency_rates_base_currency_target_currency_unique" UNIQUE("base_currency","target_currency")
);
--> statement-breakpoint
CREATE TABLE "custom_tags" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"is_default" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "custom_tags_user_id_name_unique" UNIQUE("user_id","name")
);
--> statement-breakpoint
CREATE TABLE "email_verification_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "email_verification_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "password_reset_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"client_id" text NOT NULL,
	"name" text NOT NULL,
	"pricing_model" text DEFAULT 'hourly',
	"hourly_rate" real,
	"package_price" real,
	"package_hours" real,
	"overage_rate" real,
	"fixed_budget" real,
	"retainer_monthly_fee" real,
	"retainer_hours" real,
	"currency" text DEFAULT 'ILS',
	"status" text DEFAULT 'active',
	"start_date" date,
	"end_date" date,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "projects_pricing_model_check" CHECK ("projects"."pricing_model" IN ('hourly', 'package', 'mixed', 'fixed', 'retainer')),
	CONSTRAINT "projects_status_check" CHECK ("projects"."status" IN ('active', 'completed', 'paused', 'archived'))
);
--> statement-breakpoint
CREATE TABLE "rate_overrides" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"tag" text NOT NULL,
	"rate" real NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "rate_overrides_project_id_tag_unique" UNIQUE("project_id","tag")
);
--> statement-breakpoint
CREATE TABLE "report_presets" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"client_id" text,
	"project_id" text,
	"start_date" date,
	"end_date" date,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "time_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"project_id" text NOT NULL,
	"description" text NOT NULL,
	"start_time" timestamp,
	"end_time" timestamp,
	"duration" integer DEFAULT 0,
	"date" date NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"notes" text,
	"is_billable" boolean DEFAULT true,
	"paused_at" timestamp,
	"total_paused_time" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"business_name" text,
	"logo_url" text,
	"phone" text,
	"email" text,
	"address" text,
	"tax_id" text,
	"website" text,
	"default_currency" text DEFAULT 'ILS',
	"preferred_pdf_template" text DEFAULT 'modern',
	"invoice_prefix" text,
	"next_invoice_number" integer,
	"payment_terms" text,
	"bank_name" text,
	"bank_account_number" text,
	"bank_branch" text,
	"bank_swift" text,
	"signature_url" text,
	"pdf_primary_color" text DEFAULT '#2563EB',
	"pdf_accent_color" text DEFAULT '#059669',
	"working_hours" real DEFAULT 8,
	"long_timer_enabled" boolean DEFAULT true,
	"long_timer_threshold" integer DEFAULT 120,
	"daily_reminder_enabled" boolean DEFAULT false,
	"daily_reminder_time" text DEFAULT '09:00',
	"last_reminder_date" date,
	"date_format" text DEFAULT 'DD/MM/YYYY',
	"time_format" text DEFAULT '24h',
	"first_day_of_week" text DEFAULT 'sunday',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "user_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"email_verified" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_overrides" ADD CONSTRAINT "rate_overrides_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_presets" ADD CONSTRAINT "report_presets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_clients_user_id" ON "clients" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_custom_tags_user_id" ON "custom_tags" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_email_verification_tokens_token" ON "email_verification_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX "idx_email_verification_tokens_user_id" ON "email_verification_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_password_reset_tokens_token" ON "password_reset_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX "idx_password_reset_tokens_user_id" ON "password_reset_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_projects_user_id" ON "projects" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_projects_client_id" ON "projects" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_rate_overrides_project_id" ON "rate_overrides" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_report_presets_user_id" ON "report_presets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_user_id" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_token" ON "sessions" USING btree ("token");--> statement-breakpoint
CREATE INDEX "idx_time_entries_user_id" ON "time_entries" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_time_entries_project_id" ON "time_entries" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_time_entries_date" ON "time_entries" USING btree ("date");