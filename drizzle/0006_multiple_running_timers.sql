-- Allow MULTIPLE concurrent running timers per user.
-- Applied manually via psql (DATABASE_URL_ADMIN) because the drizzle migration
-- meta is drifted from prod; src/db/schema.ts is the source of truth.
DROP INDEX IF EXISTS "idx_one_running_timer_per_user";
CREATE INDEX IF NOT EXISTS "idx_running_timers_per_user"
  ON "time_entries" ("user_id")
  WHERE start_time IS NOT NULL AND end_time IS NULL;
