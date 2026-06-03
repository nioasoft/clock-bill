-- Query-latency indexes (DB audit 2026-06-03). All CONCURRENTLY + IF NOT EXISTS
-- so they are non-locking and idempotent. CONCURRENTLY cannot run inside a
-- transaction block — apply each statement on its own (psql one-shot, not db:migrate;
-- the Drizzle migration meta is drifted — see memory drizzle-meta-drift).
-- Apply to BOTH the Neon dev branch and main (prod) via DATABASE_URL_ADMIN.

-- 1. (HIGH) The entries list and dashboard recent-entries both
--    ORDER BY date DESC, created_at DESC. The existing (user_id, date) index
--    misses the created_at tiebreaker, forcing a top-N sort on every page over
--    the user's whole history. This index makes it an index-ordered read.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_time_entries_user_date_created
  ON time_entries (user_id, date DESC, created_at DESC);

-- 2. (MEDIUM) Dashboard earnings + 12-month chart run a LATERAL subquery that
--    probes client_rates per time_entries row, filtering
--    client_id + user_id + kind='hourly' + is_default. A tiny partial index turns
--    each probe into a single index hit.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_client_rates_default_hourly
  ON client_rates (client_id, user_id) WHERE kind = 'hourly' AND is_default = TRUE;

-- 3. (LOW) Dashboard upcomingDeadlines filters user_id + end_date range and sorts
--    by end_date; no supporting index today. Partial keeps it small.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_user_enddate
  ON projects (user_id, end_date) WHERE end_date IS NOT NULL;
