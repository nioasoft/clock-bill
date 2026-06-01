-- Migrate currency_rates from a global table to a per-user one (2026-06-01).
--
-- The whole app layer (app/api/currency-rates, settings, reports) was written
-- against a per-user shape (user_id, from_currency, to_currency, created_at),
-- but the migrated table was global (base_currency, target_currency, no
-- user_id) — so GET /api/currency-rates 500'd with `column "user_id" does not
-- exist`. The table was empty, so we recreate it cleanly.
--
-- Apply with the privileged role (neondb_owner / DATABASE_URL_ADMIN), like the
-- rest of drizzle/rls-policies.sql. Not run by drizzle-kit.

DROP TABLE IF EXISTS currency_rates;

CREATE TABLE currency_rates (
  id text PRIMARY KEY NOT NULL,
  user_id text NOT NULL,
  from_currency text NOT NULL,
  to_currency text NOT NULL,
  rate real NOT NULL,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  CONSTRAINT currency_rates_user_from_to_unique UNIQUE (user_id, from_currency, to_currency)
);
CREATE INDEX idx_currency_rates_user_id ON currency_rates (user_id);

-- Restricted app role needs CRUD (defense in depth; default privileges also apply).
GRANT SELECT, INSERT, UPDATE, DELETE ON currency_rates TO clockbill_app;

-- RLS: per-user isolation, same pattern as the other tenant tables.
ALTER TABLE currency_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE currency_rates FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON currency_rates;
CREATE POLICY tenant_isolation ON currency_rates FOR ALL
  USING (user_id = current_setting('app.current_user_id', true))
  WITH CHECK (user_id = current_setting('app.current_user_id', true));
