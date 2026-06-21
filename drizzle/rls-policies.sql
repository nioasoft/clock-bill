-- Row-Level Security setup for Monit (applied 2026-05-30).
--
-- This documents the DB-side RLS objects that live in the Neon database (they
-- are NOT created by drizzle-kit migrations). Re-run against a fresh DB/branch
-- to reproduce. Run as a privileged role (neondb_owner / DATABASE_URL_ADMIN).
--
-- Architecture:
--   * App runtime connects as the restricted role `clockbill_app`
--     (NOSUPERUSER, NOBYPASSRLS) via DATABASE_URL.
--   * Migrations/admin connect as neondb_owner via DATABASE_URL_ADMIN.
--   * lib/db.ts sets `app.current_user_id` (transaction-local) on each authed
--     query; policies below read it via current_setting(..., true).
--   * App-level `WHERE user_id = $` filtering remains as belt-and-suspenders.

-- 1. Restricted application role (set a real password when creating).
--    CREATE ROLE clockbill_app LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD '<password>';

-- 2. Privileges (no DDL — CRUD only).
GRANT CONNECT ON DATABASE neondb TO clockbill_app;
GRANT USAGE ON SCHEMA public TO clockbill_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO clockbill_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO clockbill_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO clockbill_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO clockbill_app;

-- 3. Enable + FORCE RLS and the tenant-isolation policy on user-scoped tables.
--    Better Auth tables (user/session/account/verification) are intentionally
--    NOT covered — the app role needs full access to them and they carry no user_id.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['user_profiles','clients','projects','tasks','time_entries','report_presets','client_rates','currency_rates','charge_documents','charge_document_lines','charge_document_payments','push_subscriptions','trial_emails_sent']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format($p$CREATE POLICY tenant_isolation ON %I FOR ALL
      USING (user_id = current_setting('app.current_user_id', true))
      WITH CHECK (user_id = current_setting('app.current_user_id', true))$p$, t);
  END LOOP;
END $$;

-- custom_tags additionally exposes shared 'system' tags for reads.
ALTER TABLE custom_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_tags FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON custom_tags;
CREATE POLICY tenant_isolation ON custom_tags FOR ALL
  USING (user_id = current_setting('app.current_user_id', true) OR user_id = 'system')
  WITH CHECK (user_id = current_setting('app.current_user_id', true));

-- client_rates: explicit grant (defense in depth; default privileges also apply).
GRANT SELECT, INSERT, UPDATE, DELETE ON client_rates TO clockbill_app;

-- charge_documents / charge_document_lines: explicit grants (defense in depth).
GRANT SELECT, INSERT, UPDATE, DELETE ON charge_documents      TO clockbill_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON charge_document_lines TO clockbill_app;

-- audit_events is intentionally NOT tenant-scoped: it is ENABLE+FORCE RLS with
-- NO policy (see drizzle/0030_audit_events.sql), so the restricted app role can
-- neither read nor write it. Only the privileged admin connection touches it.

-- Drift check (run as admin): every user-scoped table must have RLS enabled+forced.
-- SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class
-- WHERE relname = ANY(ARRAY['user_profiles','clients','projects','tasks','time_entries',
--   'report_presets','client_rates','currency_rates','charge_documents',
--   'charge_document_lines','charge_document_payments','push_subscriptions','trial_emails_sent','custom_tags','audit_events'])
-- ORDER BY relname;  -- expect all t/t. See scripts/check-rls.mjs.
