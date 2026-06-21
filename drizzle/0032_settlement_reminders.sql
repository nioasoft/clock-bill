-- Phase B: settlement-date reminders.
ALTER TABLE clients ADD COLUMN IF NOT EXISTS settlement_billing_day integer;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS settlement_reminded_at date;

ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_settlement_billing_day_check;
ALTER TABLE clients ADD CONSTRAINT clients_settlement_billing_day_check
  CHECK (settlement_billing_day IS NULL OR (settlement_billing_day >= 1 AND settlement_billing_day <= 31));
