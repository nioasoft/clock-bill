# Per-client rate types & items ("תעריפים ופריטים") — Design

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

**Plus: fixed-price items.** Beyond hourly rates, the same per-client catalog also holds
**items** — billed per unit, NOT by time (e.g. "כתיבת מכתב" = ₪100/unit). When billing an
item you log a **quantity** instead of a duration; amount = `quantity × unit price`. The UI
collectively calls these "תעריפים ופריטים".

## Data model

**New table `client_rates`** (holds both hourly rates AND fixed items)
- `id` text PK
- `user_id` text NOT NULL (RLS tenant key)
- `client_id` text NOT NULL → `clients.id` ON DELETE CASCADE
- `kind` text NOT NULL DEFAULT 'hourly' — `'hourly'` (price per hour) or `'item'` (price per unit)
- `name` text NOT NULL (e.g. "תכנות" hourly, "כתיבת מכתב" item)
- `rate` real NOT NULL (the price; ₪/hour when `kind='hourly'`, ₪/unit when `kind='item'`; in the client's currency)
- `is_default` boolean NOT NULL DEFAULT false (preselected **hourly** rate for the client; items are not "default")
- `created_at`, `updated_at` timestamps
- Indexes: `(client_id)`, `(user_id)`
- **RLS**: FORCE-enabled with the standard `user_id = current_setting('app.current_user_id')`
  policies (4 ops), matching the other tenant tables. Add to `drizzle/rls-policies.sql`
  and the app role grants.

**`time_entries` — new nullable columns (snapshot)**
- `rate` real NULL — the unit price applied to this line at the moment it was logged
  (₪/hour for hourly, ₪/unit for item).
- `rate_label` text NULL — the rate/item name at that moment (for report breakdown).
- `billing_kind` text NULL — `'hourly'` or `'item'`; how to compute the amount. NULL ⇒ legacy
  hourly (treated as `'hourly'`).
- `quantity` real NULL — the number of units for an **item** line (e.g. 3 letters). Ignored for
  hourly lines (which use `duration`).
- Snapshot rationale: immune to later edits/deletes of `client_rates`; keeps historical
  billing correct.
- An **item line** has `billing_kind='item'`, a `quantity`, no timer (`start_time`/`end_time`
  NULL, `duration` 0); it is a manual billable line with a `date`.

**`clients.default_rate`** — retained, used as the fallback when `time_entries.rate IS NULL`.

## Managing rates (client form / `app/clients/page.tsx`)

In the form's "חיוב" section, the single "תעריף שעתי" field becomes a small **rates &
items editor**: a list of rows `{ kind, name, rate }` where `kind` is "שעתי" or "פריט",
plus a "default" radio/star on exactly one **hourly** row. Add row / remove row; a per-row
toggle picks hourly vs item. The label/placeholder adapts ("₪ לשעה" vs "₪ ליחידה"). The
currency stays the client-level `currency`.

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
  timers are **hourly only** (you can only time work). After a project is selected, show a
  "תעריף" dropdown of that client's **hourly** rates (default preselected). On start,
  `POST /api/timer/start` receives the chosen `rate` + `rate_label` (`billing_kind='hourly'`),
  snapshotted onto the new `time_entries` row.
- **Manual entry form + entry edit (`app/entries/page.tsx`)**: a "סוג" toggle — **שעות**
  (duration + an hourly-rate dropdown) or **פריט** (an item dropdown + a `quantity` field).
  Both dropdowns are driven by the entry's client (resolved via the selected project →
  `projects.client_id`, since `time_entries` has no `client_id`). An item line stores
  `billing_kind='item'`, `rate`, `rate_label`, `quantity`, `duration=0`.
- **Zero-friction fallback**: a client with exactly one hourly rate → auto-selected; a
  client with no rates → hourly falls back to `default_rate` (current behavior).

## Reports (`app/api/reports/route.ts`, `app/api/reports/excel/route.ts`, PDF templates)

- Per-line amount:
  - hourly (`billing_kind='hourly'` or NULL): `hours × COALESCE(time_entries.rate, clients.default_rate)`.
    Old entries (`rate IS NULL`) bill exactly as today.
  - item (`billing_kind='item'`): `quantity × time_entries.rate`.
- Add a **breakdown by `rate_label`** to the report output (PDF + Excel), grouped and showing
  the unit: hourly as "תכנות — 3.0ש׳ — ₪900", items as "כתיבת מכתב — 3 יח׳ — ₪300".
  Entries with no label fall under a default group ("תכנות" after migration; "—" otherwise).
  The grand total sums hourly + item amounts (and existing fixed-monthly charges).

## Migration (`drizzle/00NN_per_client_rate_types.sql`, applied via psql/admin)

Everything that exists today is **programming work ("תכנות")**:
1. `CREATE TABLE client_rates ...` (incl. `kind` default `'hourly'`) + indexes + RLS policies + grants to `clockbill_app`.
2. `ALTER TABLE time_entries ADD COLUMN rate real, ADD COLUMN rate_label text, ADD COLUMN billing_kind text, ADD COLUMN quantity real;`
3. Seed one default **hourly** rate per existing client:
   `INSERT INTO client_rates (id, user_id, client_id, kind, name, rate, is_default, ...)`
   `SELECT gen_random_uuid()::text, user_id, id, 'hourly', 'תכנות', COALESCE(default_rate, 0), true, ...`
   `FROM clients;`
4. Backfill existing entries as hourly תכנות at their client's current rate (historical snapshot).
   NOTE: `time_entries` has no `client_id` — the client is reached via `project_id → projects.client_id`:
   `UPDATE time_entries te SET rate_label = 'תכנות', billing_kind = 'hourly', rate = c.default_rate`
   `FROM projects p JOIN clients c ON c.id = p.client_id`
   `WHERE te.project_id = p.id AND te.rate IS NULL;`
   (Entries whose client has a NULL `default_rate` keep `rate = NULL`, label 'תכנות',
   `billing_kind='hourly'` → still fall back to the client default.)

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
