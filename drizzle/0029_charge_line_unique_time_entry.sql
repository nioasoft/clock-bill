-- 0029: One active charge line per time entry (DB backstop against double-billing).
-- The app already claims entries atomically via `WHERE charge_document_id IS NULL`,
-- but two concurrent issues could each INSERT a line for the same entry before the
-- claim. This unique partial index makes that impossible at the DB level.
--
-- Canceled documents keep their lines as history; the cancel route (and this
-- backfill) NULL their time_entry_id so a freed entry can be re-billed without
-- colliding with the index.
--
-- Apply with the privileged admin role:
--   psql "$DATABASE_URL_ADMIN" -f drizzle/0029_charge_line_unique_time_entry.sql

-- Backfill: release entry links on canceled-document lines.
UPDATE charge_document_lines l
SET time_entry_id = NULL
FROM charge_documents d
WHERE l.document_id = d.id
  AND d.status = 'canceled'
  AND l.time_entry_id IS NOT NULL;

-- Replace the plain lookup index with a unique partial index (also serves lookups).
DROP INDEX IF EXISTS idx_charge_document_lines_time_entry_id;
CREATE UNIQUE INDEX IF NOT EXISTS uq_charge_document_lines_time_entry_id
  ON charge_document_lines (time_entry_id)
  WHERE time_entry_id IS NOT NULL;
