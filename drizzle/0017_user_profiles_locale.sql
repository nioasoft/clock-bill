-- Per-user preferred UI language ('he' | 'en'). Locks the user's language
-- choice server-side (e.g. for transactional emails) beyond the NEXT_LOCALE
-- cookie. Added for the bilingual (Hebrew/English) i18n work.
--
-- Applied manually via psql + DATABASE_URL_ADMIN on DEV and PROD (2026-06-06),
-- consistent with this project's schema workflow (apply via psql, not
-- `db:migrate`, due to drizzle migration-meta drift). Recorded here for
-- repeatability / fresh-DB setup. Additive, nullable, defaulted — safe & idempotent.

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS locale text DEFAULT 'he';
