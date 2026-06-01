# Ad-hoc (one-off) items in a time entry — Design

> 2026-06-01. Lets a user bill a one-off item ("מכתב", "חוות דעת") directly inside a
> time entry by typing a name + unit price, without pre-defining it on the client —
> with an option to save it to the client for reuse. Items stay **per-client** (no
> global catalog). Approach A from the brainstorming session.

## Problem

Items today are **per-client only**, defined inside the client edit form (`client_rates`,
`kind='item'`). In a time entry you can only **pick** a pre-defined item. There is no way to:
- bill a genuinely one-off item without first leaving to edit the client, and
- when a client has no items, the entry form dead-ends ("ללקוח זה אין פריטים מוגדרים").

This is also why the owner "didn't see" the feature — it's discoverable only from the client form.

## Scope

**In:** ad-hoc item entry in the manual time-entry form, with an optional "save to client" path.
**Out (YAGNI):** global item catalog, recommended-items-by-domain, ad-hoc items in the mobile/running
timer (manual entry only for now).

## Data model

**Ad-hoc lines: no schema change.** `time_entries` already snapshots a line: `billing_kind`,
`rate` (₪/unit), `rate_label` (item name), `quantity`. An ad-hoc item is just a line where these come
from typed values instead of a looked-up `client_rates` row. "Save to client" inserts one
`client_rates` row (`kind='item'`, `is_default=false`) — same table/shape as today.

**Item reference number: one schema change.** Every *item billing line* (predefined or ad-hoc) gets a
persistent, per-user, monotonically increasing internal reference number ("אסמכתא"), for internal
reconciliation and for printing on the charge document. Hourly lines do **not** get one.
- Add `time_entries.item_ref INTEGER` — NULL for hourly lines, set for item lines.
- Add a per-user counter `user_profiles.next_item_ref INTEGER NOT NULL DEFAULT 1`, mirroring the
  existing `next_invoice_number` pattern already on that table.
- New migration file (out-of-band psql per the meta-drift workflow) + matching `src/db/schema.ts`,
  applied to dev AND prod. `item_ref` is also added to the relevant report/entry SELECTs.

### Reference-number assignment rules
- Assigned **only** when `billing_kind = 'item'`, **at creation**, inside the same transaction as the
  entry INSERT: atomically `UPDATE user_profiles SET next_item_ref = next_item_ref + 1 WHERE user_id=$1
  RETURNING next_item_ref` (row-locked → concurrency-safe). Fallback if the user has no profile row
  yet: `COALESCE(MAX(item_ref),0)+1 WHERE user_id=$1` under a per-user advisory lock.
- **Stable forever:** never reassigned on edit. If a PUT switches an existing line from hourly→item and
  it has no `item_ref`, assign one then; an item line that already has a ref keeps it.
- **Never reused:** counter only moves forward; deleting a line leaves a gap (like invoice numbers).
- Display format is presentational (e.g. `אסמכתא 42` / `#42`); only the integer is stored.

## UX (`app/entries/page.tsx`, item mode)

When `billingKind === "item"`, the item `<select>` gets a first option **"+ פריט חד-פעמי…"** with a
sentinel value (e.g. `"__adhoc__"`). Selecting it reveals two inline fields plus the existing quantity:

- **שם הפריט** (text, required) — e.g. "מכתב"
- **מחיר ליחידה ₪** (number ≥ 0, required)
- **כמות** (existing field, > 0)
- A quiet checkbox: **"שמור פריט זה ללקוח לשימוש חוזר"** (default off).

When a client has **no** items, the form opens directly in ad-hoc mode (fields shown), replacing the
current dead-end message. The toggle between "pick existing" and "ad-hoc" is the dropdown itself.

Form state adds: `adhoc: boolean` (derived from `rateId === "__adhoc__"`), `adhocName: string`,
`adhocPrice: string`, `saveItemToClient: boolean`. On edit of an existing item line whose `rateLabel`
doesn't match any current client item, we open in ad-hoc mode pre-filled from the snapshot.

## Data flow

**Save entry (existing `POST/PUT /api/entries`).** For an ad-hoc line the form sends
`billingKind:"item"`, `rate:<typed price>`, `rateLabel:<typed name>`, `quantity`, and **no** `rateId`.
The API already accepts these (Zod: `rate`, `rateLabel`, `quantity`, `billingKind`) — the line is
snapshotted exactly like a predefined item. The create transaction also assigns `item_ref` for item
lines (see assignment rules above). We fold in P1 fix #4 here too: collapse the route's 4 sequential
queries to 2 via `INSERT … RETURNING` in a CTE — the counter UPDATE + INSERT + JOIN-return all run in
one transaction.

**Save item to client (new `POST /api/clients/[id]/rates`).** When the checkbox is on, after the entry
saves, the page calls this endpoint to append the item to the client *definition*. The client id is
derived from `project → clientId`. **If an item with that name already exists for the client, leave the
existing one untouched** (no duplicate, no price change — past billing already snapshots its own price,
and the definition is a master template). Effectively an idempotent "create if missing".

## Per-line notes on the billing document (REQUIRED)

Each item instance must carry a free-text detail that appears on the charge document, so a client
billed for 10× "כתיבת מכתב" sees the subject of each letter. **This already works today** and needs
no schema change: `time_entries` has `description` + `notes`, and the printable report (the
"פירוט לפי פרויקט" table, `app/(auth)/reports/page.tsx`) renders each line as
`{description} ({notes}) · {rateLabel}`. The gaps to close:

1. **Form clarity for items.** Keep the two existing fields (no merge, no new column), but in **item
   mode** relabel the required "תיאור" → **"פירוט"** with an invoice-aware placeholder, e.g.
   *"נושא / פירוט — יופיע בתעודת החיוב (למשל: בנושא הסכם שכירות)"*. `description` remains the primary
   printed per-line detail; `notes` stays the optional secondary line (also printed, in parens). The
   relabel is cosmetic/per-kind only — the stored columns are unchanged.
2. **On-screen parity.** The on-screen detail table (`reportData.entries.map`, ~line 1462) shows
   `description · rateLabel` but not `notes`. Add `notes` there so screen matches the PDF.
3. **Ad-hoc lines** carry the same detail field end-to-end (description/notes → snapshot → print).
4. **Item reference number** prints next to each item line on the charge document (e.g.
   `אסמכתא 42`) and shows on the entries list for item lines. Hourly lines show nothing here.

No new column. The "byRateLabel" summary stays aggregated (no notes) — it's a totals section, not the
itemized list; the itemized per-project table is where notes appear.

## Validation (boundary, server-side)

- **Client form:** ad-hoc → name and price required; quantity > 0 (unchanged).
- **`POST/PUT /api/entries`:** add a rule — if `billingKind:"item"` and no resolvable `rateId`, require
  `rateLabel` non-empty and `rate >= 0`, so an unnamed item can't be persisted.
- **`POST /api/clients/[id]/rates`:** `getUser()` + `user_id` scoping; validate body with the existing
  `clientRateSchema` (kind forced to `'item'`, `isDefault:false`). RLS already protects `client_rates`.

## The four states

- **Empty (client has no items):** ad-hoc fields shown immediately — no dead-end.
- **Loading/Success:** unchanged from today's entry save.
- **Error:** entry-save failure shows the existing inline form error. **Save-to-client failure does NOT
  fail the entry** (the entry is already saved): show a warning toast
  "הרשומה נשמרה, אך הפריט לא נשמר ללקוח" and keep going.

## Testing

- **Unit:** ad-hoc validation (name/price/quantity); "create item if missing" leaves an existing
  same-name item untouched.
- **Integration:** `POST /api/entries` with an ad-hoc item → correct snapshot (rate/rateLabel/quantity,
  no rateId) **and a non-null `item_ref`**; an hourly entry gets `item_ref = NULL`; two item entries in
  a row get **consecutive** refs; a deleted item line leaves a gap (no reuse); `POST /api/clients/[id]/rates`
  is user-scoped (Bob cannot add an item to Alice's client → 404/empty) and is create-if-missing.

## Files touched

- **Migration** (`drizzle/0009_item_ref.sql`, applied via psql to dev + prod) + `src/db/schema.ts`:
  add `time_entries.item_ref INTEGER`, `user_profiles.next_item_ref INTEGER NOT NULL DEFAULT 1`.
- `app/entries/page.tsx` — ad-hoc fields, sentinel option, checkbox, edit-prefill, item "פירוט" relabel,
  save-to-client call; show `item_ref` on item lines.
- `app/api/entries/route.ts` — item-without-rateId validation; `item_ref` assignment in the create
  transaction (item lines only); CTE query collapse (P1 #4); add `item_ref` to GET/PUT SELECTs.
- `app/api/clients/[id]/rates/route.ts` — add `POST` (single item, create-if-missing, user-scoped).
- `app/api/reports/route.ts` — select `item_ref` so it reaches the report/charge document.
- `lib/schemas/rates.ts` — reuse `clientRateSchema`; add an ad-hoc-entry validation helper if needed.
- `app/(auth)/reports/page.tsx` — show `notes` in the on-screen detail table; print `item_ref` (e.g.
  `אסמכתא 42`) on each item line in the per-project charge table.
- Tests under `tests/unit/` (+ an integration check for the new POST and ref assignment).

## Out of scope / follow-ups

Global catalog, domain-recommended items, ad-hoc in the running timer. Revisit only if asked.
