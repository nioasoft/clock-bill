-- Phase C: payment tracking + discounts.

-- 1) Payments journal (one row per payment received).
CREATE TABLE IF NOT EXISTS charge_document_payments (
  id          text PRIMARY KEY,
  user_id     text NOT NULL,
  document_id text NOT NULL REFERENCES charge_documents(id) ON DELETE CASCADE,
  amount      real NOT NULL,
  paid_at     date NOT NULL,
  method      text,
  note        text,
  created_at  timestamp DEFAULT now(),
  updated_at  timestamp DEFAULT now(),
  CONSTRAINT charge_document_payments_amount_check CHECK (amount > 0),
  CONSTRAINT charge_document_payments_method_check CHECK (
    method IS NULL OR method IN ('bank_transfer','bit','cash','check','credit','other')
  )
);
CREATE INDEX IF NOT EXISTS idx_charge_document_payments_user_id     ON charge_document_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_charge_document_payments_document_id ON charge_document_payments(document_id);

-- 2) Document-level discount.
ALTER TABLE charge_documents ADD COLUMN IF NOT EXISTS discount_type  text;
ALTER TABLE charge_documents ADD COLUMN IF NOT EXISTS discount_value real;
ALTER TABLE charge_documents DROP CONSTRAINT IF EXISTS charge_documents_discount_type_check;
ALTER TABLE charge_documents ADD CONSTRAINT charge_documents_discount_type_check
  CHECK (discount_type IS NULL OR discount_type IN ('percent','amount'));
ALTER TABLE charge_documents DROP CONSTRAINT IF EXISTS charge_documents_discount_value_check;
ALTER TABLE charge_documents ADD CONSTRAINT charge_documents_discount_value_check
  CHECK (
    discount_value IS NULL
    OR (discount_value >= 0 AND (discount_type <> 'percent' OR discount_value <= 100))
  );

-- 3) Allow the derived 'partial' status.
ALTER TABLE charge_documents DROP CONSTRAINT IF EXISTS charge_documents_status_check;
ALTER TABLE charge_documents ADD CONSTRAINT charge_documents_status_check
  CHECK (status IN ('pending','partial','paid','canceled'));

-- 4) RLS for the new table.
ALTER TABLE charge_document_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE charge_document_payments FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON charge_document_payments;
CREATE POLICY tenant_isolation ON charge_document_payments FOR ALL
  USING (user_id = current_setting('app.current_user_id', true))
  WITH CHECK (user_id = current_setting('app.current_user_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON charge_document_payments TO clockbill_app;
