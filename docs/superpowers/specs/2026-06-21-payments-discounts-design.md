# Spec — Payment Tracking + Discounts (Phase C)

**Date:** 2026-06-21
**Branch:** `feat/payments-discounts` (to be created)
**Status:** Approved design, ready for implementation plan

> Format note: markdown (git-committed process artifact for the `writing-plans` skill; the global HTML-docs rule carves out PR-diff files).

## Background

ClockBill freelancers settle ("התחשבנות") with clients on a recurring cycle. Phase A (email charge documents via a branded `/doc/[token]` link) and Phase B (settlement-date reminders) shipped 2026-06-21. This is **Phase C**, the last of the 3-phase roadmap from Shirly's feedback.

Today "paid" is a single status flip (`pending → paid`) with no record of *how much*, *when*, or *via what* — and no concept of a partial payment or a discount. Phase C turns that flip into a real payment journal and adds discount documentation.

## Goals

1. **Payment journal** — record one or more payments received against a charge document (amount, date, method, note), including **partial payments**, with outstanding-to-collect derived live.
2. **Discounts** — record a document-level discount (percent or fixed amount) that flows into the document totals and the gross owed.
3. **Visibility** — outstanding/collected surfaced on the document, the list, the dashboard ("פתוח לגבייה"), and (summary-only) on the public client link.

## Non-goals (Phase C)

- **Official tax documents** — ClockBill produces an unofficial "התחשבנות", never a קבלה / חשבונית-מס. No receipts, no invoice numbering beyond the existing `doc_number`. (Regulatory boundary — out of scope by design.)
- Uploading/attaching receipts or expense documents.
- Per-line discounts (document-level only — see decision 5).
- Automatic payment reconciliation / bank import. Payments are hand-entered.
- An append-only immutable ledger (see decision 2).

## Key decisions (resolved during brainstorming)

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| 1 | Scope | **One combined Phase C spec, single migration** | Payments + discounts share the totals block and the 6 PDF templates; splitting would touch that surface twice |
| 2 | Payment data model | **`charge_document_payments` table + derived status** (editable/deletable rows) | Hand-entered, synchronous, single-user; append-only ledger (Stripe playbook) is for async out-of-order processor webhooks, not this domain — a typo should be an edit, not a reversal entry |
| 3 | Payment fields | **amount + date + `method` enum (nullable) + optional note** | Enum (`bank_transfer`/`bit`/`cash`/`check`/`credit`/`other`) keeps it i18n-clean and aggregable; `other`+note is the escape hatch |
| 4 | Reconciliation target | **The document's final owed total** = gross when VAT applies, = net when it doesn't | For a no-VAT freelancer this *is* "always net" (what the user asked for); for a VAT doc the client transfers the gross, so net-only would silently under-collect by the VAT amount |
| 5 | Discount model | **Document-level, percent OR fixed amount, applied to net pre-VAT**, snapshotted at issue | "הנחה על ההתחשבנות" is document-level; discounting the work then charging VAT on the billed amount is correct Israeli invoicing |
| 6 | Public client view | **Discount always; payment summary only once a payment exists** | Client seeing "received X, Y to go" reinforces the settle-up loop; a fresh unpaid doc stays clean; detailed per-payment log stays freelancer-only |
| 7 | Surfaces | **Document panel + list badge + dashboard "פתוח לגבייה" card** | The three places the freelancer needs it; dashboard card fits the existing customizable-section system |
| 8 | Cancel with payments | **Block cancel when any payment is recorded** | Keeps the invariant "a canceled doc has no money against it"; forces an explicit delete-payments-first decision; prevents double-billing freed entries |

## Architecture

### Data model — migration `0033` (additive, no backfill)

**New table `charge_document_payments`** — one row per payment received:

| column | type | constraints |
|---|---|---|
| `id` | text | PRIMARY KEY (`gen_random_uuid()::text`) |
| `user_id` | text | NOT NULL (tenant scope) |
| `document_id` | text | NOT NULL → `charge_documents(id)` ON DELETE CASCADE |
| `amount` | real | NOT NULL, CHECK `amount > 0` |
| `paid_at` | date | NOT NULL (date payment was received) |
| `method` | text | NULL, CHECK `method IS NULL OR method IN ('bank_transfer','bit','cash','check','credit','other')` |
| `note` | text | NULL |
| `created_at` | timestamp | DEFAULT now() |
| `updated_at` | timestamp | DEFAULT now() |

Indexes: `idx_charge_document_payments_user_id` on `(user_id)`, `idx_charge_document_payments_document_id` on `(document_id)`.

**RLS:** `ENABLE` + `FORCE ROW LEVEL SECURITY` with the standard `tenant_isolation` policy (`USING (user_id = current_setting('app.current_user_id', true))`) added to `drizzle/rls-policies.sql`, matching the existing tenant tables. App-level `WHERE user_id = $` kept as defense in depth.

**`charge_documents` — three changes (same migration):**
- `discount_type text` NULL — CHECK `discount_type IS NULL OR discount_type IN ('percent','amount')`.
- `discount_value real` NULL — CHECK `discount_value IS NULL OR discount_value >= 0`. Plus a combined CHECK that a `percent` discount is `<= 100`: `discount_type <> 'percent' OR discount_value IS NULL OR discount_value <= 100`.
- Extend the existing `charge_documents_status_check` to `status IN ('pending','partial','paid','canceled')`.

`total` **keeps its current meaning** = net subtotal (sum of line amounts, pre-discount). Legacy documents are untouched; discount/VAT layer on top at compute time.

### Money math — `lib/charge-documents.ts` (pure, unit-tested)

Single source of truth for document money, consumed by the PDF renderers, the list, the dashboard card, the public page, and payment reconciliation:

- `applyDiscount(netSubtotal: number, type: 'percent' | 'amount' | null, value: number | null): { discountAmount: number; discountedNet: number }`
  - `percent` → `discountAmount = roundMoney(netSubtotal * value/100)`; `amount` → `discountAmount = min(value, netSubtotal)` (never below 0); null → `{ 0, netSubtotal }`.
- `documentMoney({ total, discountType, discountValue, vatRate }): { netSubtotal; discountAmount; discountedNet; vatAmount; gross }`
  - composes `applyDiscount` then `computeVatBreakdown(discountedNet, vatRate)` from `lib/vat.ts`. `gross` is the final owed total.
- `paymentStatus(gross: number, paidSum: number): 'pending' | 'partial' | 'paid'`
  - money-safe (`lib/money.ts`): `paid` when `paidSum >= gross` (rounded), `pending` when `paidSum <= 0`, else `partial`.
- `outstanding(gross: number, paidSum: number): number` → `max(0, roundMoney(gross - paidSum))` (overpayment clamps to 0, never negative).

### Status model — maintained derived cache

`charge_documents.status` stays a column (preserves existing indexes, list filters, the status CHECK) but becomes a **cache recomputed from the payment journal**, never hand-flipped:

- Every payment mutation runs in a transaction: `SELECT … FOR UPDATE` the document → sum its payments → `documentMoney(...)` for `gross` → `paymentStatus(gross, paidSum)` → `UPDATE charge_documents SET status = $, paid_at = $`.
- `paid_at` = the `paid_at` date of the payment that crossed `gross` (i.e. set when status becomes `paid`); `NULL` while `pending`/`partial`.
- `canceled` remains an explicit terminal state set only by the cancel route, now guarded to require **zero payments**.

### Routes (all `getUser()` → 401; every query scoped by `user.id` + RLS-bound `query()`/`withTransaction`)

- `POST /api/charge-documents/[id]/payments` — add a payment. Zod: `amount` positive number, `paid_at` date, `method` optional enum, `note` optional string. Verify the document is owned by the caller and **not** `canceled` (409 `PAYMENT_DOC_CANCELED` otherwise). Insert + recompute status in one transaction.
- `PATCH /api/charge-documents/[id]/payments/[paymentId]` — edit a payment. Verify the payment belongs to a document owned by the caller (no IDOR on `paymentId`). Update + recompute in-tx.
- `DELETE /api/charge-documents/[id]/payments/[paymentId]` — delete a payment. Same ownership check. Delete + recompute in-tx.
- **Remove `pay` and `unpay` routes.** The one-click "סמן כשולם במלואו" in the UI POSTs a single payment for the current `outstanding` amount (preserves one-click UX while going through the journal). "Reopen" = delete the payment(s).
- `cancel` route — add the zero-payments guard: if any payment row exists for the document, return 409 `CANCEL_HAS_PAYMENTS` with Hebrew message "לא ניתן לבטל תעודה עם תשלומים רשומים — מחק קודם את התשלומים". Otherwise unchanged (frees entries, sets `canceled`).

### UI

- **`ChargeDocumentView`** — a "תשלומים" panel replacing the single pay button:
  - Outstanding shown prominently (or "שולם במלואו" when 0).
  - "הוסף תשלום" form: amount, date (defaults today), method select, optional note.
  - Editable + deletable list of recorded payments (date · amount · method · note).
  - One-click "סמן כשולם במלואו" → POSTs a payment for the outstanding.
  - **Four states**: loading (skeleton), success (panel), error (readable Hebrew + retry), empty (no payments yet → just the add form + full amount outstanding). Design tokens only.
- **Charge-documents list** — status badge gains `partial` ("שולם חלקית"); show outstanding per row so the freelancer can scan who still owes.
- **Dashboard** — new "פתוח לגבייה" stat card: sum of `outstanding` across non-canceled documents, **per-currency** (never sum mixed currencies — match the existing money-total cards). Registered as a toggleable/reorderable section in the customizable-dashboard config (`dashboard_config` jsonb + customizer).
- **Discount editing** — the discount (type + value) is set/changed in the existing charge-document edit flow (`PUT /api/charge-documents/[id]`), allowed while the document is `pending` or `partial`, **blocked once fully `paid` or `canceled`** (the totals are then settled). Server-validated (type enum, value ≥ 0, percent ≤ 100) + DB CHECKs.
- **PDF templates (all 6)** — the shared totals block renders, in order: subtotal → **− הנחה** (when present) → discounted net → **+ מע״מ** (when present) → **סה״כ לתשלום** (gross). Wired through the existing `templateRules()` / totals rendering so all six templates stay consistent; the WYSIWYG settings preview reflects it. Reuse the document-language formatter pattern (recreate formatters inside the locale-bound subtree — closure trap).
- **Public `/doc/[token]`** — discount line always shown in totals; payment summary block ("שולם X מתוך Y · נותר לתשלום Z") rendered **only when a payment exists**, via one extra token-scoped `adminQuery` aggregate (`SUM(amount)` over the doc's payments). No per-payment detail, methods, or notes exposed.
- **i18n** — he + en parity for every new string (method labels, panel/badge/card copy); passes the existing parity test.

## Security requirements (must hold; verified against the iron laws + playbooks)

1. **BOLA / IDOR:** every payment route is scoped by `user.id`; `PATCH`/`DELETE` verify the `paymentId` belongs to a document owned by the caller before mutating (a payment id from another tenant resolves to 404, never acts). The cancel guard is user-scoped. No ID trusted from the URL alone.
2. **New-table RLS:** `charge_document_payments` is `ENABLE + FORCE ROW LEVEL SECURITY` with `tenant_isolation`; app-level `WHERE user_id = $` retained.
3. **Boundary validation:** payment input validated server-side with Zod (positive amount, date, method enum) **and** mirrored by DB CHECK constraints; discount validated by CHECKs (type enum, value ≥ 0, percent ≤ 100) and the write path.
4. **Transactional integrity:** status/paid_at recompute happens in the same transaction as the payment mutation, under `SELECT … FOR UPDATE` on the document, so concurrent payment edits can't leave a stale status.
5. **Public page stays read-only & minimal:** token-scoped `adminQuery`, `canceled` → 404 (already), payment **aggregate only** — no methods/notes/dates of individual payments leak to the unauthenticated link.
6. **Observability / no leaks:** `createLogger` everywhere; generic Hebrew 500 + `error_code` (no stack traces to client); no `console.log` of sensitive data.
7. **Immutability in code:** new objects, no mutation (the chosen non-ledger storage is a product/UX decision, separate from the code-level immutability law).

## Testing

- **Unit (`tests/unit/`):**
  - `applyDiscount` — percent, fixed amount, amount-exceeds-subtotal clamp, null.
  - `documentMoney` — no VAT/no discount (gross == net == total), VAT only, discount only, VAT + discount together (VAT on discounted net), legacy doc (null discount).
  - `paymentStatus` / `outstanding` — pending/partial/paid thresholds, float-dust near-equality, overpayment clamp to 0.
- **Manual / live QA** (no API/integration harness in this repo): add/edit/delete payment → status + outstanding update; one-click full payment; cancel blocked with payments; partial badge on list; dashboard per-currency card; all 6 PDF templates show discount/VAT/gross correctly; public page summary appears only after a payment; lint + build + i18n parity green.

## Affected files (orientation)

- `src/db/schema.ts` + `drizzle/0033_payments_discounts.sql` (new table + 3 `charge_documents` changes) + `drizzle/rls-policies.sql` (new tenant policy).
- `lib/charge-documents.ts` (add `applyDiscount` / `documentMoney` / `paymentStatus` / `outstanding`) + `tests/unit/charge-documents-money.test.ts` (or extend the existing charge-doc test file).
- `app/api/charge-documents/[id]/payments/route.ts` (POST) + `app/api/charge-documents/[id]/payments/[paymentId]/route.ts` (PATCH/DELETE) — new.
- `app/api/charge-documents/[id]/cancel/route.ts` (zero-payments guard); `app/api/charge-documents/[id]/route.ts` (accept discount fields in the PUT, gated to pending/partial); **remove** `pay/route.ts` + `unpay/route.ts`.
- `ChargeDocumentView` (payments panel) + the charge-docs list component (partial badge + outstanding) + the dashboard section registry & a new `OpenForCollectionCard`.
- `PdfChargeDocument` + the shared `templateRules()` / totals rendering + the WYSIWYG settings preview (discount line).
- `app/[locale]/doc/[token]/page.tsx` + `PublicChargeDocument.tsx` (payment summary aggregate).
- next-intl message catalogs (he + en).

## Migration / rollout

- **DEV migration first** (psql via `DATABASE_URL_ADMIN`); validate the feature on dev.
- **PROD migration `0033` is a separate, explicitly-approved step applied BEFORE merging to `main`** (merge triggers Vercel auto-deploy; the schema must exist first). Admin connection string in `.env.local.bak.prod-shared`.
- Additive only (one new table + 3 nullable/loosened constraints), no backfill. Existing documents read as `pending` with no payments, no discount — fully paid status arrives only once a payment is recorded.
