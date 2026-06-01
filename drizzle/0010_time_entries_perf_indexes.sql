-- Two targeted time_entries indexes from the 2026-06-01 performance audit (P1 #9).
--
-- 1. (user_id, project_id, date DESC) — the entries-list "filter by project" path
--    and the project-hours/recent-entries lookups, so a project filter is index-served
--    instead of scanning the user's whole date index then filtering by project.
-- 2. partial (user_id, date) WHERE is_billable — the earnings/billable aggregates,
--    which only ever look at billable rows.
--
-- Apply with the ADMIN role, NOT db:migrate (meta is drifted):
--   psql "$DATABASE_URL_ADMIN" -f drizzle/0010_time_entries_perf_indexes.sql
-- CONCURRENTLY can't run inside a transaction — psql autocommits each statement.
-- Apply to BOTH the Neon dev branch and the prod (main) branch.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_time_entries_user_project
  ON time_entries (user_id, project_id, date DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_time_entries_user_date_billable
  ON time_entries (user_id, date)
  WHERE is_billable = TRUE;
