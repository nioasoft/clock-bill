-- Profession onboarding + billing-base cascade.
-- New user_profiles base columns:
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS profession text,
  ADD COLUMN IF NOT EXISTS default_rate real,
  ADD COLUMN IF NOT EXISTS default_billing_rounding text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS onboarded boolean NOT NULL DEFAULT false;

-- CHECK for the profile-level rounding base (5-mode set).
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_default_billing_rounding_check;
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_default_billing_rounding_check
  CHECK (default_billing_rounding IN ('none','tenth_hour_up','quarter_hour_up','half_hour_up','hour_up'));

-- New-users-only: existing users never see onboarding.
UPDATE user_profiles SET onboarded = true;

-- Widen the rounding CHECK on clients + projects to the 5-mode set (NULL = inherit).
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_billing_rounding_check;
ALTER TABLE clients ADD CONSTRAINT clients_billing_rounding_check
  CHECK (billing_rounding IS NULL OR billing_rounding IN ('none','tenth_hour_up','quarter_hour_up','half_hour_up','hour_up'));

ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_billing_rounding_check;
ALTER TABLE projects ADD CONSTRAINT projects_billing_rounding_check
  CHECK (billing_rounding IS NULL OR billing_rounding IN ('none','tenth_hour_up','quarter_hour_up','half_hour_up','hour_up'));
