-- Tasks Kanban: extend the per-project tasks table into a standalone, client/
-- project/rate-aware board model. ALTER + backfill in place (preserves
-- time_entries.task_id links).
--
-- Apply with the privileged role (DATABASE_URL_ADMIN), not db:migrate — see
-- memory drizzle-meta-drift. DEV first; PROD pending (separate reviewed step).

-- 1. New columns (nullable first so backfill can populate them).
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS client_id  text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS rate_id    text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS rate       real;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS rate_label text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS title      text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority   text NOT NULL DEFAULT 'normal';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_date   date;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS position   real NOT NULL DEFAULT 1000;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS tags       jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 2. Backfill title/notes from the old name/description columns.
UPDATE tasks SET title = name WHERE title IS NULL;

-- 3. Backfill client_id from the task's project.
UPDATE tasks t
SET client_id = p.client_id
FROM projects p
WHERE t.project_id = p.id AND t.client_id IS NULL;

-- 4. Backfill rate from the client's default hourly rate (default flag first,
--    else the first hourly rate). Leaves rate_id NULL if the client has none.
UPDATE tasks t
SET rate_id = cr.id, rate = cr.rate, rate_label = cr.name
FROM (
  SELECT DISTINCT ON (client_id) id, client_id, rate, name
  FROM client_rates
  WHERE kind = 'hourly'
  ORDER BY client_id, is_default DESC, created_at ASC
) cr
WHERE t.client_id = cr.client_id AND t.rate_id IS NULL;

-- 5. Sequential positions within each (user_id, status) bucket by created_at.
UPDATE tasks t
SET position = ord.rn * 1000
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id, status ORDER BY created_at) AS rn
  FROM tasks
) ord
WHERE t.id = ord.id;

-- 6. Enforce NOT NULL + FKs now that data is populated.
ALTER TABLE tasks ALTER COLUMN client_id SET NOT NULL;
ALTER TABLE tasks ALTER COLUMN title     SET NOT NULL;

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_client_id_fkey;
ALTER TABLE tasks ADD CONSTRAINT tasks_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_rate_id_fkey;
ALTER TABLE tasks ADD CONSTRAINT tasks_rate_id_fkey
  FOREIGN KEY (rate_id) REFERENCES client_rates(id) ON DELETE SET NULL;

-- 7. Priority guard + board index.
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_priority_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_priority_check
  CHECK (priority IN ('normal', 'high', 'urgent'));

CREATE INDEX IF NOT EXISTS idx_tasks_user_status_position
  ON tasks (user_id, status, position);

-- 8. Rename description -> notes and drop the superseded name column (re-runnable).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'tasks' AND column_name = 'description') THEN
    ALTER TABLE tasks RENAME COLUMN description TO notes;
  END IF;
END $$;
ALTER TABLE tasks DROP COLUMN IF EXISTS name;
