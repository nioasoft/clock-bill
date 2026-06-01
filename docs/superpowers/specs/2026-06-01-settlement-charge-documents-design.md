# Settlement / Internal Charge Documents (התחשבנות) — Design

> 2026-06-01. Adds a billing lifecycle on top of time entries: a user selects unbilled
> items for a single client, issues an **internal settlement document** (תעודת התחשבנות
> פנימית — NOT a tax invoice), tracks it through `pending → paid`, and can cancel it.
> The existing "דוחות" screen is renamed **"התחשבנות"** and becomes the home for both
> ad-hoc reports (as today) and tracked settlement documents.
>
> **Coordinates with** [`2026-06-01-ad-hoc-items-design.md`](./2026-06-01-ad-hoc-items-design.md),
> which is being implemented in parallel (item reference numbers / `item_ref`, per-line
> notes). This spec **builds on top of it** — see "Coordination" below.

## Problem

Today every report (`app/(auth)/reports/page.tsx`) is ephemeral: filter by
client/project/date → `window.print()` → PDF. Nothing records **which items were billed**,
so there is no way to:

- See "what have I not yet billed this client for?"
- Issue a document for a chosen subset of items and have those items move out of the
  "to bill" pool.
- Track whether a client has paid a given settlement.
- Re-print the exact document that was issued (today's report recomputes live and drifts
  as entries are edited).

`time_entries` has no billing-status field. `user_profiles` has `invoicePrefix` /
`nextInvoiceNumber` but they are **unused** and must NOT be repurposed as a tax-invoice
sequence — this feature is explicitly an **internal** settlement aid; the real invoice and
collection happen separately in the user's accounting software.

## Scope

**In:**
- Two new tables (`charge_documents`, `charge_document_lines`) + one nullable column on
  `time_entries` + one counter column on `user_profiles`.
- A "התחשבנות" screen with three tabs: **לחיוב** (build & issue), **תעודות** (history &
  status), **דוח חד-פעמי** (today's report, unchanged).
- Document lifecycle: `pending` (editable) → `paid` (locked); `cancel` returns items to
  unbilled; `unpay` reopens a paid document for editing.
- Fixed-monthly / retainer charges included as **snapshot lines** in a document (with a soft
  "already billed this month" warning, never a hard block).
- PDF of a saved document via the existing 6-template `window.print()` mechanism, titled
  "תעודת התחשבנות פנימית".

**Out (YAGNI):**
- Partial payments (a document is paid or not).
- Multi-client documents (always exactly one client).
- Tax-invoice numbering/format, accounting-software integration, payment collection.
- Hard enforcement against double-billing fixed/retainer (soft warning only).
- Email/share of the document (print/save-as-PDF only, as today).

## Data model

All conventions verified against `src/db/schema.ts`, `drizzle/rls-policies.sql`, `lib/db.ts`.
Money/quantity use `real` (house convention). IDs are `text` PK with `gen_random_uuid()::text`
set in DDL. `user_id` is **loose `text NOT NULL`, no FK** (matches `schema.ts:48–51`) and is
**mandatory** because the RLS policy filters on it. Index names follow `idx_<table>_<cols>`.

### New table: `charge_documents`

| Column | Type | Notes |
|---|---|---|
| `id` | text PK | `gen_random_uuid()::text` (DDL default) |
| `user_id` | text NOT NULL | loose, no FK — RLS key |
| `client_id` | text NOT NULL | FK → `clients(id)` **ON DELETE RESTRICT** (financial record; do not cascade) |
| `doc_number` | integer NOT NULL | per-user running number (see counter below) |
| `status` | text NOT NULL DEFAULT `'pending'` | CHECK IN (`'pending'`,`'paid'`,`'canceled'`) |
| `currency` | text NOT NULL DEFAULT `'ILS'` | snapshot from client |
| `total` | real | snapshot; recomputed on every edit while `pending` |
| `notes` | text | document-level note (optional) |
| `pdf_template` | text | template used at issue time |
| `issued_at` | timestamp | set at creation |
| `paid_at` | timestamp | set when marked paid (lock marker) |
| `canceled_at` | timestamp | set when canceled |
| `created_at` / `updated_at` | timestamp DEFAULT NOW() | |

Constraints: `UNIQUE(user_id, doc_number)`.
Indexes: `idx_charge_documents_user_id`, `idx_charge_documents_user_id_client_id`,
`idx_charge_documents_user_id_status`.

### New table: `charge_document_lines` (each line is an immutable-at-pay snapshot)

| Column | Type | Notes |
|---|---|---|
| `id` | text PK | |
| `user_id` | text NOT NULL | loose, no FK — RLS key (mandatory) |
| `document_id` | text NOT NULL | FK → `charge_documents(id)` **ON DELETE CASCADE** |
| `source_type` | text NOT NULL | CHECK IN (`'time_entry'`,`'fixed_monthly'`,`'retainer'`) |
| `time_entry_id` | text NULL | FK → `time_entries(id)` **ON DELETE SET NULL** (back-link) |
| `period_month` | text NULL | for fixed/retainer lines, `'YYYY-MM'`; CHECK `~ '^\d{4}-\d{2}$'` |
| `label` | text NOT NULL | snapshot of `rate_label` / "ריטיינר יוני" |
| `description` | text | snapshot of entry `description` (primary printed detail) — editable while pending |
| `note` | text | snapshot of entry `notes` (secondary detail) — editable while pending |
| `item_ref` | integer NULL | snapshot of `time_entries.item_ref` (item lines only; prints "אסמכתא N") |
| `billing_kind` | text | `'hourly'` \| `'item'` \| `'fixed'` |
| `quantity` | real | snapshot |
| `rate` | real | snapshot (₪/hour or ₪/unit) |
| `amount` | real | snapshot line total |
| `created_at` / `updated_at` | timestamp DEFAULT NOW() | `updated_at` because lines are editable while pending |

Indexes: `idx_charge_document_lines_document_id`, `idx_charge_document_lines_user_id`,
`idx_charge_document_lines_time_entry_id`.

### Change: `time_entries`

Add `charge_document_id text NULL` FK → `charge_documents(id)` **ON DELETE SET NULL**.
- `NULL` = unbilled → appears in the "לחיוב" list.
- Set = billed; whether it's "ממתין"/"שולם" is **derived** from the linked document's status.
- "Return item to unbilled" = set this back to `NULL` + delete its line.

Indexes:
- `idx_time_entries_charge_document_id` on `(charge_document_id)` — for the SET NULL sweep.
- `idx_time_entries_user_unbilled` partial on `(user_id, project_id)`
  `WHERE charge_document_id IS NULL AND is_billable = true` — makes the "to bill" set hot.

### Change: `user_profiles`

Add `next_charge_doc_number integer NOT NULL DEFAULT 1` — per-user running counter for
`doc_number`, mirroring the `next_item_ref` pattern from the ad-hoc spec. Assigned atomically
inside the create transaction: `UPDATE user_profiles SET next_charge_doc_number =
next_charge_doc_number + 1 WHERE user_id=$1 RETURNING next_charge_doc_number` (row-locked →
concurrency-safe). Fallback if no profile row: `COALESCE(MAX(doc_number),0)+1` over
`charge_documents WHERE user_id=$1` under a per-user advisory lock. Never reused (gaps on
delete are fine).

### RLS (CRITICAL — one `FOR ALL` policy per table)

Both new tables get `ENABLE` + `FORCE` ROW LEVEL SECURITY and a **single** `tenant_isolation`
policy reading the GUC — matching `drizzle/rls-policies.sql:32–39`. **Not** four policies,
**not** `auth.uid()`. Add `'charge_documents'` and `'charge_document_lines'` to the FORCE
array, plus explicit GRANTs to `clockbill_app` (mirrors the `client_rates` precedent):

```sql
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['charge_documents','charge_document_lines']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format($p$CREATE POLICY tenant_isolation ON %I FOR ALL
      USING (user_id = current_setting('app.current_user_id', true))
      WITH CHECK (user_id = current_setting('app.current_user_id', true))$p$, t);
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON charge_documents      TO clockbill_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON charge_document_lines TO clockbill_app;
```

`lib/db.ts` needs **no change** — every authed query already binds
`app.current_user_id` per transaction, covering new tables automatically.

## Coordination with the ad-hoc-items spec (parallel work)

`2026-06-01-ad-hoc-items-design.md` is being implemented concurrently. Hard dependencies and
shared files:

- **Migration numbering:** ad-hoc owns `drizzle/0009_item_ref.sql`. This feature uses
  **`drizzle/0013_charge_documents.sql`** and assumes 0009 is applied first (so `item_ref`
  exists on `time_entries` and `next_item_ref` on `user_profiles`). If 0009 is not yet
  applied, the `item_ref` snapshot column in lines is simply populated as `NULL` until it is.
- **`item_ref` snapshot:** `charge_document_lines.item_ref` is copied from
  `time_entries.item_ref` when a time-entry line is added, and the PDF prints `אסמכתא N`
  on item lines — fulfilling the ad-hoc spec's requirement #4 ("item reference number prints
  on the charge document") for **saved** documents (the ad-hoc spec covers it only on the
  live report).
- **Per-line notes:** the ad-hoc spec establishes `description` (relabeled "פירוט" in item
  mode) + `notes` as the printed per-line detail. This spec snapshots **both** into the line
  (`description`, `note`) and prints them identically.
- **Shared files:** both touch `app/api/reports/route.ts` and `app/(auth)/reports/page.tsx`.
  This spec adds tabs and a separate `app/(auth)/reports/charge-document-*` rendering path; it
  does **not** rewrite the ad-hoc changes. The "דוח חד-פעמי" tab is the existing report code
  unchanged. Merge order: land ad-hoc first, then this on top.

## API

All routes: `getUser()` → 401 if absent; **every** query filtered by `user.id` (defense in
depth over RLS); response shape `{ success: boolean, ... }`; Hebrew user-facing messages.
Validate bodies with a Zod schema in `lib/schemas/charge-documents.ts` (imported client +
server, `schema.parse()` server-side).

### Build / issue (tab א — "לחיוב")

- `GET /api/charge-documents/billable?clientId=&periodMonth=` — returns the client's unbilled
  billable entries (`charge_document_id IS NULL AND is_billable`, joined project→client),
  plus the computed fixed-monthly/retainer charge for `periodMonth` (reusing
  `lib/fixed-charges.ts`), each tagged with whether that period is already covered by an
  existing **non-canceled** document (the soft warning).
- `POST /api/charge-documents` — body: `clientId`, `pdfTemplate`, `notes?`, selected
  `timeEntryIds[]`, and selected computed lines (`{source_type, period_month, label, amount,
  ...}`). In a **`withTransaction`**:
  1. assign `doc_number` (atomic counter, above);
  2. `INSERT charge_documents` (status `pending`, `issued_at = NOW()`, `total` = sum);
  3. `INSERT charge_document_lines` — one snapshot per selected item (time entries pull
     `label/description/note/item_ref/quantity/rate/amount`; computed lines use the posted
     snapshot);
  4. `UPDATE time_entries SET charge_document_id = $doc WHERE id = ANY($ids) AND user_id = $u
     AND charge_document_id IS NULL` (the `IS NULL` guard prevents double-claim races).
  Returns the created document. **Re-validate** that every `timeEntryId` belongs to the user
  and is currently unbilled before linking (IDOR + race guard).

### History & document (tab ב — "תעודות")

- `GET /api/charge-documents?clientId=&status=` — list (user-scoped), newest first: number,
  client name, issued date, total, currency, status.
- `GET /api/charge-documents/[id]` — document + its lines (ownership re-checked).
- `PATCH /api/charge-documents/[id]` — **only when `status='pending'`** (else 409): edit
  document `notes`; edit a line's `description`/`note`; **remove a line** (delete line; if
  `source_type='time_entry'`, also `UPDATE time_entries SET charge_document_id = NULL`); **add
  a line** (insert + link the entry). Recompute `total` in the same transaction.
- `POST /api/charge-documents/[id]/pay` — `status='pending'` → `'paid'`, set `paid_at`. Locks.
- `POST /api/charge-documents/[id]/unpay` — `'paid'` → `'pending'`, clear `paid_at`. Reopens.
- `POST /api/charge-documents/[id]/cancel` — `withTransaction`: `status='canceled'`,
  `canceled_at=NOW()`, and sweep `UPDATE time_entries SET charge_document_id = NULL WHERE
  charge_document_id = $id AND user_id = $u`. Canceled documents are kept for history (lines
  retain their snapshot; `time_entry_id` may be NULL after the sweep — that's fine, the
  snapshot still prints).
- `DELETE /api/charge-documents/[id]` — optional, only when `canceled` (hard delete a
  mistake). CASCADE removes lines. Out of v1 if not needed.

All status-changing routes enforce the transition server-side (reject illegal transitions
with 409 + Hebrew message), and run the status change + entry sweep **atomically**.

## UX (screen + the four states)

`app/(auth)/reports/page.tsx` is renamed in the nav to **"התחשבנות"** and gains a tab bar.
Given the file is already 1726 lines, the new tabs are split into focused components under
`app/(auth)/reports/` (e.g. `BillableTab.tsx`, `DocumentsTab.tsx`, `ChargeDocumentView.tsx`)
rather than growing the monolith; the existing report becomes `AdHocReportTab` (largely a
move, minimal change). Design tokens only (ClickHouse dark), RTL/logical properties, tap
targets ≥44px, inputs 16px under 640px.

- **תאב לחיוב:** client picker + month picker → table of unbilled items with checkboxes;
  fixed/retainer charge shown as a selectable line with a soft "כבר נכלל בתעודה #N" badge if
  applicable; sticky footer with running selected total + **"הפק תעודת התחשבנות"**.
- **תאב תעודות:** list with status badges (ממתין / שולם / בוטל); row → document view with
  per-line edit (while pending), "סמן כשולם", "בטל תשלום", "בטל תעודה", "ייצוא PDF".
- **תאב דוח חד-פעמי:** unchanged behavior.

The four states, per screen/section:
- **Loading:** skeleton rows for the billable list and the documents list.
- **Empty:** "אין פריטים לחיוב ללקוח הזה 🎉" (with hint) / "עדיין לא הפקת תעודות" + CTA to the
  לחיוב tab.
- **Error:** Hebrew message + "נסה שוב"; English `console.error` with context. Network vs
  validation handled distinctly.
- **Success:** toast "תעודה #N נוצרה" after issue; "סומן כשולם" / "התעודה בוטלה" after status
  changes.

Destructive/consequential actions (mark paid, cancel) use a confirm dialog with explicit
wording. A locked (paid) document shows fields `disabled` with the hint "בטל תשלום כדי לערוך"
— never a silently dead control.

## PDF

Reuse the existing 6-template `window.print()` path. For a saved document the printed header
reads **"תעודת התחשבנות פנימית"** + `doc_number` + status, and the body renders from
`charge_document_lines` (the snapshot — so the print is stable regardless of later entry
edits). Each item line prints `label`, the per-line `description`/`note`, `אסמכתא {item_ref}`
(item lines only), and quantity/rate/amount. Fixed/retainer lines print their `label` (e.g.
"ריטיינר יוני 2026") and amount. Footer shows the document total in the client's currency.

## Validation (Zod, `lib/schemas/charge-documents.ts`, server-enforced)

- Create: `clientId` non-empty; at least one selected line; `pdfTemplate` ∈ known templates;
  every `timeEntryId` a string. Server re-checks ownership + unbilled state of each entry.
- Status routes: body minimal; the **transition legality** is the real validation (enforced
  against current `status`, 409 on violation).
- Line edit: `description`/`note` length caps; line add requires a valid unbilled
  `timeEntryId` **or** a well-formed computed line (`source_type`, `period_month`, `amount`).

## Migration path (dev → prod, manual)

`db:migrate`/`db:generate` are **broken** (drizzle meta drift) — apply by hand-written SQL.

1. Update `src/db/schema.ts`: add `chargeDocuments`, `chargeDocumentLines`, the
   `chargeDocumentId` column on `timeEntries`, and `nextChargeDocNumber` on `userProfiles`
   (matching conventions above) — for Drizzle type-safety, even though migration is manual.
2. Write `drizzle/0013_charge_documents.sql` (CREATE TABLEs + ALTER `time_entries` ADD COLUMN
   + ALTER `user_profiles` ADD COLUMN + indexes), wrapped `BEGIN; … COMMIT;`.
3. **Dev branch** (Neon `dev`, role admin): `psql "$DATABASE_URL_ADMIN" -f
   drizzle/0013_charge_documents.sql`, then apply the RLS DO-block (as `neondb_owner`).
4. Smoke-test as `clockbill_app`: user A issues a document; confirm user B's session cannot
   read it or its lines (IDOR check).
5. **Prod branch** (`main`): take a Neon snapshot first, then repeat steps 3–4 with the prod
   admin URL.
6. Never run `db:migrate`/`db:push` for this change.

Depends on `0009_item_ref` being applied first (for `item_ref` / `next_item_ref`). If issued
out of order, the `item_ref` snapshot is `NULL` until 0009 lands.

## Testing

- **Unit:** `total` computation from selected lines (hourly + item + fixed mixed, currency);
  the soft "period already billed" detection; transition legality table
  (pending→paid→pending, pending→canceled, illegal paid→edit rejected).
- **Integration (user-scoped, BOLA):**
  - `POST /api/charge-documents` links exactly the selected entries, sets their
    `charge_document_id`, snapshots lines (incl. `item_ref` when present), assigns a
    per-user `doc_number`; two documents in a row get consecutive numbers.
  - Selecting an already-billed entry (race) does not double-link (the `IS NULL` guard).
  - `cancel` returns every linked entry to `charge_document_id = NULL` atomically.
  - `pay` then `unpay` round-trips; `PATCH` on a `paid` document → 409.
  - Bob cannot GET/PATCH/pay/cancel Alice's document (→ 404/empty); Bob cannot add Alice's
    `time_entry_id` to his own document.
- **RLS:** direct DB check that `clockbill_app` bound to user B sees zero of user A's
  documents/lines.

## Files touched

- **Migration:** `drizzle/0013_charge_documents.sql` (psql → dev + prod) + RLS block appended
  to `drizzle/rls-policies.sql` (`charge_documents`, `charge_document_lines`).
- `src/db/schema.ts` — two new tables, `timeEntries.chargeDocumentId`,
  `userProfiles.nextChargeDocNumber`.
- `lib/schemas/charge-documents.ts` — Zod schemas (create, line-edit, status).
- `app/api/charge-documents/route.ts` (GET list, POST create),
  `app/api/charge-documents/billable/route.ts` (GET),
  `app/api/charge-documents/[id]/route.ts` (GET, PATCH, DELETE),
  `app/api/charge-documents/[id]/pay/route.ts`,
  `.../unpay/route.ts`, `.../cancel/route.ts`.
- `app/(auth)/reports/page.tsx` — tab bar + nav rename to "התחשבנות"; extract today's report
  into `AdHocReportTab`.
- `app/(auth)/reports/BillableTab.tsx`, `DocumentsTab.tsx`, `ChargeDocumentView.tsx` (new,
  focused components).
- Nav label update wherever "דוחות" is rendered.
- `lib/fixed-charges.ts` — reuse for the per-month computed charge in the billable list (no
  change expected; verify the signature fits).
- Tests under `tests/unit/` (+ integration checks for the new routes and RLS).

## Out of scope / follow-ups

Partial payments, multi-client documents, tax-invoice numbering/format, accounting-software
integration, emailing the document, hard double-billing enforcement. Revisit only if asked.
