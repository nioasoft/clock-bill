-- Composite indexes for dashboard and listing performance
CREATE INDEX IF NOT EXISTS "idx_time_entries_user_id_date" ON "time_entries" ("user_id", "date");
CREATE INDEX IF NOT EXISTS "idx_projects_user_id_status" ON "projects" ("user_id", "status");
CREATE INDEX IF NOT EXISTS "idx_clients_user_id_is_active" ON "clients" ("user_id", "is_active");

-- Partial unique index to prevent concurrent running timers per user
CREATE UNIQUE INDEX IF NOT EXISTS "idx_one_running_timer_per_user"
  ON "time_entries" ("user_id")
  WHERE start_time IS NOT NULL AND end_time IS NULL;
