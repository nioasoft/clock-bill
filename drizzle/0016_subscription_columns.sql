-- Subscription columns on user_profiles (Polar entitlements).
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS subscription_tier text DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS subscription_status text,
  ADD COLUMN IF NOT EXISTS subscription_period_end timestamp,
  ADD COLUMN IF NOT EXISTS polar_subscription_id text,
  ADD COLUMN IF NOT EXISTS founding boolean DEFAULT false;
