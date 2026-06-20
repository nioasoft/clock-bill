-- Idempotency log for trial lifecycle emails.
CREATE TABLE IF NOT EXISTS trial_emails_sent (
  id         text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id    text NOT NULL,
  email_key  text NOT NULL,
  sent_at    timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS trial_emails_sent_user_key
  ON trial_emails_sent (user_id, email_key);
