/**
 * Single source of truth for shaping a `time_entries` row (joined with its
 * project, client and optional task) into the API response object.
 *
 * Before this module the snake_case→camelCase mapping and the SELECT column
 * list were hand-copied into four places (list/create in `entries/route.ts`
 * and get/update in `entries/[id]/route.ts`). The copies had drifted: the
 * single-entry endpoints silently omitted `currency`, `pausedAt` and
 * `totalPausedTime`, so fetching one entry returned a narrower object than the
 * list. Keeping the columns and the mapper here keeps every endpoint identical.
 */

/**
 * The column list every entry query must select, aliased to the time_entries
 * table alias used by that query (`te` for plain selects, `ins`/`upd` for the
 * insert/update CTEs). The joined `projects p`, `clients c` and `tasks tk`
 * aliases are fixed.
 */
export function entrySelectColumns(te: string): string {
  return `${te}.id,
    ${te}.project_id,
    ${te}.description,
    ${te}.start_time,
    ${te}.end_time,
    ${te}.duration,
    ${te}.date,
    ${te}.tags,
    ${te}.notes,
    ${te}.is_billable,
    ${te}.created_at,
    ${te}.paused_at,
    ${te}.total_paused_time,
    ${te}.task_id,
    ${te}.billing_kind,
    ${te}.rate,
    ${te}.rate_label,
    ${te}.quantity,
    ${te}.item_ref,
    ${te}.unit,
    p.name as project_name,
    c.name as client_name,
    c.id as client_id,
    c.currency as currency,
    tk.title as task_name`;
}

/**
 * Snake_case row shape returned by `entrySelectColumns(...)`.
 * A `type` alias (not `interface`) so it satisfies the `Record<string, unknown>`
 * constraint on `query<T>()` / `client.query<T>()`.
 */
export type EntryRow = {
  id: string;
  project_id: string;
  description: string;
  start_time: string | null;
  end_time: string | null;
  duration: number;
  date: string;
  tags: unknown;
  notes: string | null;
  is_billable: boolean;
  created_at: string;
  paused_at: string | null;
  total_paused_time: number | null;
  task_id: string | null;
  billing_kind: string | null;
  rate: number | null;
  rate_label: string | null;
  quantity: number | null;
  item_ref: number | null;
  unit: string | null;
  project_name: string;
  client_name: string;
  client_id: string;
  currency: string | null;
  task_name: string | null;
};

/** CamelCase entry object returned by the API. */
export interface EntryResponse {
  id: string;
  projectId: string;
  projectName: string;
  clientId: string;
  clientName: string;
  currency: string;
  description: string;
  startTime: string | null;
  endTime: string | null;
  duration: number;
  date: string;
  tags: unknown;
  notes: string | null;
  isBillable: boolean;
  createdAt: string;
  pausedAt: string | null;
  totalPausedTime: number | null;
  taskId: string | null;
  taskName: string | null;
  billingKind: string;
  rate: number | null;
  rateLabel: string | null;
  quantity: number | null;
  itemRef: number | null;
  unit: string | null;
}

/** Map a joined `time_entries` row to the canonical API entry object. */
export function mapEntryRow(row: EntryRow): EntryResponse {
  return {
    id: row.id,
    projectId: row.project_id,
    projectName: row.project_name,
    clientId: row.client_id,
    clientName: row.client_name,
    currency: row.currency || "ILS",
    description: row.description,
    startTime: row.start_time,
    endTime: row.end_time,
    duration: row.duration,
    date: row.date,
    tags: row.tags || [],
    notes: row.notes,
    isBillable: row.is_billable,
    createdAt: row.created_at,
    pausedAt: row.paused_at,
    totalPausedTime: row.total_paused_time,
    taskId: row.task_id,
    taskName: row.task_name,
    billingKind: row.billing_kind ?? "hourly",
    rate: row.rate,
    rateLabel: row.rate_label,
    quantity: row.quantity,
    itemRef: row.item_ref,
    unit: row.unit,
  };
}
