ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS billing_provider text DEFAULT 'polar';
