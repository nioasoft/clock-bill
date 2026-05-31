# Per-client rate types ("תעריפים") — Design

**Date:** 2026-05-31
**Status:** Approved (design); pending implementation plan.

## Context

Today a time entry has **no rate of its own**. The billed amount is computed at
report time as `hours × clients.default_rate` (joined in `app/api/reports/route.ts`,
`app/api/reports/excel/route.ts` via `c.default_rate as hourly_rate`, using
`calcHourlyAmount` in `lib/money.ts`). So every billable hour for a client uses that
client's single rate.

The user (an Israeli freelancer) bills **different work-types at different prices**
(e.g. תכנות vs הדרכה), and the prices **vary per client**. They need to pick the
work-type/rate when tracking time, and have reports bill and break down accordingly.

Decision (from brainstorming): **Approach A — a per-client list of named rates.** Each
client owns its own rate list; the rate is chosen per entry and snapshotted onto the
entry. The existing `default_rate` remains a fallback. No global shared names, no
per-rate currency, no per-project rates (YAGNI).

## Data model

**New table `client_rates`**
- `id` text PK
- `user_id` text NOT NULL (RLS tenant key)
- `client_id` text NOT NULL → `clients.id` ON DELETE CASCADE
- `name` text NOT NULL (e.g. "תכנות", "הדרכה")
- `rate` real NOT NULL (hourly price, in the client's currency)
- `is_default` boolean NOT NULL DEFAULT false (preselected rate for the client)
- `created_at`, `updated_at` timestamps
- Indexes: `(client_id)`, `(user_id)`
- **RLS**: FORCE-enabled with the standard `user_id = current_setting('app.current_user_id')`
  policies (4 ops), matching the other tenant tables. Add to `drizzle/rls-policies.sql`
  and the app role grants.

**`time_entries` — two new nullable columns (snapshot)**
- `rate` real NULL — the hourly rate applied to this entry at the moment it was logged.
- `rate_label` text NULL — the rate's name at that moment (for report breakdown).
- Snapshot rationale: immune to later edits/deletes of `client_rates`; keeps historical
  billing correct.

**`clients.default_rate`** — retained, used as the fallback when `time_entries.rate IS NULL`.

## Managing rates (client form / `app/clients/page.tsx`)

In the form's "חיוב" section, the single "תעריף שעתי" field becomes a small **rates
editor**: a list of rows `{ name, rate }` with a "default" radio/star (exactly one
default). Add row / remove row. The currency stays the client-level `currency`.

- Non-retainer clients: the rates list is the primary billing input.
- Retainer clients: retainer fields unchanged; the rates list still applies to
  hourly/overage work.
- On save, the client's `default_rate` is kept in sync with the default rate's value
  (so any legacy fallback path still reflects the right number).

New API surface (under the existing clients routes, scoped by `user_id`, Zod-validated):
- Read: client rates returned with the client (extend `GET /api/clients/[id]`), or a
  dedicated `GET /api/clients/[id]/rates`.
- Write: create/update/delete rates as part of the client save, or `/api/clients/[id]/rates`.
  (Plan decides; prefer folding into the client save to keep one transaction.)

## Choosing a rate while tracking

- **Timer start modal (`components/timer-start-modal.tsx` + `contexts/timer-context.tsx`)**:
  after a project is selected, load that project's client's rates and show a "תעריף"
  dropdown (default preselected). On start, `POST /api/timer/start` receives the chosen
  `rate` + `rate_label`, snapshotted onto the new `time_entries` row.
- **Manual entry form + entry edit (`app/entries/page.tsx`)**: same "תעריף" dropdown,
  driven by the entry's client (resolved via the selected project → `projects.client_id`,
  since `time_entries` has no `client_id`).
- **Zero-friction fallback**: a client with exactly one rate → auto-selected, no prompt
  needed; a client with no rates → falls back to `default_rate` (current behavior).

## Reports (`app/api/reports/route.ts`, `app/api/reports/excel/route.ts`, PDF templates)

- Per-entry amount = `hours × COALESCE(time_entries.rate, clients.default_rate)`.
  Old entries (`rate IS NULL`) bill exactly as today.
- Add a **breakdown by `rate_label`** to the report output (PDF + Excel): group billable
  hours and amounts per label, e.g. "תכנות — 3.0ש׳ — ₪900 / הדרכה — 2.0ש׳ — ₪400".
  Entries with no label fall under a default group ("תכנות" after migration; "—" otherwise).

## Migration (`drizzle/00NN_per_client_rate_types.sql`, applied via psql/admin)

Everything that exists today is **programming work ("תכנות")**:
1. `CREATE TABLE client_rates ...` + indexes + RLS policies + grants to `clockbill_app`.
2. `ALTER TABLE time_entries ADD COLUMN rate real, ADD COLUMN rate_label text;`
3. Seed one default rate per existing client:
   `INSERT INTO client_rates (id, user_id, client_id, name, rate, is_default, ...)`
   `SELECT gen_random_uuid()::text, user_id, id, 'תכנות', COALESCE(default_rate, 0), true, ...`
   `FROM clients;`
4. Backfill existing entries as תכנות at their client's current rate (historical snapshot).
   NOTE: `time_entries` has no `client_id` — the client is reached via `project_id → projects.client_id`:
   `UPDATE time_entries te SET rate_label = 'תכנות', rate = c.default_rate`
   `FROM projects p JOIN clients c ON c.id = p.client_id`
   `WHERE te.project_id = p.id AND te.rate IS NULL;`
   (Entries whose client has a NULL `default_rate` keep `rate = NULL`, label 'תכנות' →
   still fall back to the client default.)

Schema source of truth is `src/db/schema.ts` (edit it too); the migration is applied
directly via `DATABASE_URL_ADMIN` because the drizzle migration meta is drifted from prod.
Take a Neon snapshot/branch first.

## Backward compatibility

- Reports `COALESCE` keeps every existing entry billing identically.
- Clients keep working with a single rate (just now named "תכנות").
- Timer/entry flows degrade gracefully when a client has 0–1 rates.

## Out of scope (YAGNI)

- Global/shared rate-type names across clients.
- Per-rate currency (rates use the client currency).
- Per-project rate lists.
- Changing a rate retroactively across many entries (each entry keeps its snapshot).

## Affected files (for the plan)

- `src/db/schema.ts` (new table + 2 columns), `drizzle/00NN_*.sql`, `drizzle/rls-policies.sql`
- `app/api/clients/route.ts`, `app/api/clients/[id]/route.ts` (+ rates read/write)
- `app/clients/page.tsx` (rates editor)
- `app/api/timer/start/route.ts`, `contexts/timer-context.tsx`, `components/timer-start-modal.tsx`
- `app/entries/page.tsx` (manual entry + edit rate selector), relevant entries API
- `app/api/reports/route.ts`, `app/api/reports/excel/route.ts`, PDF templates, `lib/money.ts` (unchanged helper, reused)
