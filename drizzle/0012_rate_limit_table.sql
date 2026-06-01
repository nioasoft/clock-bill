-- Better Auth persistent rate-limit store (rateLimit storage: "database").
-- Without this table, BA keeps rate-limit counters in process memory, which on
-- Vercel's multi-instance serverless model means limits aren't shared between
-- instances. This table makes brute-force limits consistent across instances.
--
-- Keyed by IP/endpoint, NOT user → no RLS (like the other Better Auth tables).
-- Column names match Better Auth's rateLimit model (key, count, last_request).
--
-- Apply with the ADMIN role:
--   psql "$DATABASE_URL_ADMIN" -f drizzle/0012_rate_limit_table.sql
-- Apply to BOTH the Neon dev branch and the prod (main) branch.

CREATE TABLE IF NOT EXISTS rate_limit (
  id           text PRIMARY KEY,
  key          text UNIQUE,
  count        integer,
  last_request bigint
);
