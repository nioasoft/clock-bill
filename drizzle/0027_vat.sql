-- VAT (מע״מ) support + optional document summary.
-- Apply via:  psql "$DATABASE_URL_ADMIN" -f drizzle/0027_vat.sql   (dev, then prod)
-- No backfill: existing profiles default to not-registered; existing clients
-- inherit; existing charge documents keep NULL vat_rate_snapshot (= no VAT).

-- ─── Global business VAT status (user_profiles) ──────────────────────
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS vat_registered boolean DEFAULT false;
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS vat_rate real;
ALTER TABLE user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_vat_rate_check;
ALTER TABLE user_profiles
  ADD CONSTRAINT user_profiles_vat_rate_check
  CHECK (vat_rate IS NULL OR (vat_rate >= 0 AND vat_rate <= 100));

-- ─── Per-client VAT override (clients) ───────────────────────────────
-- NULL = inherit global; 'add' = always charge VAT; 'exempt' = never (foreign).
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS vat_mode text;
ALTER TABLE clients
  DROP CONSTRAINT IF EXISTS clients_vat_mode_check;
ALTER TABLE clients
  ADD CONSTRAINT clients_vat_mode_check
  CHECK (vat_mode IS NULL OR vat_mode IN ('add', 'exempt'));

-- ─── Charge-document VAT snapshot + summary mode ─────────────────────
ALTER TABLE charge_documents
  ADD COLUMN IF NOT EXISTS vat_rate_snapshot real;
ALTER TABLE charge_documents
  DROP CONSTRAINT IF EXISTS charge_documents_vat_rate_snapshot_check;
ALTER TABLE charge_documents
  ADD CONSTRAINT charge_documents_vat_rate_snapshot_check
  CHECK (vat_rate_snapshot IS NULL OR (vat_rate_snapshot >= 0 AND vat_rate_snapshot <= 100));

ALTER TABLE charge_documents
  ADD COLUMN IF NOT EXISTS summary_mode text;
ALTER TABLE charge_documents
  DROP CONSTRAINT IF EXISTS charge_documents_summary_mode_check;
ALTER TABLE charge_documents
  ADD CONSTRAINT charge_documents_summary_mode_check
  CHECK (summary_mode IS NULL OR summary_mode IN ('project', 'type'));

-- ─── Per-line project-name snapshot (for the by-project summary) ─────
ALTER TABLE charge_document_lines
  ADD COLUMN IF NOT EXISTS project_name text;
