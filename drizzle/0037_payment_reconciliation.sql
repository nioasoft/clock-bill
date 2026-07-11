-- Idempotency key for payments recorded through the reconciliation workflow.
-- Manual payments remain NULL and keep their existing behavior.
ALTER TABLE charge_document_payments
  ADD COLUMN IF NOT EXISTS reconciliation_key text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_charge_document_payments_reconciliation_key
  ON charge_document_payments(user_id, reconciliation_key)
  WHERE reconciliation_key IS NOT NULL;

ALTER TABLE charge_document_payments
  ADD CONSTRAINT charge_document_payments_reconciliation_key_check
  CHECK (reconciliation_key IS NULL OR length(reconciliation_key) BETWEEN 8 AND 200);

