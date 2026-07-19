-- Per-entry discount (%): set at entry logging time (or any edit until the
-- entry is billed), folded into the line `amount` at issue time, and
-- snapshotted onto the line so the document can itemize it per row.
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS discount_percent real;
ALTER TABLE time_entries DROP CONSTRAINT IF EXISTS time_entries_discount_percent_check;
ALTER TABLE time_entries ADD CONSTRAINT time_entries_discount_percent_check
  CHECK (discount_percent IS NULL OR (discount_percent >= 0 AND discount_percent <= 100));

ALTER TABLE charge_document_lines ADD COLUMN IF NOT EXISTS discount_percent real;
ALTER TABLE charge_document_lines DROP CONSTRAINT IF EXISTS charge_document_lines_discount_percent_check;
ALTER TABLE charge_document_lines ADD CONSTRAINT charge_document_lines_discount_percent_check
  CHECK (discount_percent IS NULL OR (discount_percent >= 0 AND discount_percent <= 100));

ALTER TABLE work_templates ADD COLUMN IF NOT EXISTS discount_percent real;
ALTER TABLE work_templates DROP CONSTRAINT IF EXISTS work_templates_discount_percent_check;
ALTER TABLE work_templates ADD CONSTRAINT work_templates_discount_percent_check
  CHECK (discount_percent IS NULL OR (discount_percent >= 0 AND discount_percent <= 100));
