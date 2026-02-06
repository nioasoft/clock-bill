-- Add address column to clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS address text;
