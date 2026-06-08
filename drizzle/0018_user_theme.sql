-- Selected UI theme per user (Theme Set feature). Defaults to the dark theme.
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS theme text DEFAULT 'dark';
