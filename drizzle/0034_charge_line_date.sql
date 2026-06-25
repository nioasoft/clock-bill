-- Charge-document lines did not snapshot the source entry's date, so the issued
-- PDF/HTML could not show a per-item date. Add a nullable date column and
-- backfill existing documents from their (locked, still-present) source entries.
-- Fixed-monthly/retainer lines have no time_entry_id and stay NULL (they render
-- their period_month instead).
ALTER TABLE charge_document_lines ADD COLUMN IF NOT EXISTS date date;

UPDATE charge_document_lines l
   SET date = te.date
  FROM time_entries te
 WHERE l.time_entry_id = te.id
   AND l.date IS NULL;

-- Per-document toggle: show the items' date range in the document header.
-- Default ON; existing documents keep showing it.
ALTER TABLE charge_documents ADD COLUMN IF NOT EXISTS show_date_range boolean NOT NULL DEFAULT true;
