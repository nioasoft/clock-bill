-- Project-scoped rates/items: a client_rates row may optionally apply to a
-- single project instead of all the client's projects.
--   project_id IS NULL  => rate applies to every project of the client (legacy behavior)
--   project_id = <id>   => rate is offered only when logging time/items on that project
-- ON DELETE CASCADE: a rate scoped to a deleted project disappears with it
-- (time_entries keep their own rate/label snapshot, so history is unaffected).
--
-- Apply via psql with DATABASE_URL_ADMIN (drizzle meta is out of sync — do NOT db:migrate).

ALTER TABLE client_rates
  ADD COLUMN IF NOT EXISTS project_id text REFERENCES projects(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_client_rates_project_id ON client_rates(project_id);
