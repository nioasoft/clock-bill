-- 0007_per_client_rate_types.sql
-- Per-client rate types & items. Applied via psql + DATABASE_URL_ADMIN
-- (drizzle migration meta is drifted; do NOT use drizzle-kit).
-- Everything that exists today is programming work ("תכנות").

BEGIN;

-- 1. New table: client_rates (holds both hourly rates and fixed items).
CREATE TABLE IF NOT EXISTS client_rates (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  client_id text NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'hourly',
  name text NOT NULL,
  rate real NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamp DEFAULT NOW(),
  updated_at timestamp DEFAULT NOW(),
  CONSTRAINT client_rates_kind_check CHECK (kind IN ('hourly', 'item'))
);
CREATE INDEX IF NOT EXISTS idx_client_rates_client_id ON client_rates(client_id);
CREATE INDEX IF NOT EXISTS idx_client_rates_user_id ON client_rates(user_id);

-- 2. Snapshot columns on time_entries.
ALTER TABLE time_entries
  ADD COLUMN IF NOT EXISTS rate real,
  ADD COLUMN IF NOT EXISTS rate_label text,
  ADD COLUMN IF NOT EXISTS billing_kind text,
  ADD COLUMN IF NOT EXISTS quantity real;

-- 3. Seed one default hourly rate per existing client = "תכנות" at its default_rate.
INSERT INTO client_rates (id, user_id, client_id, kind, name, rate, is_default, created_at, updated_at)
SELECT gen_random_uuid()::text, user_id, id, 'hourly', 'תכנות', COALESCE(default_rate, 0), true, NOW(), NOW()
FROM clients
WHERE NOT EXISTS (SELECT 1 FROM client_rates cr WHERE cr.client_id = clients.id);

-- 4. Backfill existing entries as hourly "תכנות" at their client's current rate.
--    Guard on billing_kind IS NULL (NULL for every legacy row; rate may legitimately
--    be NULL when the client's default_rate is NULL -> still falls back in reports).
UPDATE time_entries te
SET rate_label = 'תכנות',
    billing_kind = 'hourly',
    rate = c.default_rate
FROM projects p
JOIN clients c ON c.id = p.client_id
WHERE te.project_id = p.id AND te.billing_kind IS NULL;

COMMIT;
