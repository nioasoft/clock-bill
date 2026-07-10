-- Public document links are bearer capabilities. Give legacy links a bounded
-- lifetime and require every future token to have an expiry timestamp.
ALTER TABLE charge_documents
  ADD COLUMN IF NOT EXISTS public_token_expires_at timestamp;

UPDATE charge_documents
   SET public_token_expires_at = NOW() + INTERVAL '30 days'
 WHERE public_token IS NOT NULL
   AND public_token_expires_at IS NULL;

ALTER TABLE charge_documents
  DROP CONSTRAINT IF EXISTS charge_documents_public_link_pair_check;

ALTER TABLE charge_documents
  ADD CONSTRAINT charge_documents_public_link_pair_check
  CHECK ((public_token IS NULL) = (public_token_expires_at IS NULL));
