-- Phase A: send charge documents to clients via a branded link.
ALTER TABLE charge_documents ADD COLUMN IF NOT EXISTS public_token text;
ALTER TABLE charge_documents ADD COLUMN IF NOT EXISTS last_sent_at timestamp;
ALTER TABLE charge_documents ADD COLUMN IF NOT EXISTS sent_to_email text;

-- One token per document; partial unique so existing NULLs don't collide.
CREATE UNIQUE INDEX IF NOT EXISTS uq_charge_documents_public_token
  ON charge_documents (public_token)
  WHERE public_token IS NOT NULL;
