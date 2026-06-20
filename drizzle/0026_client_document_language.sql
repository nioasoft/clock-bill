-- Per-client document language ("שפת המסמך המופק").
-- NULL = Auto (resolved from currency at render time). No backfill.
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS document_language text;
ALTER TABLE clients
  ADD CONSTRAINT clients_document_language_check
  CHECK (document_language IS NULL OR document_language IN ('he', 'en'));

-- Snapshot of the language a charge document was issued in. NULL on legacy /
-- pre-feature docs (resolved live from the client at print time).
ALTER TABLE charge_documents
  ADD COLUMN IF NOT EXISTS document_language text;
ALTER TABLE charge_documents
  ADD CONSTRAINT charge_documents_document_language_check
  CHECK (document_language IS NULL OR document_language IN ('he', 'en'));
