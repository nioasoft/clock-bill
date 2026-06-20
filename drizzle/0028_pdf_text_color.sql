-- PDF: text color ON the filled brand colors (banner / filled table head / pill).
-- 'light' = white text, 'dark' = near-black. Keeps a light brand color legible.
-- Apply via: psql "$DATABASE_URL_ADMIN" -f drizzle/0028_pdf_text_color.sql  (dev, then prod)
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS pdf_primary_text text DEFAULT 'light';
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS pdf_accent_text text DEFAULT 'light';

ALTER TABLE user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_pdf_primary_text_check;
ALTER TABLE user_profiles
  ADD CONSTRAINT user_profiles_pdf_primary_text_check
  CHECK (pdf_primary_text IS NULL OR pdf_primary_text IN ('light', 'dark'));

ALTER TABLE user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_pdf_accent_text_check;
ALTER TABLE user_profiles
  ADD CONSTRAINT user_profiles_pdf_accent_text_check
  CHECK (pdf_accent_text IS NULL OR pdf_accent_text IN ('light', 'dark'));
