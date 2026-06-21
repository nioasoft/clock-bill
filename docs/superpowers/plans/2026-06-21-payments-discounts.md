# Payment Tracking + Discounts (Phase C) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the single "mark as paid" flip into a real payment journal (partial payments, methods, outstanding) and add document-level discounts that flow through the totals and the public client view.

**Architecture:** A new `charge_document_payments` table holds hand-entered payments; document `status` becomes a derived cache recomputed transactionally from `SUM(payments)` vs the document's owed total. A document-level discount (percent or fixed amount) is applied to the net subtotal before VAT. All money math lives in pure helpers in `lib/charge-documents.ts`; a thin server helper persists the recomputed status. UI surfaces: a payments panel on the document, a `partial` badge + outstanding on the list, and a per-currency "open for collection" dashboard section.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, raw `pg` via `lib/db.ts` (`query`/`withTransaction`), Drizzle schema in `src/db/schema.ts`, Zod, next-intl (he/en), custom `tsx` test runner, Neon Postgres with FORCE RLS.

## Global Constraints

- **Every DB query touching user data is scoped by `user.id`** (BOLA) AND runs through the RLS-bound `query`/`withTransaction`. App-level `WHERE user_id = $` kept even though RLS enforces it (defense in depth).
- **New table `charge_document_payments` must be `ENABLE + FORCE ROW LEVEL SECURITY`** with the `tenant_isolation` policy + explicit grants to `clockbill_app`.
- **Money math only via `lib/money.ts`** (`roundMoney`/`addMoney`/`sumMoney`) — never raw `+`/`*` on currency. Reconcile against the **owed total** = gross when VAT applies, = net when it doesn't.
- **Discount is document-level**, `percent` or `amount`, applied to **net pre-VAT**. Editable only while status is `pending` or `partial`.
- **No `amount` column on `time_entries`** — duration is MINUTES; hourly amount = `(duration/60)*rate`.
- **Design tokens only** in app UI (`bg-card`, `text-foreground`, `text-primary`, `border-border`, `rounded-[var(--radius)]`, etc.) — no `bg-white`/`text-black`/`bg-gray-*`/hex. PDF templates (`*Pdf*`) are the only light-page exception.
- **i18n parity:** every new user-facing string added to BOTH `messages/he.json` and `messages/en.json` (a unit test enforces key parity). UI strings Hebrew; code comments/logs English.
- **Errors:** `createLogger` per route; generic Hebrew message + `error_code` on 500; never leak stack traces. Every screen has loading/success/error/empty states.
- **PDF/public renderers re-create locale-bound formatters inside their own subtree** (the nested-`NextIntlClientProvider` closure trap) — do not pass formatters as props.
- **Migrations:** DEV first (psql via `DATABASE_URL_ADMIN`); PROD `0033` is a separate, explicitly-approved step applied BEFORE merging to `main`.

---

### Task 1: Pure money helpers + payment-method catalog

**Files:**
- Modify: `lib/charge-documents.ts` (append new exports)
- Test: `tests/unit/charge-documents-money.test.ts` (create)

**Interfaces:**
- Consumes: `roundMoney`, `addMoney`, `sumMoney` from `lib/money.ts`; `computeVatBreakdown` from `lib/vat.ts`.
- Produces (relied on by Tasks 4–10):
  - `type DiscountType = 'percent' | 'amount'`
  - `const PAYMENT_METHODS: readonly ['bank_transfer','bit','cash','check','credit','other']`
  - `type PaymentMethod = (typeof PAYMENT_METHODS)[number]`
  - `applyDiscount(netSubtotal: number, type: DiscountType | null, value: number | null): { discountAmount: number; discountedNet: number }`
  - `documentMoney(input: { total: number; discountType: DiscountType | null; discountValue: number | null; vatRate: number | null }): { netSubtotal: number; discountAmount: number; discountedNet: number; vatAmount: number; gross: number }`
  - `paymentStatus(gross: number, paidSum: number): 'pending' | 'partial' | 'paid'`
  - `outstanding(gross: number, paidSum: number): number`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/charge-documents-money.test.ts`:

```typescript
import {
  applyDiscount,
  documentMoney,
  paymentStatus,
  outstanding,
  PAYMENT_METHODS,
} from "../../lib/charge-documents";

let passed = 0;
let failed = 0;
function assert(name: string, cond: boolean): void {
  if (cond) { passed++; } else { failed++; console.error(`  ✗ ${name}`); }
}
function eq(name: string, a: number, b: number): void {
  assert(`${name} (${a} === ${b})`, Math.abs(a - b) < 1e-9);
}

// applyDiscount
{
  const p = applyDiscount(1000, "percent", 10);
  eq("percent discountAmount", p.discountAmount, 100);
  eq("percent discountedNet", p.discountedNet, 900);

  const a = applyDiscount(1000, "amount", 150);
  eq("amount discountAmount", a.discountAmount, 150);
  eq("amount discountedNet", a.discountedNet, 850);

  const clamp = applyDiscount(100, "amount", 250); // never below 0
  eq("amount clamp discountAmount", clamp.discountAmount, 100);
  eq("amount clamp discountedNet", clamp.discountedNet, 0);

  const none = applyDiscount(1000, null, null);
  eq("null discountAmount", none.discountAmount, 0);
  eq("null discountedNet", none.discountedNet, 1000);
}

// documentMoney
{
  const plain = documentMoney({ total: 1000, discountType: null, discountValue: null, vatRate: null });
  eq("plain gross", plain.gross, 1000);
  eq("plain net", plain.netSubtotal, 1000);
  eq("plain vat", plain.vatAmount, 0);

  const vat = documentMoney({ total: 1000, discountType: null, discountValue: null, vatRate: 18 });
  eq("vat gross", vat.gross, 1180);
  eq("vat vatAmount", vat.vatAmount, 180);

  const disc = documentMoney({ total: 1000, discountType: "percent", discountValue: 10, vatRate: null });
  eq("disc gross", disc.gross, 900);

  const both = documentMoney({ total: 1000, discountType: "percent", discountValue: 10, vatRate: 18 });
  // 1000 - 100 = 900 net; 900 * 1.18 = 1062
  eq("both discountedNet", both.discountedNet, 900);
  eq("both vatAmount", both.vatAmount, 162);
  eq("both gross", both.gross, 1062);
}

// paymentStatus + outstanding
{
  assert("status pending", paymentStatus(1180, 0) === "pending");
  assert("status partial", paymentStatus(1180, 600) === "partial");
  assert("status paid exact", paymentStatus(1180, 1180) === "paid");
  assert("status paid float dust", paymentStatus(1000, 999.999999) === "paid");
  assert("status paid overpay", paymentStatus(1000, 1200) === "paid");

  eq("outstanding partial", outstanding(1180, 600), 580);
  eq("outstanding overpay clamps to 0", outstanding(1000, 1200), 0);
  eq("outstanding full", outstanding(1000, 1000), 0);
}

// catalog
assert("6 payment methods", PAYMENT_METHODS.length === 6);
assert("includes bit", PAYMENT_METHODS.includes("bit"));

console.log(`\ncharge-documents-money: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx tests/unit/charge-documents-money.test.ts`
Expected: FAIL — `applyDiscount`/`documentMoney`/etc. are not exported yet (import error or undefined).

- [ ] **Step 3: Write minimal implementation**

Append to `lib/charge-documents.ts` (the `import` for `computeVatBreakdown` goes at the top with the other imports):

```typescript
import { computeVatBreakdown } from "./vat";
```

```typescript
// ─── Discounts, gross, and payment reconciliation ───────────────────────────

/** Document-level discount kind. */
export type DiscountType = "percent" | "amount";

/** Payment methods recorded against a charge document (i18n'd in the UI). */
export const PAYMENT_METHODS = [
  "bank_transfer",
  "bit",
  "cash",
  "check",
  "credit",
  "other",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/**
 * Apply a document-level discount to the net subtotal (pre-VAT). `percent`
 * takes `value` as a percentage; `amount` as an absolute figure, clamped so the
 * discounted net never goes below 0. A null type/value is a no-op.
 */
export function applyDiscount(
  netSubtotal: number,
  type: DiscountType | null,
  value: number | null
): { discountAmount: number; discountedNet: number } {
  if (!type || value == null || value <= 0) {
    return { discountAmount: 0, discountedNet: roundMoney(netSubtotal) };
  }
  const raw = type === "percent" ? netSubtotal * (value / 100) : value;
  const discountAmount = roundMoney(Math.min(raw, netSubtotal));
  return { discountAmount, discountedNet: roundMoney(netSubtotal - discountAmount) };
}

/**
 * Full money breakdown for a charge document: net subtotal (sum of lines,
 * pre-discount) → discount → discounted net → VAT (on the discounted net) →
 * gross owed. `gross` is the figure payments reconcile against.
 */
export function documentMoney(input: {
  total: number;
  discountType: DiscountType | null;
  discountValue: number | null;
  vatRate: number | null;
}): {
  netSubtotal: number;
  discountAmount: number;
  discountedNet: number;
  vatAmount: number;
  gross: number;
} {
  const netSubtotal = roundMoney(input.total);
  const { discountAmount, discountedNet } = applyDiscount(
    netSubtotal,
    input.discountType,
    input.discountValue
  );
  const vat = computeVatBreakdown(discountedNet, input.vatRate);
  return {
    netSubtotal,
    discountAmount,
    discountedNet,
    vatAmount: vat.vatAmount,
    gross: vat.total,
  };
}

/** Derive document status from gross owed vs total paid (money-safe). */
export function paymentStatus(
  gross: number,
  paidSum: number
): "pending" | "partial" | "paid" {
  const g = roundMoney(gross);
  const p = roundMoney(paidSum);
  if (p <= 0) return "pending";
  if (p >= g) return "paid";
  return "partial";
}

/** Remaining amount to collect; never negative (overpayment clamps to 0). */
export function outstanding(gross: number, paidSum: number): number {
  return Math.max(0, roundMoney(roundMoney(gross) - roundMoney(paidSum)));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx tests/unit/charge-documents-money.test.ts`
Expected: PASS — `X passed, 0 failed`.

- [ ] **Step 5: Wire into the test runner & run the suite**

Confirm the custom runner picks up `tests/unit/*.test.ts` automatically:
Run: `npm test`
Expected: all tests pass, including the new file. (If the runner needs explicit registration, add the file the same way the existing `tests/unit/*.test.ts` are registered in `tests/run-tests.ts`.)

- [ ] **Step 6: Commit**

```bash
git add lib/charge-documents.ts tests/unit/charge-documents-money.test.ts
git commit -m "feat(payments): pure discount/gross/payment-status money helpers"
```

---

### Task 2: Migration 0033 — payments table + discount columns + RLS (DEV)

**Files:**
- Create: `drizzle/0033_payments_discounts.sql`
- Modify: `src/db/schema.ts` (new `chargeDocumentPayments` table + 3 `chargeDocuments` changes)
- Modify: `drizzle/rls-policies.sql` (add `charge_document_payments` to the FORCE loop + grant)

**Interfaces:**
- Produces: table `charge_document_payments(id, user_id, document_id, amount, paid_at, method, note, created_at, updated_at)`; `charge_documents.discount_type`, `charge_documents.discount_value`; status CHECK now allows `partial`.

- [ ] **Step 1: Write the migration SQL**

Create `drizzle/0033_payments_discounts.sql`:

```sql
-- Phase C: payment tracking + discounts.

-- 1) Payments journal (one row per payment received).
CREATE TABLE IF NOT EXISTS charge_document_payments (
  id          text PRIMARY KEY,
  user_id     text NOT NULL,
  document_id text NOT NULL REFERENCES charge_documents(id) ON DELETE CASCADE,
  amount      real NOT NULL,
  paid_at     date NOT NULL,
  method      text,
  note        text,
  created_at  timestamp DEFAULT now(),
  updated_at  timestamp DEFAULT now(),
  CONSTRAINT charge_document_payments_amount_check CHECK (amount > 0),
  CONSTRAINT charge_document_payments_method_check CHECK (
    method IS NULL OR method IN ('bank_transfer','bit','cash','check','credit','other')
  )
);
CREATE INDEX IF NOT EXISTS idx_charge_document_payments_user_id     ON charge_document_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_charge_document_payments_document_id ON charge_document_payments(document_id);

-- 2) Document-level discount.
ALTER TABLE charge_documents ADD COLUMN IF NOT EXISTS discount_type  text;
ALTER TABLE charge_documents ADD COLUMN IF NOT EXISTS discount_value real;
ALTER TABLE charge_documents DROP CONSTRAINT IF EXISTS charge_documents_discount_type_check;
ALTER TABLE charge_documents ADD CONSTRAINT charge_documents_discount_type_check
  CHECK (discount_type IS NULL OR discount_type IN ('percent','amount'));
ALTER TABLE charge_documents DROP CONSTRAINT IF EXISTS charge_documents_discount_value_check;
ALTER TABLE charge_documents ADD CONSTRAINT charge_documents_discount_value_check
  CHECK (
    discount_value IS NULL
    OR (discount_value >= 0 AND (discount_type <> 'percent' OR discount_value <= 100))
  );

-- 3) Allow the derived 'partial' status.
ALTER TABLE charge_documents DROP CONSTRAINT IF EXISTS charge_documents_status_check;
ALTER TABLE charge_documents ADD CONSTRAINT charge_documents_status_check
  CHECK (status IN ('pending','partial','paid','canceled'));

-- 4) RLS for the new table.
ALTER TABLE charge_document_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE charge_document_payments FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON charge_document_payments;
CREATE POLICY tenant_isolation ON charge_document_payments FOR ALL
  USING (user_id = current_setting('app.current_user_id', true))
  WITH CHECK (user_id = current_setting('app.current_user_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON charge_document_payments TO clockbill_app;
```

- [ ] **Step 2: Add the table + columns to the Drizzle schema**

In `src/db/schema.ts`, extend the `charge_documents` table definition: add to the columns block (next to `summaryMode`):

```typescript
    // Document-level discount, applied to the net subtotal before VAT.
    // discountType: 'percent' | 'amount' | NULL (no discount).
    discountType: text("discount_type"),
    discountValue: real("discount_value"),
```

Add to the `charge_documents` `(table) => [...]` constraints array:

```typescript
    check(
      "charge_documents_discount_type_check",
      sql`${table.discountType} IS NULL OR ${table.discountType} IN ('percent', 'amount')`
    ),
    check(
      "charge_documents_discount_value_check",
      sql`${table.discountValue} IS NULL OR (${table.discountValue} >= 0 AND (${table.discountType} <> 'percent' OR ${table.discountValue} <= 100))`
    ),
```

Update the existing `charge_documents_status_check` to include `'partial'`:

```typescript
    check(
      "charge_documents_status_check",
      sql`${table.status} IN ('pending', 'partial', 'paid', 'canceled')`
    ),
```

Add a new table after `chargeDocumentLines`:

```typescript
export const chargeDocumentPayments = pgTable(
  "charge_document_payments",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    documentId: text("document_id")
      .notNull()
      .references(() => chargeDocuments.id, { onDelete: "cascade" }),
    amount: real("amount").notNull(),
    paidAt: date("paid_at").notNull(),
    method: text("method"),
    note: text("note"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_charge_document_payments_user_id").on(table.userId),
    index("idx_charge_document_payments_document_id").on(table.documentId),
    check("charge_document_payments_amount_check", sql`${table.amount} > 0`),
    check(
      "charge_document_payments_method_check",
      sql`${table.method} IS NULL OR ${table.method} IN ('bank_transfer', 'bit', 'cash', 'check', 'credit', 'other')`
    ),
  ]
);
```

Ensure `date` is imported from `drizzle-orm/pg-core` at the top of `src/db/schema.ts` (check the existing import list; the `clients.settlement_reminded_at date` column means `date` is likely already imported — if not, add it).

- [ ] **Step 3: Add the new table to the RLS drift list**

In `drizzle/rls-policies.sql`, add `'charge_document_payments'` to the `FOREACH t IN ARRAY ARRAY[...]` list (next to `'charge_document_lines'`) AND to the commented drift-check `ARRAY[...]`. The migration's step-4 block already creates the policy+grant; the array entry keeps `scripts/check-rls.mjs` honest.

- [ ] **Step 4: Apply the migration to DEV and verify**

Run (DEV admin connection):

```bash
psql "$DATABASE_URL_ADMIN" -f drizzle/0033_payments_discounts.sql
```

Verify:

```bash
psql "$DATABASE_URL_ADMIN" -c "SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname='charge_document_payments';"
```
Expected: one row, both flags `t`.

```bash
psql "$DATABASE_URL_ADMIN" -c "\d charge_document_payments"
```
Expected: columns + the two CHECK constraints + two indexes present.

- [ ] **Step 5: Typecheck the schema change**

Run: `npx tsc --noEmit`
Expected: no errors from `src/db/schema.ts`.

- [ ] **Step 6: Commit**

```bash
git add drizzle/0033_payments_discounts.sql src/db/schema.ts drizzle/rls-policies.sql
git commit -m "feat(payments): migration 0033 — payments table + discount columns + RLS"
```

---

### Task 3: Zod schemas — payments + discount on PATCH

**Files:**
- Modify: `lib/schemas/charge-documents.ts`
- Test: `tests/unit/payment-schemas.test.ts` (create)

**Interfaces:**
- Consumes: `PAYMENT_METHODS` from `lib/charge-documents.ts`.
- Produces:
  - `createPaymentSchema` → `{ amount: number; paidAt: string; method?: PaymentMethod | null; note?: string | null }`
  - `updatePaymentSchema` (same fields, all optional, ≥1 required)
  - extended `patchChargeDocumentSchema` accepting `discount?: { type: 'percent'|'amount'; value: number } | null`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/payment-schemas.test.ts`:

```typescript
import { createPaymentSchema, patchChargeDocumentSchema } from "../../lib/schemas/charge-documents";

let passed = 0, failed = 0;
function assert(name: string, cond: boolean): void {
  if (cond) passed++; else { failed++; console.error(`  ✗ ${name}`); }
}

assert("valid payment", createPaymentSchema.safeParse({ amount: 600, paidAt: "2026-06-21", method: "bit" }).success);
assert("amount must be > 0", !createPaymentSchema.safeParse({ amount: 0, paidAt: "2026-06-21" }).success);
assert("bad method rejected", !createPaymentSchema.safeParse({ amount: 5, paidAt: "2026-06-21", method: "paypal" }).success);
assert("bad date rejected", !createPaymentSchema.safeParse({ amount: 5, paidAt: "21/06/2026" }).success);
assert("method optional", createPaymentSchema.safeParse({ amount: 5, paidAt: "2026-06-21" }).success);

assert("discount percent ok", patchChargeDocumentSchema.safeParse({ discount: { type: "percent", value: 10 } }).success);
assert("discount percent > 100 rejected", !patchChargeDocumentSchema.safeParse({ discount: { type: "percent", value: 150 } }).success);
assert("discount amount ok", patchChargeDocumentSchema.safeParse({ discount: { type: "amount", value: 150 } }).success);
assert("discount null clears", patchChargeDocumentSchema.safeParse({ discount: null }).success);
assert("negative discount rejected", !patchChargeDocumentSchema.safeParse({ discount: { type: "amount", value: -5 } }).success);

console.log(`\npayment-schemas: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx tests/unit/payment-schemas.test.ts`
Expected: FAIL — `createPaymentSchema` not exported.

- [ ] **Step 3: Implement the schemas**

In `lib/schemas/charge-documents.ts`, add the import and schemas:

```typescript
import { PAYMENT_METHODS } from "@/lib/charge-documents";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_PAYMENT_AMOUNT = 10_000_000;

/** POST /api/charge-documents/[id]/payments body. */
export const createPaymentSchema = z.object({
  amount: z.number().positive("סכום חייב להיות גדול מ-0").max(MAX_PAYMENT_AMOUNT, "סכום לא תקין"),
  paidAt: z.string().regex(ISO_DATE, "תאריך לא תקין"),
  method: z.enum(PAYMENT_METHODS).nullish(),
  note: z.string().max(500).nullish(),
});
export type CreatePaymentBody = z.infer<typeof createPaymentSchema>;

/** PATCH /api/charge-documents/[id]/payments/[paymentId] body. */
export const updatePaymentSchema = z
  .object({
    amount: z.number().positive("סכום חייב להיות גדול מ-0").max(MAX_PAYMENT_AMOUNT, "סכום לא תקין").optional(),
    paidAt: z.string().regex(ISO_DATE, "תאריך לא תקין").optional(),
    method: z.enum(PAYMENT_METHODS).nullish(),
    note: z.string().max(500).nullish(),
  })
  .refine(
    (d) => d.amount !== undefined || d.paidAt !== undefined || d.method !== undefined || d.note !== undefined,
    { message: "נא לספק לפחות שדה אחד לעדכון" }
  );
export type UpdatePaymentBody = z.infer<typeof updatePaymentSchema>;

/** Discount sub-object for the document PATCH (null = clear discount). */
export const discountSchema = z
  .object({
    type: z.enum(["percent", "amount"]),
    value: z.number().min(0, "ערך לא תקין"),
  })
  .refine((d) => d.type !== "percent" || d.value <= 100, { message: "אחוז הנחה לא יכול לעלות על 100" })
  .nullable();
```

Then extend `patchChargeDocumentSchema`: add `discount: discountSchema.optional(),` to its `.object({...})`, and add `d.discount !== undefined ||` to the `.refine(...)` "at least one field" predicate.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx tests/unit/payment-schemas.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full suite + typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: all pass; no type errors.

- [ ] **Step 6: Commit**

```bash
git add lib/schemas/charge-documents.ts tests/unit/payment-schemas.test.ts
git commit -m "feat(payments): zod schemas for payments + document discount"
```

---

### Task 4: Server status-recompute helper + payments routes (GET/POST, PATCH/DELETE)

**Files:**
- Create: `lib/charge-documents-server.ts` (server-only, DB-bound)
- Create: `app/api/charge-documents/[id]/payments/route.ts` (GET list + summary, POST add)
- Create: `app/api/charge-documents/[id]/payments/[paymentId]/route.ts` (PATCH, DELETE)

**Interfaces:**
- Consumes: `documentMoney`, `paymentStatus`, `outstanding` (Task 1); `createPaymentSchema`, `updatePaymentSchema` (Task 3); `withTransaction`/`query` from `lib/db`; `parseBody` from `lib/api-validation`; `getUser` from `lib/auth`.
- Produces:
  - `recomputeChargeStatus(client: PoolClient, documentId: string, userId: string): Promise<void>` — recomputes & persists `status` + `paid_at` from payments vs gross; **no-op if the document is `canceled`**.
  - `GET /api/charge-documents/[id]/payments` → `{ success, data: { payments: PaymentRow[], gross, paidSum, outstanding, status } }`.
  - `POST /api/charge-documents/[id]/payments`, `PATCH`/`DELETE .../[paymentId]`.

- [ ] **Step 1: Write the recompute helper**

Create `lib/charge-documents-server.ts`:

```typescript
/**
 * Server-only charge-document helpers that touch the DB. Kept out of
 * lib/charge-documents.ts so that module stays pure & unit-testable.
 */
import type { PoolClient } from "pg";
import { documentMoney, paymentStatus, type DiscountType } from "./charge-documents";

/**
 * Recompute and persist a document's derived status (`pending` | `partial` |
 * `paid`) and `paid_at` from its payment journal vs the gross owed. Must run
 * inside a transaction; the caller is expected to have locked the document row
 * (`SELECT ... FOR UPDATE`). No-op for canceled documents.
 */
export async function recomputeChargeStatus(
  client: PoolClient,
  documentId: string,
  userId: string
): Promise<void> {
  const docRes = await client.query(
    `SELECT total, discount_type, discount_value, vat_rate_snapshot, status
       FROM charge_documents WHERE id = $1 AND user_id = $2`,
    [documentId, userId]
  );
  if (docRes.rowCount === 0) return;
  const d = docRes.rows[0] as {
    total: number | null;
    discount_type: DiscountType | null;
    discount_value: number | null;
    vat_rate_snapshot: number | null;
    status: string;
  };
  if (d.status === "canceled") return;

  const payRes = await client.query(
    `SELECT COALESCE(SUM(amount), 0) AS paid_sum, MAX(paid_at) AS last_paid
       FROM charge_document_payments WHERE document_id = $1 AND user_id = $2`,
    [documentId, userId]
  );
  const paidSum = Number(payRes.rows[0]?.paid_sum ?? 0);
  const lastPaid = payRes.rows[0]?.last_paid ?? null;

  const { gross } = documentMoney({
    total: d.total ?? 0,
    discountType: d.discount_type,
    discountValue: d.discount_value,
    vatRate: d.vat_rate_snapshot,
  });
  const status = paymentStatus(gross, paidSum);
  const paidAt = status === "paid" ? lastPaid : null;

  await client.query(
    `UPDATE charge_documents SET status = $1, paid_at = $2, updated_at = NOW()
      WHERE id = $3 AND user_id = $4`,
    [status, paidAt, documentId, userId]
  );
}
```

- [ ] **Step 2: Write the list + add route**

Create `app/api/charge-documents/[id]/payments/route.ts`:

```typescript
import { createLogger } from "@/lib/logger";
const logger = createLogger("api:charge-documents:id:payments");
import { NextRequest, NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { getUser } from "@/lib/auth";
import { parseBody } from "@/lib/api-validation";
import { createPaymentSchema } from "@/lib/schemas/charge-documents";
import { documentMoney, outstanding, paymentStatus, type DiscountType } from "@/lib/charge-documents";
import { recomputeChargeStatus } from "@/lib/charge-documents-server";

type Ctx = { params: Promise<{ id: string }> };

/** GET — the document's payments + computed gross/paid/outstanding/status. */
export async function GET(_request: NextRequest, ctx: Ctx) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ success: false, error_code: "UNAUTHORIZED", message: "לא מחובר" }, { status: 401 });
    const { id } = await ctx.params;
    const { query } = await import("@/lib/db");

    const doc = await query(
      `SELECT total, discount_type, discount_value, vat_rate_snapshot
         FROM charge_documents WHERE id = $1 AND user_id = $2`,
      [id, user.id]
    );
    if (doc.rowCount === 0) return NextResponse.json({ success: false, error_code: "DOCUMENT_NOT_FOUND", message: "תעודה לא נמצאה" }, { status: 404 });
    const d = doc.rows[0] as { total: number | null; discount_type: DiscountType | null; discount_value: number | null; vat_rate_snapshot: number | null };

    const pays = await query(
      `SELECT id, amount, paid_at, method, note
         FROM charge_document_payments WHERE document_id = $1 AND user_id = $2
        ORDER BY paid_at, created_at`,
      [id, user.id]
    );
    const paidSum = pays.rows.reduce((s, p) => s + Number((p as { amount: number }).amount), 0);
    const { gross } = documentMoney({ total: d.total ?? 0, discountType: d.discount_type, discountValue: d.discount_value, vatRate: d.vat_rate_snapshot });

    return NextResponse.json({
      success: true,
      data: {
        payments: pays.rows,
        gross,
        paidSum,
        outstanding: outstanding(gross, paidSum),
        status: paymentStatus(gross, paidSum),
      },
    });
  } catch (error) {
    logger.error("GET payments failed:", error);
    return NextResponse.json({ success: false, error_code: "SERVER_ERROR", message: "שגיאה בטעינת תשלומים" }, { status: 500 });
  }
}

/** POST — record a payment, then recompute the document status. */
export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ success: false, error_code: "UNAUTHORIZED", message: "לא מחובר" }, { status: 401 });
    const { id } = await ctx.params;
    const parsed = await parseBody(request, createPaymentSchema);
    if (!parsed.ok) return parsed.response;
    const { amount, paidAt, method, note } = parsed.data;
    const { withTransaction } = await import("@/lib/db");

    await withTransaction(async (client: PoolClient) => {
      const doc = await client.query(
        `SELECT status FROM charge_documents WHERE id = $1 AND user_id = $2 FOR UPDATE`,
        [id, user.id]
      );
      if (doc.rowCount === 0) throw new Error("NOT_FOUND");
      if (doc.rows[0].status === "canceled") throw new Error("DOC_CANCELED");

      await client.query(
        `INSERT INTO charge_document_payments (id, user_id, document_id, amount, paid_at, method, note)
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6)`,
        [user.id, id, amount, paidAt, method ?? null, note ?? null]
      );
      await recomputeChargeStatus(client, id, user.id);
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    if (msg === "NOT_FOUND") return NextResponse.json({ success: false, error_code: "DOCUMENT_NOT_FOUND", message: "תעודה לא נמצאה" }, { status: 404 });
    if (msg === "DOC_CANCELED") return NextResponse.json({ success: false, error_code: "PAYMENT_DOC_CANCELED", message: "לא ניתן לרשום תשלום על תעודה מבוטלת" }, { status: 409 });
    logger.error("POST payment failed:", error);
    return NextResponse.json({ success: false, error_code: "SERVER_ERROR", message: "שגיאה ברישום תשלום" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Write the edit/delete route**

Create `app/api/charge-documents/[id]/payments/[paymentId]/route.ts`:

```typescript
import { createLogger } from "@/lib/logger";
const logger = createLogger("api:charge-documents:id:payments:paymentId");
import { NextRequest, NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { getUser } from "@/lib/auth";
import { parseBody } from "@/lib/api-validation";
import { updatePaymentSchema } from "@/lib/schemas/charge-documents";
import { recomputeChargeStatus } from "@/lib/charge-documents-server";

type Ctx = { params: Promise<{ id: string; paymentId: string }> };

/** PATCH — edit a payment (ownership: payment belongs to the user's doc). */
export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ success: false, error_code: "UNAUTHORIZED", message: "לא מחובר" }, { status: 401 });
    const { id, paymentId } = await ctx.params;
    const parsed = await parseBody(request, updatePaymentSchema);
    if (!parsed.ok) return parsed.response;
    const { amount, paidAt, method, note } = parsed.data;
    const { withTransaction } = await import("@/lib/db");

    await withTransaction(async (client: PoolClient) => {
      // Lock the parent doc; verify the payment belongs to this doc + user.
      const doc = await client.query(
        `SELECT id FROM charge_documents WHERE id = $1 AND user_id = $2 FOR UPDATE`,
        [id, user.id]
      );
      if (doc.rowCount === 0) throw new Error("NOT_FOUND");
      const pay = await client.query(
        `SELECT id FROM charge_document_payments WHERE id = $1 AND document_id = $2 AND user_id = $3`,
        [paymentId, id, user.id]
      );
      if (pay.rowCount === 0) throw new Error("PAYMENT_NOT_FOUND");

      await client.query(
        `UPDATE charge_document_payments
            SET amount  = COALESCE($1, amount),
                paid_at = COALESCE($2, paid_at),
                method  = $3,
                note    = $4,
                updated_at = NOW()
          WHERE id = $5 AND document_id = $6 AND user_id = $7`,
        [
          amount ?? null,
          paidAt ?? null,
          method === undefined ? null : method,
          note === undefined ? null : note,
          paymentId, id, user.id,
        ]
      );
      await recomputeChargeStatus(client, id, user.id);
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    if (msg === "NOT_FOUND") return NextResponse.json({ success: false, error_code: "DOCUMENT_NOT_FOUND", message: "תעודה לא נמצאה" }, { status: 404 });
    if (msg === "PAYMENT_NOT_FOUND") return NextResponse.json({ success: false, error_code: "PAYMENT_NOT_FOUND", message: "תשלום לא נמצא" }, { status: 404 });
    logger.error("PATCH payment failed:", error);
    return NextResponse.json({ success: false, error_code: "SERVER_ERROR", message: "שגיאה בעדכון תשלום" }, { status: 500 });
  }
}

/** DELETE — remove a payment, then recompute status. */
export async function DELETE(_request: NextRequest, ctx: Ctx) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ success: false, error_code: "UNAUTHORIZED", message: "לא מחובר" }, { status: 401 });
    const { id, paymentId } = await ctx.params;
    const { withTransaction } = await import("@/lib/db");

    await withTransaction(async (client: PoolClient) => {
      const doc = await client.query(
        `SELECT id FROM charge_documents WHERE id = $1 AND user_id = $2 FOR UPDATE`,
        [id, user.id]
      );
      if (doc.rowCount === 0) throw new Error("NOT_FOUND");
      const del = await client.query(
        `DELETE FROM charge_document_payments WHERE id = $1 AND document_id = $2 AND user_id = $3 RETURNING id`,
        [paymentId, id, user.id]
      );
      if (del.rowCount === 0) throw new Error("PAYMENT_NOT_FOUND");
      await recomputeChargeStatus(client, id, user.id);
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    if (msg === "NOT_FOUND") return NextResponse.json({ success: false, error_code: "DOCUMENT_NOT_FOUND", message: "תעודה לא נמצאה" }, { status: 404 });
    if (msg === "PAYMENT_NOT_FOUND") return NextResponse.json({ success: false, error_code: "PAYMENT_NOT_FOUND", message: "תשלום לא נמצא" }, { status: 404 });
    logger.error("DELETE payment failed:", error);
    return NextResponse.json({ success: false, error_code: "SERVER_ERROR", message: "שגיאה במחיקת תשלום" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Typecheck + build the routes**

Run: `npx tsc --noEmit && npm run lint`
Expected: no type/lint errors.

- [ ] **Step 5: Manual DEV verification (dev server running)**

With a real authed session, against a `pending` document `<DOC_ID>` whose gross is `1180`:
1. `POST /api/charge-documents/<DOC_ID>/payments` body `{"amount":600,"paidAt":"2026-06-21","method":"bit"}` → `{success:true}`.
2. `GET /api/charge-documents/<DOC_ID>/payments` → `outstanding:580`, `status:"partial"`, one payment row.
3. POST another `{"amount":580,"paidAt":"2026-06-21"}` → GET shows `status:"paid"`, `outstanding:0`.
4. `DELETE .../payments/<paymentId>` (the 580 one) → GET shows `status:"partial"`, `outstanding:580`.
5. Confirm `charge_documents.status`/`paid_at` updated: `psql "$DATABASE_URL_ADMIN" -c "SELECT status, paid_at FROM charge_documents WHERE id='<DOC_ID>';"`.
6. **Cross-tenant check:** as a *different* user, `DELETE .../payments/<paymentId>` of the first user's payment → 404 (never acts).

- [ ] **Step 6: Commit**

```bash
git add lib/charge-documents-server.ts "app/api/charge-documents/[id]/payments"
git commit -m "feat(payments): payments journal routes + transactional status recompute"
```

---

### Task 5: Document PATCH (discount + pending|partial) · cancel guard · remove pay/unpay

**Files:**
- Modify: `app/api/charge-documents/[id]/route.ts` (PATCH: allow `pending`/`partial`, accept `discount`, recompute status)
- Modify: `app/api/charge-documents/[id]/cancel/route.ts` (zero-payments guard)
- Delete: `app/api/charge-documents/[id]/pay/route.ts`, `app/api/charge-documents/[id]/unpay/route.ts`

**Interfaces:**
- Consumes: `recomputeChargeStatus` (Task 4); extended `patchChargeDocumentSchema` (Task 3).

- [ ] **Step 1: Allow editing while pending OR partial, and apply discount**

In `app/api/charge-documents/[id]/route.ts` PATCH:

1. Add the import: `import { recomputeChargeStatus } from "@/lib/charge-documents-server";`
2. Destructure `discount` from `parsed.data`: change `const { notes, editLine, removeLineId, addTimeEntryId, summaryMode } = parsed.data;` to also include `discount`.
3. Change the lock/guard so partial docs are editable. Replace:

```typescript
      if (doc.rows[0].status !== "pending") throw new Error("LOCKED");
```

with:

```typescript
      const docStatus: string = doc.rows[0].status;
      if (docStatus !== "pending" && docStatus !== "partial") throw new Error("LOCKED");
```

4. Apply the discount inside the transaction (after the `summaryMode` block, before recomputing the line total):

```typescript
      if (typeof discount !== "undefined") {
        await client.query(
          `UPDATE charge_documents SET discount_type = $1, discount_value = $2, updated_at = NOW()
            WHERE id = $3 AND user_id = $4`,
          [discount?.type ?? null, discount?.value ?? null, id, user.id]
        );
      }
```

5. After the existing line-total recompute+UPDATE (the `total` UPDATE near the end of the transaction), recompute the derived status so a discount/line change on a `partial` doc re-derives correctly:

```typescript
      await recomputeChargeStatus(client, id, user.id);
```

(The `LOCKED` error message already reads "התעודה נעולה — בטל תשלום כדי לערוך" — keep it; a fully-`paid` or `canceled` doc is the only locked case now.)

- [ ] **Step 2: Add the zero-payments cancel guard**

In `app/api/charge-documents/[id]/cancel/route.ts`, inside the transaction after the `BAD_STATE` check, before freeing entries:

```typescript
      const pay = await client.query(
        `SELECT 1 FROM charge_document_payments WHERE document_id = $1 AND user_id = $2 LIMIT 1`,
        [id, user.id]
      );
      if (pay.rowCount && pay.rowCount > 0) throw new Error("HAS_PAYMENTS");
```

And add the error mapping in the `catch`:

```typescript
    if (msg === "HAS_PAYMENTS") return NextResponse.json({ success: false, error_code: "CANCEL_HAS_PAYMENTS", message: "לא ניתן לבטל תעודה עם תשלומים רשומים — מחק קודם את התשלומים" }, { status: 409 });
```

Note: the existing `BAD_STATE` guard requires status `pending`. A `partial` doc has payments, so it is blocked twice over — fine. (Leave `BAD_STATE` as-is.)

- [ ] **Step 3: Remove the obsolete pay/unpay routes**

```bash
git rm "app/api/charge-documents/[id]/pay/route.ts" "app/api/charge-documents/[id]/unpay/route.ts"
```

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors. (Any remaining references to the deleted routes are handled in Task 7.)

- [ ] **Step 5: Manual DEV verification**

1. PATCH a `pending` doc with `{"discount":{"type":"percent","value":10}}` → 200; GET the doc shows `discount_type:"percent"`, `discount_value:10`.
2. Record a partial payment, then PATCH the same doc's `discount` to `null` → 200 (allowed while `partial`), status recomputed.
3. POST a payment that fully pays it, then PATCH `discount` → 409 `DOCUMENT_LOCKED`.
4. `POST .../cancel` on a doc with a payment → 409 `CANCEL_HAS_PAYMENTS`.

- [ ] **Step 6: Commit**

```bash
git add "app/api/charge-documents/[id]/route.ts" "app/api/charge-documents/[id]/cancel/route.ts"
git commit -m "feat(payments): discount on PATCH (pending|partial), cancel guard, drop pay/unpay"
```

---

### Task 6: List endpoint gross + outstanding · DocumentsTab partial badge

**Files:**
- Modify: `app/api/charge-documents/route.ts` (GET list — add gross + outstanding per row)
- Modify: `app/[locale]/(auth)/reports/statusMeta.ts` (add `partial`)
- Modify: `app/[locale]/(auth)/reports/DocumentsTab.tsx` (show gross, partial badge, outstanding)

**Interfaces:**
- Consumes: `documentMoney`, `outstanding` (Task 1).
- Produces: each list row gains `gross: number` and `outstanding: number`.

- [ ] **Step 1: Extend the list query + compute gross/outstanding**

In `app/api/charge-documents/route.ts` GET:

1. Import: `import { documentMoney, outstanding } from "@/lib/charge-documents";`
2. Extend the `SELECT` to include discount + vat + a payments sum subquery. Replace the existing select column list so it reads:

```typescript
      `SELECT d.id, d.doc_number, d.status, d.currency, d.total, d.issued_at, d.paid_at,
              d.vat_rate_snapshot, d.discount_type, d.discount_value,
              COALESCE((SELECT SUM(amount) FROM charge_document_payments p
                         WHERE p.document_id = d.id AND p.user_id = d.user_id), 0) AS paid_sum
         FROM charge_documents d
        ${where}
        ORDER BY d.doc_number DESC`,
```

(Keep the rest of the existing query/params; `where` and the `clientId`/`status` params are unchanged.)

3. Map rows to add `gross` + `outstanding` before returning:

```typescript
    const data = rows.rows.map((r) => {
      const row = r as {
        total: number | null; discount_type: "percent" | "amount" | null;
        discount_value: number | null; vat_rate_snapshot: number | null; paid_sum: number;
      };
      const { gross } = documentMoney({
        total: row.total ?? 0,
        discountType: row.discount_type,
        discountValue: row.discount_value,
        vatRate: row.vat_rate_snapshot,
      });
      return { ...r, gross, outstanding: outstanding(gross, Number(row.paid_sum)) };
    });
    return NextResponse.json({ success: true, data });
```

- [ ] **Step 2: Add `partial` to the status metadata**

In `app/[locale]/(auth)/reports/statusMeta.ts`:

```typescript
export type ChargeDocStatus = "pending" | "partial" | "paid" | "canceled";
```

Add a `partial` entry to `STATUS_META` (amber/primary tone, distinct from paid green):

```typescript
  partial: {
    labelKey: "status.partial",
    badge: "bg-warning/15 text-warning border-warning/30",
    accent: "border-s-warning",
  },
```

If `warning` is not a defined token in `globals.css`, use the primary tone instead:

```typescript
  partial: {
    labelKey: "status.partial",
    badge: "bg-primary/15 text-primary border-primary/30",
    accent: "border-s-primary",
  },
```

(Check `app/globals.css` `@theme` for a `--color-warning`; prefer `warning` if present, else `primary`.)

- [ ] **Step 3: Show gross + outstanding in the list row**

In `app/[locale]/(auth)/reports/DocumentsTab.tsx`:

1. Add `gross: number;` and `outstanding: number;` to the `DocumentRow` interface.
2. Add `partial` to the `STATUS_ORDER` map used for sorting (place it right after `pending`, e.g. `pending: 0, partial: 1, paid: 2, canceled: 3` — match the existing object's numbering).
3. Change the amount cell to show **gross** and, when partial, the outstanding underneath. Replace `{formatCurrency(d.total, d.currency, locale)}` with:

```tsx
            <div className="text-end">
              <div className="font-mono tabular-nums">{formatCurrency(d.gross, d.currency, locale)}</div>
              {d.status === "partial" && (
                <div className="text-xs text-muted-foreground">
                  {t("doc.outstandingShort", { amount: formatCurrency(d.outstanding, d.currency, locale) })}
                </div>
              )}
            </div>
```

(Use the `Reports` translator already in the file; if the amount cell isn't wrapped in a translator scope, reuse the existing `t`/`formatCurrency` already imported in this component.)

- [ ] **Step 4: Add i18n keys (he + en)**

In `messages/he.json` under `Reports.status` add `"partial": "שולם חלקית"`; under `Reports.doc` add `"outstandingShort": "נותר {amount}"`.
In `messages/en.json` under `Reports.status` add `"partial": "Partially paid"`; under `Reports.doc` add `"outstandingShort": "{amount} left"`.

- [ ] **Step 5: Typecheck, lint, i18n parity**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: all green (i18n parity test passes with the new keys in both files).

- [ ] **Step 6: Commit**

```bash
git add "app/api/charge-documents/route.ts" "app/[locale]/(auth)/reports/statusMeta.ts" "app/[locale]/(auth)/reports/DocumentsTab.tsx" messages/he.json messages/en.json
git commit -m "feat(payments): list shows gross + outstanding + partial badge"
```

---

### Task 7: Payments panel component + wire into ChargeDocumentView

**Files:**
- Create: `app/[locale]/(auth)/reports/ChargePaymentsPanel.tsx`
- Modify: `app/[locale]/(auth)/reports/ChargeDocumentView.tsx` (embed panel; remove pay/unpay buttons; discount editor; gross total via `documentMoney`)

**Interfaces:**
- Consumes: `documentMoney`, `outstanding`, `PAYMENT_METHODS`, `type PaymentMethod` (Task 1); the payments routes (Task 4); `formatCurrency` from `lib/currency`.
- Produces: `ChargePaymentsPanel` props `{ documentId: string; currency: string; locale: "he" | "en"; onChanged: () => void }`.

- [ ] **Step 1: Build the payments panel (four states)**

Create `app/[locale]/(auth)/reports/ChargePaymentsPanel.tsx`. It fetches `GET /api/charge-documents/[id]/payments`, shows outstanding, an add-payment form, and an editable/deletable list. Use design tokens only; reuse `Button`, toast helpers, and the confirm-dialog pattern already used in `ChargeDocumentView`.

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/currency";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/charge-documents";
import { showSuccessToast, showErrorToast } from "@/lib/toast";

interface PaymentRow {
  id: string;
  amount: number;
  paid_at: string;
  method: PaymentMethod | null;
  note: string | null;
}
interface Summary {
  payments: PaymentRow[];
  gross: number;
  paidSum: number;
  outstanding: number;
  status: "pending" | "partial" | "paid";
}
type State = "loading" | "ready" | "error";

interface Props {
  documentId: string;
  currency: string;
  locale: "he" | "en";
  /** Notify the parent so it refetches the document (status may have changed). */
  onChanged: () => void;
}

export function ChargePaymentsPanel({ documentId, currency, locale, onChanged }: Props) {
  const t = useTranslations("Reports");
  const [state, setState] = useState<State>("loading");
  const [data, setData] = useState<Summary | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const refetch = useCallback(() => setReloadKey((k) => k + 1), []);

  // Add-form state
  const today = new Date().toISOString().slice(0, 10);
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(today);
  const [method, setMethod] = useState<PaymentMethod | "">("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      setState("loading");
      try {
        const res = await fetch(`/api/charge-documents/${documentId}/payments`);
        const json = await res.json();
        if (!active) return;
        if (!res.ok || !json.success) { setState("error"); return; }
        setData(json.data as Summary);
        setState("ready");
      } catch {
        if (active) setState("error");
      }
    })();
    return () => { active = false; };
  }, [documentId, reloadKey]);

  const addPayment = useCallback(
    async (overrideAmount?: number) => {
      const amt = overrideAmount ?? Number(amount);
      if (!Number.isFinite(amt) || amt <= 0) { showErrorToast(t("payments.invalidAmount")); return; }
      setBusy(true);
      try {
        const res = await fetch(`/api/charge-documents/${documentId}/payments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: amt, paidAt, method: method || null, note: note || null }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) { showErrorToast(json.message || t("payments.saveFailed")); return; }
        showSuccessToast(t("payments.saved"));
        setAmount(""); setNote(""); setMethod("");
        refetch(); onChanged();
      } catch {
        showErrorToast(t("payments.saveFailed"));
      } finally {
        setBusy(false);
      }
    },
    [amount, paidAt, method, note, documentId, refetch, onChanged, t]
  );

  const deletePayment = useCallback(
    async (paymentId: string) => {
      setBusy(true);
      try {
        const res = await fetch(`/api/charge-documents/${documentId}/payments/${paymentId}`, { method: "DELETE" });
        const json = await res.json();
        if (!res.ok || !json.success) { showErrorToast(json.message || t("payments.deleteFailed")); return; }
        showSuccessToast(t("payments.deleted"));
        refetch(); onChanged();
      } catch {
        showErrorToast(t("payments.deleteFailed"));
      } finally {
        setBusy(false);
      }
    },
    [documentId, refetch, onChanged, t]
  );

  if (state === "loading") {
    return (
      <div className="rounded-[var(--radius-card)] border border-border bg-card p-4">
        <div className="h-5 w-32 animate-pulse rounded bg-muted" />
      </div>
    );
  }
  if (state === "error" || !data) {
    return (
      <div className="rounded-[var(--radius-card)] border border-border bg-card p-4">
        <p className="text-sm text-destructive">{t("payments.loadError")}</p>
        <Button variant="outline" onClick={refetch} className="mt-2 min-h-[44px]">{t("actions.retry")}</Button>
      </div>
    );
  }

  const methodLabel = (m: PaymentMethod | null) => (m ? t(`payments.method.${m}`) : "—");

  return (
    <div className="space-y-4 rounded-[var(--radius-card)] border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">{t("payments.title")}</h3>
        <div className="text-end">
          <div className="text-xs text-muted-foreground">{t("payments.outstanding")}</div>
          <div className="font-mono text-lg font-bold tabular-nums text-foreground">
            {formatCurrency(data.outstanding, currency, locale)}
          </div>
        </div>
      </div>

      {/* one-click full payment */}
      {data.outstanding > 0 && (
        <Button onClick={() => void addPayment(data.outstanding)} disabled={busy} className="min-h-[44px]">
          {t("payments.markFullyPaid")}
        </Button>
      )}

      {/* add-payment form */}
      <div className="grid grid-cols-2 gap-2">
        <input
          inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)}
          placeholder={t("payments.amount")} aria-label={t("payments.amount")}
          className="rounded-[var(--radius)] border border-border bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <input
          type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} aria-label={t("payments.date")}
          className="rounded-[var(--radius)] border border-border bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <select
          value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod | "")} aria-label={t("payments.methodLabel")}
          className="rounded-[var(--radius)] border border-border bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">{t("payments.methodNone")}</option>
          {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{t(`payments.method.${m}`)}</option>)}
        </select>
        <input
          value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("payments.note")} aria-label={t("payments.note")}
          className="rounded-[var(--radius)] border border-border bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <Button variant="outline" onClick={() => void addPayment()} disabled={busy} className="min-h-[44px]">
        {t("payments.add")}
      </Button>

      {/* list (empty state) */}
      {data.payments.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("payments.empty")}</p>
      ) : (
        <ul className="divide-y divide-border">
          {data.payments.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <span className="font-mono tabular-nums text-foreground">{formatCurrency(p.amount, currency, locale)}</span>
                <span className="ms-2 text-xs text-muted-foreground">
                  {new Date(p.paid_at).toLocaleDateString(locale === "he" ? "he-IL" : "en-US")} · {methodLabel(p.method)}
                  {p.note ? ` · ${p.note}` : ""}
                </span>
              </div>
              <Button
                variant="ghost" disabled={busy} onClick={() => void deletePayment(p.id)}
                className="min-h-[44px] text-destructive hover:text-destructive"
              >
                {t("actions.delete")}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

**Inline edit (required — decision 3 says rows are editable):** add edit support to the panel so the PATCH endpoint (Task 4) has a UI caller:
- Add state `const [editingId, setEditingId] = useState<string | null>(null);`.
- Add an `editPayment(p: PaymentRow)` handler that sets `editingId = p.id` and pre-fills the form fields (`setAmount(String(p.amount)); setPaidAt(p.paid_at.slice(0,10)); setMethod(p.method ?? ""); setNote(p.note ?? "");`).
- When `editingId` is set, the form's primary button reads `t("payments.saveEdit")` and calls a `saveEdit()` that `PATCH`es `/api/charge-documents/${documentId}/payments/${editingId}` with `{ amount: Number(amount), paidAt, method: method || null, note: note || null }`, then on success clears `editingId`, resets the form, `refetch()` + `onChanged()`. Show a "cancel edit" ghost button that clears `editingId` and the form. (Add `t("payments.saveEdit")` and `t("payments.cancelEdit")` to both catalogs in Step 3.)
- Each row in the list gets an "edit" ghost button (`t("actions.edit")`) next to "delete" that calls `editPayment(p)`.

> Note: confirm the import paths for `showSuccessToast`/`showErrorToast` match what `ChargeDocumentView.tsx` already imports (copy that exact import line). Same for `Button`.

- [ ] **Step 2: Wire the panel into ChargeDocumentView; remove pay/unpay buttons**

In `app/[locale]/(auth)/reports/ChargeDocumentView.tsx`:

1. Import the panel and money helper:

```typescript
import { ChargePaymentsPanel } from "./ChargePaymentsPanel";
import { documentMoney } from "@/lib/charge-documents";
```

2. Replace the VAT-only total computation. Change:

```typescript
  const vat = computeVatBreakdown(doc.total, doc.vat_rate_snapshot);
  const hasVat = doc.vat_rate_snapshot != null && doc.vat_rate_snapshot > 0;
```

to:

```typescript
  const money = documentMoney({
    total: doc.total,
    discountType: (doc.discount_type as "percent" | "amount" | null) ?? null,
    discountValue: doc.discount_value ?? null,
    vatRate: doc.vat_rate_snapshot,
  });
  const hasVat = doc.vat_rate_snapshot != null && doc.vat_rate_snapshot > 0;
  const hasDiscount = money.discountAmount > 0;
```

3. Add `discount_type`/`discount_value` to the local document type/interface used in this file (search for where `vat_rate_snapshot` is declared in the component's `Doc`/`DocumentDetail` interface and add `discount_type: string | null; discount_value: number | null;`).

4. Update the header total and the totals table to use `money`:
   - header: `{formatCurrency(money.gross, doc.currency, locale)}` (was `vat.total`).
   - totals table: `subtotal` → `money.netSubtotal`; add a discount row when `hasDiscount`; VAT row → `money.vatAmount`; total → `money.gross`. Insert this discount `<tr>` between the subtotal row and the VAT row:

```tsx
              {hasDiscount && (
                <tr>
                  <td className="px-3 py-1 text-end text-muted-foreground">{t("doc.discount")}</td>
                  <td className="px-3 py-1 text-start font-mono tabular-nums text-foreground">
                    −{formatCurrency(money.discountAmount, doc.currency, locale)}
                  </td>
                </tr>
              )}
```

   (Replace the remaining `vat.subtotal`/`vat.vatAmount`/`vat.total` references in this component with `money.netSubtotal`/`money.vatAmount`/`money.gross`.)

5. **Remove** the `isPaid`/pay/unpay buttons block and the "mark paid" button block (the `{isPending && (<>…markPaidAction…cancel…</>)}` markPaid button and the `{isPaid && (…unpayAction…)}` block). Keep the **cancel** button but show it only when there are no payments — simplest correct gate: keep it inside `{isPending && (…)}` (a `pending` doc by definition has no payments). Remove the now-unused `postAction("pay"…)`/`postAction("unpay"…)` calls. The cancel button keeps using `postAction("cancel", …)`.

6. Render the payments panel for any non-canceled document (replace the removed pay/unpay UI). Place it near the totals block:

```tsx
      {!isCanceled && (
        <ChargePaymentsPanel
          documentId={documentId}
          currency={doc.currency}
          locale={locale}
          onChanged={() => { refetch(); onChanged?.(); }}
        />
      )}
```

7. Add the discount editor (pending|partial only). Near the summary-mode control, add a small control that PATCHes `{ discount: { type, value } | null }` via the existing `patchDocument` helper. Minimal version:

```tsx
      {(isPending || doc.status === "partial") && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">{t("doc.discountLabel")}</span>
          <select
            aria-label={t("doc.discountType")}
            value={doc.discount_type ?? ""}
            onChange={(e) => {
              const type = e.target.value as "percent" | "amount" | "";
              if (!type) void patchDocument({ discount: null });
              else void patchDocument({ discount: { type, value: doc.discount_value ?? 0 } });
            }}
            className="rounded-[var(--radius)] border border-border bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">{t("doc.discountNone")}</option>
            <option value="percent">{t("doc.discountPercent")}</option>
            <option value="amount">{t("doc.discountAmount")}</option>
          </select>
          {doc.discount_type && (
            <input
              inputMode="decimal" defaultValue={doc.discount_value ?? 0}
              aria-label={t("doc.discountValue")}
              onBlur={(e) => void patchDocument({ discount: { type: doc.discount_type as "percent" | "amount", value: Number(e.target.value) || 0 } })}
              className="w-24 rounded-[var(--radius)] border border-border bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          )}
        </div>
      )}
```

   (Confirm `patchDocument` accepts an arbitrary body object and posts it as JSON to `PATCH /api/charge-documents/[id]`; it already handles `{ removeLineId }`, `{ summaryMode }`, etc. — `{ discount }` is the same shape.)

8. Remove the now-unused `computeVatBreakdown` import if nothing else uses it in this file.

- [ ] **Step 3: Add i18n keys (he + en)**

Add under `Reports.doc`: `discount`, `discountLabel`, `discountType`, `discountValue`, `discountNone`, `discountPercent`, `discountAmount`.
Add a new `Reports.payments` block: `title`, `outstanding`, `markFullyPaid`, `amount`, `date`, `methodLabel`, `methodNone`, `note`, `add`, `saved`, `saveFailed`, `deleted`, `deleteFailed`, `loadError`, `invalidAmount`, `empty`, and `method.{bank_transfer,bit,cash,check,credit,other}`. Also `actions.retry` and `actions.delete` if not already present.

Hebrew values (examples): `payments.title`="תשלומים", `outstanding`="נותר לתשלום", `markFullyPaid`="סמן כשולם במלואו", `amount`="סכום", `date`="תאריך", `methodLabel`="אמצעי תשלום", `methodNone`="ללא", `note`="הערה", `add`="הוסף תשלום", `saveEdit`="שמור שינוי", `cancelEdit`="ביטול", `empty`="טרם נרשמו תשלומים", `method.bank_transfer`="העברה בנקאית", `method.bit`="ביט", `method.cash`="מזומן", `method.check`="צ׳ק", `method.credit`="כרטיס אשראי", `method.other`="אחר". `doc.discount`="הנחה", `doc.discountLabel`="הנחה", `doc.discountNone`="ללא הנחה", `doc.discountPercent`="אחוז", `doc.discountAmount`="סכום". Also ensure `actions.edit`="עריכה", `actions.delete`="מחיקה", `actions.retry`="נסה שוב" exist (reuse if already present).
English values mirror these (e.g. `method.bit`="Bit", `discount`="Discount", `saveEdit`="Save change", `cancelEdit`="Cancel", etc.). Add to BOTH files with identical keys.

- [ ] **Step 4: Typecheck, lint, i18n parity, build**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: green. (No references to deleted `pay`/`unpay` routes remain.)

- [ ] **Step 5: Manual DEV verification (browser, authed)**

Open a `pending` document:
1. Set a 10% discount → header total + totals table reflect the discounted gross; a "הנחה" row appears.
2. Add a partial payment → outstanding drops, status badge becomes "שולם חלקית", panel lists it.
3. One-click "סמן כשולם במלואו" → outstanding 0, status "שולם".
4. Delete a payment → status reverts. Edit a payment (change amount) → status + outstanding recompute.
5. Confirm RTL layout, four states (load/empty/error/success), tap targets ≥44px, tokens only.

- [ ] **Step 6: Commit**

```bash
git add "app/[locale]/(auth)/reports/ChargePaymentsPanel.tsx" "app/[locale]/(auth)/reports/ChargeDocumentView.tsx" messages/he.json messages/en.json
git commit -m "feat(payments): document payments panel + discount editor + gross totals"
```

---

### Task 8: PDF templates — discount line in the totals block

**Files:**
- Modify: `app/[locale]/(auth)/reports/PdfChargeDocument.tsx`

**Interfaces:**
- Consumes: `documentMoney` (Task 1).
- Produces: PDF totals show subtotal → −discount → discounted net → +VAT → gross across all 6 templates.

- [ ] **Step 1: Extend the PDF doc interface + compute money**

In `PdfChargeDocument.tsx`:

1. Add to the `PdfChargeDocument` interface (next to `vat_rate_snapshot`):

```typescript
  /** Document-level discount snapshot. */
  discount_type: "percent" | "amount" | null;
  discount_value: number | null;
```

2. Replace:

```typescript
  const vat = computeVatBreakdown(doc.total, doc.vat_rate_snapshot);
  const hasVat = doc.vat_rate_snapshot != null && doc.vat_rate_snapshot > 0;
```

with:

```typescript
  const money = documentMoney({
    total: doc.total,
    discountType: doc.discount_type,
    discountValue: doc.discount_value,
    vatRate: doc.vat_rate_snapshot,
  });
  const hasVat = doc.vat_rate_snapshot != null && doc.vat_rate_snapshot > 0;
  const hasDiscount = money.discountAmount > 0;
```

and add the import `import { documentMoney } from "@/lib/charge-documents";` (keep `computeVatBreakdown` import only if still used elsewhere — remove if not).

- [ ] **Step 2: Render the discount row in the totals block**

In the totals `<tbody>` (the block around the subtotal/VAT/grand rows), use `money.*`:
- subtotal row value → `money.netSubtotal`
- insert (when `hasDiscount`) a discount row right after subtotal:

```tsx
                {hasDiscount && (
                  <tr className="pdf-totals-row">
                    <td className="pdf-totals-label" style={{ fontSize: "12px" }}>{t("doc.discount")}</td>
                    <td className="pdf-totals-value" style={{ fontSize: "12px" }}>−{formatCurrency(money.discountAmount, doc.currency)}</td>
                  </tr>
                )}
```

- VAT row value → `money.vatAmount` (keep the existing `{hasVat && …}` guard; the VAT label already uses `doc.vat_rate_snapshot`).
- grand-total row value → `money.gross` (was `vat.total`).

This single shared totals block feeds all 6 templates (`modern/classic/bold/elegant/nature/ocean`) via `templateRules()`, so no per-template edits are needed.

- [ ] **Step 3: Verify the WYSIWYG settings preview stays in sync**

The settings template preview renders the same `PdfChargeDocument`/totals component. Confirm it compiles and shows the discount row when a preview doc carries a discount (or that the preview's sample doc simply passes `discount_type: null` — no crash). No separate code path to change if it reuses the component.

- [ ] **Step 4: Typecheck, lint, build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: green.

- [ ] **Step 5: Manual DEV verification**

Print/preview a discounted doc in **each** of the 6 templates (he and en):
- discount row appears, math is subtotal − discount + VAT = gross.
- internal print padding intact (banner not clipped), RTL/LTR correct per document language.

- [ ] **Step 6: Commit**

```bash
git add "app/[locale]/(auth)/reports/PdfChargeDocument.tsx"
git commit -m "feat(payments): discount line in PDF totals across all 6 templates"
```

---

### Task 9: Public `/doc/[token]` — discount + payment summary

**Files:**
- Modify: `app/[locale]/doc/[token]/page.tsx` (load discount fields + payments aggregate)
- Modify: `app/[locale]/doc/[token]/PublicChargeDocument.tsx` (pass discount to PDF; render payment summary)

**Interfaces:**
- Consumes: `documentMoney`, `outstanding` (Task 1).
- Produces: public page shows discount in totals always; "שולם X מתוך Y · נותר Z" only when a payment exists.

- [ ] **Step 1: Load discount + payments aggregate in the loader**

In `page.tsx` `loadByToken`:

1. Add `d.discount_type, d.discount_value` to the document `SELECT`.
2. After loading `d`, fetch the payments aggregate (token-scoped via the doc id):

```typescript
  const payRes = await adminQuery(
    `SELECT COALESCE(SUM(amount), 0) AS paid_sum
       FROM charge_document_payments
      WHERE document_id = (SELECT id FROM charge_documents WHERE public_token = $1)`,
    [token]
  );
  const paidSum = Number(payRes.rows[0]?.paid_sum ?? 0);
```

3. Add `discount_type`/`discount_value` to the `doc` object built for `PdfDoc` (extend the `PdfDoc`/`PdfChargeDocument` shape — already extended in Task 8):

```typescript
    discount_type: (d.discount_type as "percent" | "amount" | null) ?? null,
    discount_value: (d.discount_value as number | null) ?? null,
```

4. Add `paidSum` to `LoadResult` and return it.

- [ ] **Step 2: Render the payment summary (only when paid > 0)**

In `PublicChargeDocument.tsx`:

1. Accept `paidSum: number` in props.
2. Compute gross via `documentMoney({ total: doc.total, discountType: doc.discount_type, discountValue: doc.discount_value, vatRate: doc.vat_rate_snapshot })` and `outstanding(gross, paidSum)`.
3. When `paidSum > 0`, render a summary block (tokens / print-safe styling consistent with the page) showing paid / gross / outstanding, using the public-page translator + locale-bound `formatCurrency`. Do **not** render any per-payment detail, method, or note.

```tsx
{paidSum > 0 && (
  <div className="...summary block styles...">
    {t("publicDoc.paymentSummary", {
      paid: formatCurrency(paidSum, doc.currency),
      total: formatCurrency(gross, doc.currency),
      outstanding: formatCurrency(outstanding(gross, paidSum), doc.currency),
    })}
  </div>
)}
```

(Reuse the closure-safe formatter pattern already in this subtree — re-create `formatCurrency` against the document locale here, do not receive it from the parent.)

- [ ] **Step 3: Add i18n keys (he + en)**

Add `publicDoc.paymentSummary` to both catalogs.
He: `"שולם {paid} מתוך {total} · נותר לתשלום {outstanding}"`.
En: `"Paid {paid} of {total} · {outstanding} remaining"`.
(Use the namespace the public page already uses — match the existing `t(...)` namespace in `PublicChargeDocument.tsx`.)

- [ ] **Step 4: Typecheck, lint, build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: green.

- [ ] **Step 5: Manual DEV verification**

1. Open a sent doc's public `/doc/<token>` with **no** payments → totals show discount (if any), **no** payment summary.
2. Record a partial payment, reload the public link → summary "שולם … מתוך … · נותר …" appears; no methods/notes shown.
3. Cancel-protected: a canceled doc still 404s (unchanged).

- [ ] **Step 6: Commit**

```bash
git add "app/[locale]/doc/[token]/page.tsx" "app/[locale]/doc/[token]/PublicChargeDocument.tsx" messages/he.json messages/en.json
git commit -m "feat(payments): public doc shows discount + payment summary"
```

---

### Task 10: Dashboard "open for collection" section (per-currency)

**Files:**
- Create: `app/api/charge-documents/outstanding/route.ts` (per-currency outstanding totals)
- Create: `components/open-for-collection-card.tsx`
- Modify: `lib/dashboard-widgets.ts` (catalog + default)
- Modify: `app/[locale]/dashboard/page.tsx` (render case)

**Interfaces:**
- Consumes: `documentMoney`, `outstanding` (Task 1); the dashboard widget system.
- Produces: `GET /api/charge-documents/outstanding` → `{ success, data: { totals: { currency, outstanding, amountLabel }[] } }`; a new `openForCollection` section widget.

> Implemented as a `section` (not a single-value stat card) because the total is per-currency, mirroring the proven `settlementsDue` section + `/api/settlements/due` + `settlements-due-card.tsx` pattern.

- [ ] **Step 1: Build the outstanding endpoint**

Create `app/api/charge-documents/outstanding/route.ts`:

```typescript
import { createLogger } from "@/lib/logger";
const logger = createLogger("api:charge-documents:outstanding");
import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { documentMoney, outstanding, type DiscountType } from "@/lib/charge-documents";
import { formatCurrency } from "@/lib/currency";

/**
 * GET /api/charge-documents/outstanding
 * Per-currency sum of outstanding amounts across the caller's non-canceled
 * documents. Powers the dashboard "open for collection" section.
 */
export async function GET(_request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ success: false, error_code: "UNAUTHORIZED", message: "לא מחובר" }, { status: 401 });
    const { query } = await import("@/lib/db");

    const prof = await query<{ locale: string | null }>(
      `SELECT locale FROM user_profiles WHERE user_id = $1`,
      [user.id]
    );
    const locale = prof.rows[0]?.locale === "en" ? "en" : "he";

    const rows = await query<{
      currency: string; total: number | null;
      discount_type: DiscountType | null; discount_value: number | null;
      vat_rate_snapshot: number | null; paid_sum: number;
    }>(
      `SELECT d.currency, d.total, d.discount_type, d.discount_value, d.vat_rate_snapshot,
              COALESCE((SELECT SUM(amount) FROM charge_document_payments p
                         WHERE p.document_id = d.id AND p.user_id = d.user_id), 0) AS paid_sum
         FROM charge_documents d
        WHERE d.user_id = $1 AND d.status <> 'canceled'`,
      [user.id]
    );

    const byCurrency = new Map<string, number>();
    for (const r of rows.rows) {
      const { gross } = documentMoney({
        total: r.total ?? 0, discountType: r.discount_type,
        discountValue: r.discount_value, vatRate: r.vat_rate_snapshot,
      });
      const open = outstanding(gross, Number(r.paid_sum));
      if (open <= 0) continue;
      const cur = r.currency || "ILS";
      byCurrency.set(cur, (byCurrency.get(cur) ?? 0) + open);
    }

    const totals = [...byCurrency.entries()].map(([currency, amount]) => ({
      currency,
      outstanding: amount,
      amountLabel: formatCurrency(amount, currency, locale),
    }));

    return NextResponse.json({ success: true, data: { totals } });
  } catch (error) {
    logger.error("GET outstanding failed:", error);
    return NextResponse.json({ success: false, error_code: "SERVER_ERROR", message: "שגיאה בטעינת פתוח לגבייה" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Register the widget in the catalog + default**

In `lib/dashboard-widgets.ts`:
1. Add to `DASHBOARD_WIDGETS` (in the sections group, next to `settlementsDue`):

```typescript
  { id: "openForCollection", labelKey: "openForCollection.title", kind: "section" },
```

2. Add `"openForCollection"` to the visible sections of `DEFAULT_DASHBOARD_CONFIG` (so it shows by default; it renders null when nothing is outstanding):

```typescript
export const DEFAULT_DASHBOARD_CONFIG: DashboardConfig = buildConfig(
  ["hoursToday", "hoursWeek", "hoursMonth", "revenueToday", "revenueMonth"],
  ["openForCollection", "settlementsDue", "earningsChart", "projectHours", "recentEntries"]
);
```

(Existing users with a stored config get it appended **hidden** automatically by `normalizeDashboardConfig` — they can enable it in the customizer.)

- [ ] **Step 3: Build the section card**

Create `components/open-for-collection-card.tsx` (model on `settlements-due-card.tsx`; renders null when nothing is outstanding):

```tsx
"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/src/i18n/navigation";

interface CurrencyTotal { currency: string; outstanding: number; amountLabel: string; }
type State = "loading" | "ready" | "error";

/** Dashboard section: per-currency total still open for collection. Renders
 *  null when nothing is outstanding so the section wrapper collapses. */
export function OpenForCollectionCard() {
  const t = useTranslations("Dashboard");
  const [state, setState] = useState<State>("loading");
  const [totals, setTotals] = useState<CurrencyTotal[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/charge-documents/outstanding");
        const json = await res.json();
        if (!active) return;
        if (!res.ok || !json.success) { setState("error"); return; }
        setTotals(json.data.totals as CurrencyTotal[]);
        setState("ready");
      } catch {
        if (active) setState("error");
      }
    })();
    return () => { active = false; };
  }, []);

  if (state === "loading") {
    return (
      <div className="bg-card border border-border/50 rounded-[var(--radius-card)] p-6">
        <div className="h-5 w-40 bg-muted rounded animate-pulse mb-4" />
        <div className="h-10 w-32 bg-muted rounded animate-pulse" />
      </div>
    );
  }
  if (state === "error") {
    return (
      <div className="bg-card border border-border/50 rounded-[var(--radius-card)] p-6">
        <h3 className="font-display text-xl font-semibold text-foreground mb-2">{t("openForCollection.title")}</h3>
        <p className="text-sm text-muted-foreground">{t("openForCollection.error")}</p>
      </div>
    );
  }
  if (totals.length === 0) return null;

  return (
    <div className="bg-card border border-border/50 rounded-[var(--radius-card)] p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-xl font-semibold text-foreground">{t("openForCollection.title")}</h3>
        <Link href="/reports" className="text-sm font-medium text-primary hover:underline min-h-[44px] flex items-center">
          {t("openForCollection.viewAll")}
        </Link>
      </div>
      <ul className="space-y-2">
        {totals.map((c) => (
          <li key={c.currency} className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{c.currency}</span>
            <span className="font-mono text-lg font-bold tabular-nums text-foreground">{c.amountLabel}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Render the section in the dashboard**

In `app/[locale]/dashboard/page.tsx`:
1. Import: `import { OpenForCollectionCard } from "@/components/open-for-collection-card";`
2. Add a case to `renderSection`:

```tsx
      case "openForCollection":
        return <OpenForCollectionCard />;
```

3. (Optional) if you want it full-width like `settlementsDue`, add `openForCollection` to the `className` ternary that gives `lg:col-span-2`.

- [ ] **Step 5: Add i18n keys (he + en)**

`Dashboard.openForCollection`: `title`, `viewAll`, `error`.
He: `title`="פתוח לגבייה", `viewAll`="לכל ההתחשבנויות", `error`="שגיאה בטעינת פתוח לגבייה".
En: `title`="Open for collection", `viewAll`="View all", `error`="Failed to load open balances".
Also add `Settings.dashboard` customizer label if the customizer reads `labelKey` from the `Dashboard` namespace (it reads `openForCollection.title` — already covered).

- [ ] **Step 6: Typecheck, lint, build, i18n parity**

Run: `npx tsc --noEmit && npm run lint && npm test && npm run build`
Expected: green.

- [ ] **Step 7: Manual DEV verification**

1. Dashboard shows "פתוח לגבייה" with per-currency totals when docs have outstanding balances.
2. Fully pay everything → section renders null (collapses).
3. Customizer: toggle/reorder the section; verify persistence.

- [ ] **Step 8: Commit**

```bash
git add "app/api/charge-documents/outstanding/route.ts" components/open-for-collection-card.tsx lib/dashboard-widgets.ts "app/[locale]/dashboard/page.tsx" messages/he.json messages/en.json
git commit -m "feat(payments): dashboard open-for-collection section (per-currency)"
```

---

### Task 11: Full verification pass + DEV QA checklist

**Files:** none (verification only)

- [ ] **Step 1: Run the whole gate**

Run: `npx tsc --noEmit && npm run lint && npm test && npm run build`
Expected: all green — zero type errors, zero lint warnings (zero-warning gate), all unit tests pass (incl. i18n parity), build succeeds.

- [ ] **Step 2: End-to-end DEV QA (browser, two users for isolation)**

Walk the full lifecycle on DEV:
1. Create a charge doc (with VAT client + a discount) → totals: subtotal − discount + VAT = gross.
2. Record partial payment → list badge "שולם חלקית" + outstanding; doc panel outstanding; dashboard "פתוח לגבייה" reflects it.
3. Public link before payment: no summary; after: "שולם … מתוך … · נותר …".
4. One-click full payment → "שולם", paid_at set, dashboard total drops.
5. Try to cancel a doc with payments → blocked (Hebrew error). Delete payments → cancel works, entries freed.
6. Edit/delete a payment → status + outstanding recompute everywhere.
7. **Isolation:** as user B, hit user A's `GET/POST/PATCH/DELETE .../payments[/id]` and `/api/charge-documents/outstanding` → only B's data; A's payment ids → 404.
8. RTL + he/en parity + four states on the panel and the dashboard section + ≥44px tap targets + tokens only.

- [ ] **Step 3: Commit any QA fixes, then stop for PROD-migration gate**

Do NOT merge to `main` yet. PROD migration `0033` is a separate, explicitly-approved step (run `drizzle/0033_payments_discounts.sql` against the prod admin connection in `.env.local.bak.prod-shared`) and must be applied **before** the merge that triggers Vercel deploy. Surface this to the user for approval.

---

## Self-Review

**Spec coverage:**
- Decision 1 (one combined spec, single migration) → Task 2 (single migration 0033). ✓
- Decision 2 (payments table + derived status, editable/deletable) → Tasks 2, 4. ✓
- Decision 3 (amount+date+method enum+note) → Tasks 2, 3, 4, 7. ✓
- Decision 4 (reconcile against gross/owed) → Task 1 `documentMoney`/`paymentStatus`, used everywhere. ✓
- Decision 5 (document-level discount, percent/amount, net pre-VAT, editable pending/partial) → Tasks 1, 2, 3, 5, 7, 8. ✓
- Decision 6 (public: discount always, payment summary only when paid) → Task 9. ✓
- Decision 7 (doc panel + list badge + dashboard section) → Tasks 6, 7, 10. ✓
- Decision 8 (block cancel with payments) → Task 5. ✓
- Status model (maintained cache, zero-payments cancel) → Task 4 helper + Task 5. ✓
- Security (BOLA/IDOR, new-table RLS, boundary validation, public read-only aggregate, observability) → Tasks 2, 3, 4, 9 + Global Constraints + Task 11 isolation QA. ✓
- Testing (unit money math + manual QA) → Tasks 1, 3, 11. ✓

**Placeholder scan:** No TBD/TODO; all code steps show real code; error handling is explicit per route; no "similar to Task N" code omissions.

**Type consistency:** `documentMoney`/`applyDiscount`/`paymentStatus`/`outstanding`/`DiscountType`/`PaymentMethod`/`PAYMENT_METHODS` defined in Task 1 and consumed with matching signatures in Tasks 4–10. `recomputeChargeStatus(client, id, userId)` defined in Task 4, consumed in Tasks 4 & 5. Schema names (`createPaymentSchema`, `updatePaymentSchema`, extended `patchChargeDocumentSchema` with `discount`) defined in Task 3, consumed in Tasks 4 & 5. DB columns (`discount_type`, `discount_value`, `charge_document_payments.*`) defined in Task 2, used consistently thereafter.
