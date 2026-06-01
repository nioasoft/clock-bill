-- Covering index for dashboard/report aggregates on time_entries.
-- Lets SUM(duration)/billable totals over a (user_id, date) range read straight
-- from the index without a per-row heap fetch. Drizzle 0.45 can't express
-- INCLUDE, so this lives out-of-band and is documented in src/db/schema.ts.
--
-- Apply with the ADMIN role (privileged), NOT db:migrate (meta is drifted):
--   psql "$DATABASE_URL_ADMIN" -f drizzle/0008_time_entries_covering_index.sql
-- CONCURRENTLY = zero downtime, but it CANNOT run inside a transaction block.
-- Run this file on its own (psql autocommits each statement).
-- Must be applied to BOTH the Neon dev branch and the prod (main) branch.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_time_entries_user_date_covering
  ON time_entries (user_id, date)
  INCLUDE (duration, is_billable, project_id);
