-- 0013_charge_documents.sql
-- Internal settlement / charge documents. Apply via psql + DATABASE_URL_ADMIN
-- (db:migrate is broken — drizzle meta drift). Depends on 0009_item_ref.
BEGIN;

CREATE TABLE IF NOT EXISTS charge_documents (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id text NOT NULL,
  client_id text NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  doc_number integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  currency text NOT NULL DEFAULT 'ILS',
  total real,
  notes text,
  pdf_template text,
  issued_at timestamp,
  paid_at timestamp,
  canceled_at timestamp,
  created_at timestamp DEFAULT NOW(),
  updated_at timestamp DEFAULT NOW(),
  CONSTRAINT charge_documents_status_check CHECK (status IN ('pending','paid','canceled')),
  CONSTRAINT charge_documents_user_doc_number_unique UNIQUE (user_id, doc_number)
);
CREATE INDEX IF NOT EXISTS idx_charge_documents_user_id           ON charge_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_charge_documents_user_id_client_id ON charge_documents(user_id, client_id);
CREATE INDEX IF NOT EXISTS idx_charge_documents_user_id_status    ON charge_documents(user_id, status);

CREATE TABLE IF NOT EXISTS charge_document_lines (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id text NOT NULL,
  document_id text NOT NULL REFERENCES charge_documents(id) ON DELETE CASCADE,
  source_type text NOT NULL,
  time_entry_id text REFERENCES time_entries(id) ON DELETE SET NULL,
  period_month text,
  label text NOT NULL,
  description text,
  notes text,
  item_ref integer,
  billing_kind text,
  quantity real,
  rate real,
  amount real,
  created_at timestamp DEFAULT NOW(),
  updated_at timestamp DEFAULT NOW(),
  CONSTRAINT charge_document_lines_source_type_check
    CHECK (source_type IN ('time_entry','fixed_monthly','retainer')),
  CONSTRAINT charge_document_lines_period_month_check
    CHECK (period_month IS NULL OR period_month ~ '^\d{4}-\d{2}$')
);
CREATE INDEX IF NOT EXISTS idx_charge_document_lines_document_id   ON charge_document_lines(document_id);
CREATE INDEX IF NOT EXISTS idx_charge_document_lines_user_id       ON charge_document_lines(user_id);
CREATE INDEX IF NOT EXISTS idx_charge_document_lines_time_entry_id ON charge_document_lines(time_entry_id);

ALTER TABLE time_entries
  ADD COLUMN IF NOT EXISTS charge_document_id text
    REFERENCES charge_documents(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_time_entries_charge_document_id ON time_entries(charge_document_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_user_unbilled
  ON time_entries (user_id, project_id)
  WHERE charge_document_id IS NULL AND is_billable = TRUE;

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS next_charge_doc_number integer NOT NULL DEFAULT 1;

COMMIT;
