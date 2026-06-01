-- Remove the pre-Better-Auth legacy auth tables and fix a latent bug they caused.
--
-- Context: auth migrated to Better Auth (tables user/session/account/verification).
-- The old `users`, `sessions`, `password_reset_tokens`, `email_verification_tokens`
-- tables are unused and EMPTY (0 rows on dev and prod, 2026-06-01).
--
-- Latent bug fixed here: `report_presets.user_id` still had a FK to the legacy
-- (empty) `users` table, so any INSERT with a Better Auth user_id violated the FK —
-- i.e. saving a report preset was impossible. We drop that stale FK; user_id stays a
-- loose text ref to the Better Auth user.id, like every other app table.
--
-- Apply with the ADMIN role, NOT db:migrate (meta is drifted):
--   psql "$DATABASE_URL_ADMIN" -f drizzle/0011_drop_legacy_auth_tables.sql
-- Apply to BOTH the Neon dev branch and the prod (main) branch.
-- All affected tables are empty, so there is no data loss. Neon PITR can recover if needed.

ALTER TABLE report_presets DROP CONSTRAINT IF EXISTS report_presets_user_id_users_id_fk;

DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS password_reset_tokens CASCADE;
DROP TABLE IF EXISTS email_verification_tokens CASCADE;
DROP TABLE IF EXISTS users CASCADE;
