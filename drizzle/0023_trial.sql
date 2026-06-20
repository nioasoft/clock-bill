-- Trial columns on user_profiles (14-day Unlimited trial on signup).
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS trial_started_at timestamp,
  ADD COLUMN IF NOT EXISTS trial_ends_at    timestamp,
  ADD COLUMN IF NOT EXISTS trial_used       boolean NOT NULL DEFAULT false;
