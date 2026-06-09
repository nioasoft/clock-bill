-- 0020: per-session unit labels (nullable -> fully backward-compatible).
-- unit = the per-unit noun for an item rate ("פגישה"/"מילה"/"יום").
-- Snapshots: client_rates (source) -> time_entries (at log time) -> charge_document_lines (at issue time).
ALTER TABLE client_rates ADD COLUMN IF NOT EXISTS unit text;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS unit text;
ALTER TABLE charge_document_lines ADD COLUMN IF NOT EXISTS unit text;
