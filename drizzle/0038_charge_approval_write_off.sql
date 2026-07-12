-- Charge-document approval: an orthogonal locked state ("client approved —
-- awaiting payment") that must not live in `status`, because status is
-- recomputed from the payment journal (recomputeChargeStatus) and a new enum
-- value would be overwritten on the next payment mutation.
ALTER TABLE charge_documents ADD COLUMN IF NOT EXISTS approved_at timestamp;
ALTER TABLE charge_documents ADD COLUMN IF NOT EXISTS approved_by text;

ALTER TABLE charge_documents DROP CONSTRAINT IF EXISTS charge_documents_approved_by_check;
ALTER TABLE charge_documents ADD CONSTRAINT charge_documents_approved_by_check
  CHECK (approved_by IS NULL OR approved_by IN ('owner', 'client'));

ALTER TABLE charge_documents DROP CONSTRAINT IF EXISTS charge_documents_approval_pair_check;
ALTER TABLE charge_documents ADD CONSTRAINT charge_documents_approval_pair_check
  CHECK ((approved_at IS NULL) = (approved_by IS NULL));

-- Write-off: a time entry removed from a charge document with "agreed not to
-- bill". Distinct from is_billable=false (work logged as non-billable from the
-- start) so written-off entries stay filterable/auditable. A written-off entry
-- can never be attached to a document.
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS written_off_at timestamp;

ALTER TABLE time_entries DROP CONSTRAINT IF EXISTS time_entries_write_off_unbilled_check;
ALTER TABLE time_entries ADD CONSTRAINT time_entries_write_off_unbilled_check
  CHECK (written_off_at IS NULL OR charge_document_id IS NULL);

-- The unbilled-pool partial index must match the new pool predicate
-- (billable, unclaimed, not written off).
DROP INDEX IF EXISTS idx_time_entries_user_unbilled;
CREATE INDEX idx_time_entries_user_unbilled ON time_entries (user_id, project_id)
  WHERE charge_document_id IS NULL AND is_billable = TRUE AND written_off_at IS NULL;
