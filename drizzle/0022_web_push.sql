-- 0022 Web Push: subscriptions table + per-user timezone + long-timer dedup marker.
-- Apply with the privileged admin role (DATABASE_URL_ADMIN / neondb_owner), NOT
-- the restricted clockbill_app role (no DDL). Drizzle meta is out of sync — this
-- is applied via psql, not drizzle-kit migrate (see project memory).

-- Per-user IANA timezone so the notifications cron can fire the daily reminder at
-- the user's local time. Defaults to Israel for the existing base; the client
-- overwrites it with the browser's detected zone on push subscribe.
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'Asia/Jerusalem';

-- Dedup marker: set when a long-timer push was sent for a running entry so it
-- fires once, not on every cron tick.
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS long_timer_notified_at timestamp;

-- Push subscription endpoints (one per browser/device).
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id text NOT NULL,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions (user_id);

-- RLS: tenant-isolate like the other user tables (cron reads cross-tenant via the
-- privileged admin connection, which bypasses RLS).
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON push_subscriptions;
CREATE POLICY tenant_isolation ON push_subscriptions FOR ALL
  USING (user_id = current_setting('app.current_user_id', true))
  WITH CHECK (user_id = current_setting('app.current_user_id', true));

-- Grants for the restricted app role (default privileges may already cover this).
GRANT SELECT, INSERT, UPDATE, DELETE ON push_subscriptions TO clockbill_app;
