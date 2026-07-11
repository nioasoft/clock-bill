-- Reusable work templates. Templates only prefill a reviewed entry form; they
-- never create billable records automatically.
CREATE TABLE IF NOT EXISTS work_templates (
  id            text PRIMARY KEY,
  user_id       text NOT NULL,
  client_id     text NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  project_id    text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  rate_id       text REFERENCES client_rates(id) ON DELETE SET NULL,
  title         text NOT NULL,
  description   text NOT NULL,
  notes         text,
  billing_kind  text NOT NULL DEFAULT 'hourly',
  duration      integer,
  quantity      real,
  rate          real,
  rate_label    text,
  unit          text,
  is_billable   boolean NOT NULL DEFAULT true,
  created_at    timestamp DEFAULT now(),
  updated_at    timestamp DEFAULT now(),
  CONSTRAINT work_templates_kind_check CHECK (billing_kind IN ('hourly', 'item')),
  CONSTRAINT work_templates_duration_check CHECK (duration IS NULL OR duration >= 0),
  CONSTRAINT work_templates_quantity_check CHECK (quantity IS NULL OR quantity >= 0),
  CONSTRAINT work_templates_rate_check CHECK (rate IS NULL OR rate >= 0)
);

CREATE INDEX IF NOT EXISTS idx_work_templates_user_id ON work_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_work_templates_user_project ON work_templates(user_id, project_id);

ALTER TABLE work_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_templates FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON work_templates;
CREATE POLICY tenant_isolation ON work_templates FOR ALL
  USING (user_id = current_setting('app.current_user_id', true))
  WITH CHECK (user_id = current_setting('app.current_user_id', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON work_templates TO clockbill_app;
