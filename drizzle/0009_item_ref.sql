-- Item reference numbers ("אסמכתא") for item billing lines.
--
-- time_entries.item_ref : per-user monotonic number, set ONLY on item lines at
--   creation, NULL for hourly lines. Stable, never reused.
-- user_profiles.next_item_ref : per-user counter that feeds item_ref.
--
-- Apply with the ADMIN role, NOT db:migrate (meta is drifted):
--   psql "$DATABASE_URL_ADMIN" -f drizzle/0009_item_ref.sql
-- Must be applied to BOTH the Neon dev branch and the prod (main) branch.
-- Plain ALTERs (transactional) — safe to run as one batch.

ALTER TABLE time_entries  ADD COLUMN IF NOT EXISTS item_ref INTEGER;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS next_item_ref INTEGER NOT NULL DEFAULT 1;
