-- One-time maintenance: re-sync UN-BILLED time entries' snapshot price to the
-- client's CURRENT rate (client_rates).
--
-- Why: time entries snapshot their rate at creation (time_entries.rate), so a
-- later edit of client_rates does NOT touch existing entries — by design. This
-- script opts a subset back in: only entries not yet settled into a charge
-- document (charge_document_id IS NULL). Issued charge documents stay frozen.
--
-- It matches each entry to the current rate by (client, rate_label, kind), so it
-- covers תכנות, מכתבים (letter items) and anything else whose label still maps to
-- a defined rate. Entries whose label no longer matches a rate are left untouched.
--
-- Run scoped to one user (the app login email — likely NOT the system email):
--   psql "$DATABASE_URL_ADMIN" -v email="benatia.asaf@gmail.com" -f scripts/resync-unbilled-rates.sql
--
-- ALWAYS review the PREVIEW output before answering the \prompt to apply.
-- This is a privileged-role (DATABASE_URL_ADMIN) script. PROD run pending.

\set ON_ERROR_STOP on

\echo '--- PREVIEW: un-billed entries whose snapshot != current rate ---'
SELECT c.name AS client, te.rate_label, COALESCE(te.billing_kind, 'hourly') AS kind,
       te.rate AS old_rate, cr.rate AS new_rate, COUNT(*) AS rows
  FROM time_entries te
  JOIN projects p     ON p.id = te.project_id
  JOIN clients  c     ON c.id = p.client_id
  JOIN client_rates cr ON cr.client_id = p.client_id
       AND cr.name = te.rate_label
       AND cr.kind = COALESCE(te.billing_kind, 'hourly')
 WHERE te.user_id = (SELECT id FROM "user" WHERE email = :'email')
   AND te.charge_document_id IS NULL
   AND te.rate IS DISTINCT FROM cr.rate
 GROUP BY c.name, te.rate_label, COALESCE(te.billing_kind, 'hourly'), te.rate, cr.rate
 ORDER BY c.name, te.rate_label;

\prompt 'Type APPLY to update the rows above, anything else to abort: ' confirm

\if :{?confirm}
\endif
SELECT CASE WHEN :'confirm' = 'APPLY' THEN 'applying…' ELSE 'aborted — no changes' END AS status;

\set apply false
SELECT (:'confirm' = 'APPLY') AS "apply" \gset

\if :apply
  BEGIN;
  UPDATE time_entries te
     SET rate = cr.rate, updated_at = NOW()
    FROM projects p, clients c, client_rates cr
   WHERE te.project_id = p.id
     AND p.client_id = c.id
     AND cr.client_id = p.client_id
     AND cr.name = te.rate_label
     AND cr.kind = COALESCE(te.billing_kind, 'hourly')
     AND te.user_id = (SELECT id FROM "user" WHERE email = :'email')
     AND te.charge_document_id IS NULL
     AND te.rate IS DISTINCT FROM cr.rate;
  COMMIT;
  \echo 'Done — un-billed entries re-synced to current prices.'
\endif
