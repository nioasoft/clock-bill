-- 0028: Non-negativity CHECK constraints on monetary/quantity columns.
-- Defense-in-depth (Iron Law 5): the DB is the last boundary, so a future route
-- or migration that bypasses Zod can't write a negative rate and poison billing.
-- Idempotent (safe to re-run / apply to dev then prod). Mirrors the existing
-- VAT-rate CHECK pattern already in the schema.
--
-- Apply with the privileged admin role:
--   psql "$DATABASE_URL_ADMIN" -f drizzle/0028_monetary_check_constraints.sql

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_default_rate_check') THEN
    ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_default_rate_check CHECK (default_rate IS NULL OR default_rate >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clients_default_rate_check') THEN
    ALTER TABLE clients ADD CONSTRAINT clients_default_rate_check CHECK (default_rate IS NULL OR default_rate >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clients_retainer_monthly_fee_check') THEN
    ALTER TABLE clients ADD CONSTRAINT clients_retainer_monthly_fee_check CHECK (retainer_monthly_fee IS NULL OR retainer_monthly_fee >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clients_overage_rate_check') THEN
    ALTER TABLE clients ADD CONSTRAINT clients_overage_rate_check CHECK (overage_rate IS NULL OR overage_rate >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_rates_rate_check') THEN
    ALTER TABLE client_rates ADD CONSTRAINT client_rates_rate_check CHECK (rate >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'projects_fixed_monthly_fee_check') THEN
    ALTER TABLE projects ADD CONSTRAINT projects_fixed_monthly_fee_check CHECK (fixed_monthly_fee IS NULL OR fixed_monthly_fee >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_rate_check') THEN
    ALTER TABLE tasks ADD CONSTRAINT tasks_rate_check CHECK (rate IS NULL OR rate >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'time_entries_rate_check') THEN
    ALTER TABLE time_entries ADD CONSTRAINT time_entries_rate_check CHECK (rate IS NULL OR rate >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'time_entries_duration_check') THEN
    ALTER TABLE time_entries ADD CONSTRAINT time_entries_duration_check CHECK (duration >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'charge_documents_total_check') THEN
    ALTER TABLE charge_documents ADD CONSTRAINT charge_documents_total_check CHECK (total IS NULL OR total >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'charge_document_lines_amount_check') THEN
    ALTER TABLE charge_document_lines ADD CONSTRAINT charge_document_lines_amount_check CHECK (amount IS NULL OR amount >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'charge_document_lines_rate_check') THEN
    ALTER TABLE charge_document_lines ADD CONSTRAINT charge_document_lines_rate_check CHECK (rate IS NULL OR rate >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'charge_document_lines_quantity_check') THEN
    ALTER TABLE charge_document_lines ADD CONSTRAINT charge_document_lines_quantity_check CHECK (quantity IS NULL OR quantity >= 0);
  END IF;
END $$;
