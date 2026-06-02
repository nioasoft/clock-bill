-- Billing time-rounding policy for hourly lines.
-- Per-client default + optional per-project override. Applied at billing time
-- (reports / charge documents); never mutates the raw worked duration.
--
-- Apply with the privileged role (DATABASE_URL_ADMIN), not db:migrate — see
-- memory drizzle-meta-drift. DEV applied; PROD pending.

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS billing_rounding text DEFAULT 'none';

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS billing_rounding text;

-- Backfill existing clients to the explicit default.
UPDATE clients SET billing_rounding = 'none' WHERE billing_rounding IS NULL;

-- Value guards (NULL allowed on projects = inherit client).
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_billing_rounding_check;
ALTER TABLE clients
  ADD CONSTRAINT clients_billing_rounding_check
  CHECK (billing_rounding IN ('none', 'hour_up', 'half_hour_up'));

ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_billing_rounding_check;
ALTER TABLE projects
  ADD CONSTRAINT projects_billing_rounding_check
  CHECK (billing_rounding IS NULL OR billing_rounding IN ('none', 'hour_up', 'half_hour_up'));
