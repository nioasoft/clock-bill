-- 0030: Append-only audit_events table for sensitive actions.
-- Written only via the privileged admin connection; RLS ENABLE+FORCE with no
-- policies so the restricted tenant role (clockbill_app) cannot read or write it.
--
-- Apply with the privileged admin role:
--   psql "$DATABASE_URL_ADMIN" -f drizzle/0030_audit_events.sql

CREATE TABLE IF NOT EXISTS audit_events (
  id          text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  actor_id    text NOT NULL,
  action      text NOT NULL,
  target_type text,
  target_id   text,
  ip          text,
  user_agent  text,
  metadata    jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_actor_id ON audit_events (actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_target ON audit_events (target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON audit_events (created_at);

-- Lock the table down: no policies + FORCE means the tenant role sees nothing.
-- The admin/owner role used by withAdminTransaction()/adminQuery() bypasses RLS.
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events FORCE ROW LEVEL SECURITY;
