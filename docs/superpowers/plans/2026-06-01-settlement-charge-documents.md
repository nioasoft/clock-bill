# Settlement / Internal Charge Documents (התחשבנות) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a billing lifecycle on top of time entries — select a client's unbilled items, issue an internal settlement document (תעודת התחשבנות פנימית), and track it through `pending → paid` with cancel/reopen.

**Architecture:** Two new tables (`charge_documents`, `charge_document_lines`) hold a stable snapshot of each issued document; a nullable `time_entries.charge_document_id` FK marks an entry as billed (NULL = unbilled). Pure computation/transition logic lives in `lib/charge-documents.ts` (unit-tested), API routes under `app/api/charge-documents/` enforce ownership + atomic status changes via `withTransaction`, and the existing "דוחות" screen becomes "התחשבנות" with three tabs.

**Tech Stack:** Next.js 16 App Router, Postgres/Neon, Drizzle (types) + raw `pg` (`lib/db.ts`), Zod, Better Auth, RLS (`current_setting('app.current_user_id')`), custom tsx test runner.

**Spec:** `docs/superpowers/specs/2026-06-01-settlement-charge-documents-design.md`
**Coordinates with:** `docs/superpowers/specs/2026-06-01-ad-hoc-items-design.md` (owns migration `0009`, `item_ref`, `next_item_ref`). This plan uses migration `0011` (0009 and 0010 are already taken) and assumes 0009 is applied first; if not, `item_ref` snapshots are simply `NULL`.

---

## File Structure

**New files**
- `lib/charge-documents.ts` — pure logic: line-snapshot building, total computation, status-transition table. No DB/IO.
- `lib/schemas/charge-documents.ts` — Zod schemas (create, line-edit, status) shared client+server.
- `drizzle/0011_charge_documents.sql` — DDL (2 tables, 2 ALTERs, indexes). Applied via psql.
- `app/api/charge-documents/route.ts` — `GET` list, `POST` create.
- `app/api/charge-documents/billable/route.ts` — `GET` unbilled items + computed charges for a client/month.
- `app/api/charge-documents/[id]/route.ts` — `GET`, `PATCH`, `DELETE`.
- `app/api/charge-documents/[id]/pay/route.ts` — `POST` mark paid.
- `app/api/charge-documents/[id]/unpay/route.ts` — `POST` reopen.
- `app/api/charge-documents/[id]/cancel/route.ts` — `POST` cancel + sweep.
- `app/(auth)/reports/AdHocReportTab.tsx` — today's report, extracted (move).
- `app/(auth)/reports/BillableTab.tsx` — build & issue.
- `app/(auth)/reports/DocumentsTab.tsx` — history list.
- `app/(auth)/reports/ChargeDocumentView.tsx` — single document view + actions + PDF.
- `tests/unit/charge-documents.test.ts` — unit tests for `lib/charge-documents.ts`.
- `tests/unit/charge-documents-schema.test.ts` — unit tests for the Zod schemas.

**Modified files**
- `src/db/schema.ts` — add `chargeDocuments`, `chargeDocumentLines`, `timeEntries.chargeDocumentId`, `userProfiles.nextChargeDocNumber`.
- `drizzle/rls-policies.sql` — add the two tables to the FORCE/policy block + grants.
- `app/(auth)/reports/page.tsx` — tab bar; mount the three tabs; nav rename "דוחות" → "התחשבנות".
- Nav component(s) rendering the "דוחות" label.

---

## Phase 1 — Database foundation

### Task 1: Drizzle schema definitions (types only)

**Files:**
- Modify: `src/db/schema.ts` (append new tables near `reportPresets`; add columns to `timeEntries` and `userProfiles`)

- [ ] **Step 1: Add the two new tables to `src/db/schema.ts`**

Append after the `reportPresets` table definition:

```typescript
// ─── Charge Documents (internal settlement) ─────────────────────────

export const chargeDocuments = pgTable(
  "charge_documents",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "restrict" }),
    docNumber: integer("doc_number").notNull(),
    status: text("status").notNull().default("pending"),
    currency: text("currency").notNull().default("ILS"),
    total: real("total"),
    notes: text("notes"),
    pdfTemplate: text("pdf_template"),
    issuedAt: timestamp("issued_at"),
    paidAt: timestamp("paid_at"),
    canceledAt: timestamp("canceled_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    unique().on(table.userId, table.docNumber),
    index("idx_charge_documents_user_id").on(table.userId),
    index("idx_charge_documents_user_id_client_id").on(table.userId, table.clientId),
    index("idx_charge_documents_user_id_status").on(table.userId, table.status),
    check(
      "charge_documents_status_check",
      sql`${table.status} IN ('pending', 'paid', 'canceled')`
    ),
  ]
);

export const chargeDocumentLines = pgTable(
  "charge_document_lines",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    documentId: text("document_id")
      .notNull()
      .references(() => chargeDocuments.id, { onDelete: "cascade" }),
    sourceType: text("source_type").notNull(),
    timeEntryId: text("time_entry_id").references(() => timeEntries.id, {
      onDelete: "set null",
    }),
    periodMonth: text("period_month"),
    label: text("label").notNull(),
    description: text("description"),
    note: text("note"),
    itemRef: integer("item_ref"),
    billingKind: text("billing_kind"),
    quantity: real("quantity"),
    rate: real("rate"),
    amount: real("amount"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_charge_document_lines_document_id").on(table.documentId),
    index("idx_charge_document_lines_user_id").on(table.userId),
    index("idx_charge_document_lines_time_entry_id").on(table.timeEntryId),
    check(
      "charge_document_lines_source_type_check",
      sql`${table.sourceType} IN ('time_entry', 'fixed_monthly', 'retainer')`
    ),
    check(
      "charge_document_lines_period_month_check",
      sql`${table.periodMonth} IS NULL OR ${table.periodMonth} ~ '^\\d{4}-\\d{2}$'`
    ),
  ]
);
```

- [ ] **Step 2: Add `chargeDocumentId` to the `timeEntries` table**

In the `timeEntries` column object (after `quantity: real("quantity")`), add:

```typescript
    chargeDocumentId: text("charge_document_id"),
```

> Note: declared without `.references()` here to avoid a forward-reference cycle (`chargeDocuments` is defined later in the file and references `timeEntries`). The real FK + `ON DELETE SET NULL` is created in the SQL migration (Task 2). Drizzle only needs the column for typing.

In the `timeEntries` index array, add the partial + plain indexes:

```typescript
    index("idx_time_entries_charge_document_id").on(table.chargeDocumentId),
    index("idx_time_entries_user_unbilled")
      .on(table.userId, table.projectId)
      .where(sql`${table.chargeDocumentId} IS NULL AND ${table.isBillable} = true`),
```

- [ ] **Step 3: Add `nextChargeDocNumber` to `userProfiles`**

In the `userProfiles` column object (near `nextInvoiceNumber`), add:

```typescript
  nextChargeDocNumber: integer("next_charge_doc_number").default(1),
```

- [ ] **Step 4: Type-check**

Run: `npm run build`
Expected: build succeeds (or fails only on unrelated pre-existing issues). The schema must compile with no `chargeDocuments`/`chargeDocumentLines` type errors.

- [ ] **Step 5: Commit**

```bash
git add src/db/schema.ts
git commit -m "feat(db): add charge_documents schema (types) for settlement"
```

---

### Task 2: SQL migration file (DDL)

**Files:**
- Create: `drizzle/0011_charge_documents.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- 0011_charge_documents.sql
-- Internal settlement / charge documents. Apply via psql + DATABASE_URL_ADMIN
-- (db:migrate is broken — drizzle meta drift). Depends on 0009_item_ref.
BEGIN;

CREATE TABLE IF NOT EXISTS charge_documents (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id text NOT NULL,
  client_id text NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  doc_number integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  currency text NOT NULL DEFAULT 'ILS',
  total real,
  notes text,
  pdf_template text,
  issued_at timestamp,
  paid_at timestamp,
  canceled_at timestamp,
  created_at timestamp DEFAULT NOW(),
  updated_at timestamp DEFAULT NOW(),
  CONSTRAINT charge_documents_status_check CHECK (status IN ('pending','paid','canceled')),
  CONSTRAINT charge_documents_user_doc_number_unique UNIQUE (user_id, doc_number)
);
CREATE INDEX IF NOT EXISTS idx_charge_documents_user_id           ON charge_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_charge_documents_user_id_client_id ON charge_documents(user_id, client_id);
CREATE INDEX IF NOT EXISTS idx_charge_documents_user_id_status    ON charge_documents(user_id, status);

CREATE TABLE IF NOT EXISTS charge_document_lines (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id text NOT NULL,
  document_id text NOT NULL REFERENCES charge_documents(id) ON DELETE CASCADE,
  source_type text NOT NULL,
  time_entry_id text REFERENCES time_entries(id) ON DELETE SET NULL,
  period_month text,
  label text NOT NULL,
  description text,
  note text,
  item_ref integer,
  billing_kind text,
  quantity real,
  rate real,
  amount real,
  created_at timestamp DEFAULT NOW(),
  updated_at timestamp DEFAULT NOW(),
  CONSTRAINT charge_document_lines_source_type_check
    CHECK (source_type IN ('time_entry','fixed_monthly','retainer')),
  CONSTRAINT charge_document_lines_period_month_check
    CHECK (period_month IS NULL OR period_month ~ '^\d{4}-\d{2}$')
);
CREATE INDEX IF NOT EXISTS idx_charge_document_lines_document_id   ON charge_document_lines(document_id);
CREATE INDEX IF NOT EXISTS idx_charge_document_lines_user_id       ON charge_document_lines(user_id);
CREATE INDEX IF NOT EXISTS idx_charge_document_lines_time_entry_id ON charge_document_lines(time_entry_id);

ALTER TABLE time_entries
  ADD COLUMN IF NOT EXISTS charge_document_id text
    REFERENCES charge_documents(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_time_entries_charge_document_id ON time_entries(charge_document_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_user_unbilled
  ON time_entries (user_id, project_id)
  WHERE charge_document_id IS NULL AND is_billable = true;

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS next_charge_doc_number integer NOT NULL DEFAULT 1;

COMMIT;
```

- [ ] **Step 2: Commit (do NOT apply yet — applied in Phase 5 after code is ready)**

```bash
git add drizzle/0011_charge_documents.sql
git commit -m "feat(db): migration SQL for charge_documents (apply in Phase 5)"
```

---

### Task 3: RLS policies for the new tables

**Files:**
- Modify: `drizzle/rls-policies.sql`

- [ ] **Step 1: Add both tables to the FORCE/policy loop**

Locate the `FOREACH t IN ARRAY ARRAY[...]` block in `drizzle/rls-policies.sql` and add `'charge_documents'` and `'charge_document_lines'` to the array. Append the grants near the existing `client_rates` grant:

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON charge_documents      TO clockbill_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON charge_document_lines TO clockbill_app;
```

If the array form does not fit cleanly, append this idempotent standalone block at the end of the file instead:

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

- [ ] **Step 2: Commit**

```bash
git add drizzle/rls-policies.sql
git commit -m "feat(db): RLS policies for charge_documents tables"
```

---

## Phase 2 — Pure logic (TDD)

### Task 4: Status-transition table + total computation

**Files:**
- Create: `lib/charge-documents.ts`
- Test: `tests/unit/charge-documents.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/charge-documents.test.ts`:

```typescript
/**
 * Unit tests for lib/charge-documents.ts — pure settlement logic.
 */
import {
  canTransition,
  computeDocumentTotal,
  buildLineFromEntry,
  type ChargeStatus,
  type BillableEntry,
} from "../../lib/charge-documents";

class TestRunner {
  private tests: Array<{ name: string; fn: () => void }> = [];
  private passed = 0;
  private failed = 0;
  test(name: string, fn: () => void) {
    this.tests.push({ name, fn });
  }
  async run() {
    console.log("🧪 Running charge-documents tests...\n");
    for (const { name, fn } of this.tests) {
      try {
        fn();
        this.passed++;
        console.log(`  ✅ ${name}`);
      } catch (e) {
        this.failed++;
        console.error(`  ❌ ${name}`);
        if (e instanceof Error) console.error(`     ${e.message}`);
      }
    }
    console.log(`\n📊 Results: ${this.passed} passed, ${this.failed} failed`);
    return this.failed === 0;
  }
}
function assertEqual<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) throw new Error(message || `Expected "${expected}" but got "${actual}"`);
}
function assertThrows(fn: () => void, message?: string) {
  let threw = false;
  try { fn(); } catch { threw = true; }
  if (!threw) throw new Error(message || "Expected function to throw");
}

const runner = new TestRunner();

// --- transitions ---
runner.test("pending -> paid allowed", () => {
  assertEqual(canTransition("pending", "paid"), true);
});
runner.test("pending -> canceled allowed", () => {
  assertEqual(canTransition("pending", "canceled"), true);
});
runner.test("paid -> pending allowed (unpay)", () => {
  assertEqual(canTransition("paid", "pending"), true);
});
runner.test("paid -> canceled NOT allowed (must unpay first)", () => {
  assertEqual(canTransition("paid", "canceled"), false);
});
runner.test("canceled -> anything NOT allowed", () => {
  assertEqual(canTransition("canceled", "pending"), false);
  assertEqual(canTransition("canceled", "paid"), false);
});

// --- total ---
runner.test("computeDocumentTotal sums line amounts exactly", () => {
  assertEqual(computeDocumentTotal([{ amount: 300 }, { amount: 99.99 }, { amount: 0.01 }]), 400);
});
runner.test("computeDocumentTotal handles null amounts as 0", () => {
  assertEqual(computeDocumentTotal([{ amount: null }, { amount: 50 }]), 50);
});

// --- buildLineFromEntry ---
runner.test("buildLineFromEntry: hourly entry -> hourly line amount", () => {
  const entry: BillableEntry = {
    id: "e1", description: "פיתוח", notes: "מסך לוגין", billingKind: "hourly",
    duration: 90, quantity: null, rate: 200, rateLabel: "תכנות", itemRef: null,
  };
  const line = buildLineFromEntry(entry);
  assertEqual(line.sourceType, "time_entry");
  assertEqual(line.timeEntryId, "e1");
  assertEqual(line.billingKind, "hourly");
  assertEqual(line.amount, 300); // 1.5h * 200
  assertEqual(line.label, "תכנות");
  assertEqual(line.description, "פיתוח");
  assertEqual(line.note, "מסך לוגין");
});
runner.test("buildLineFromEntry: item entry -> item line amount + item_ref", () => {
  const entry: BillableEntry = {
    id: "e2", description: "מכתב", notes: "בנושא שכירות", billingKind: "item",
    duration: 0, quantity: 3, rate: 100, rateLabel: "כתיבת מכתב", itemRef: 42,
  };
  const line = buildLineFromEntry(entry);
  assertEqual(line.billingKind, "item");
  assertEqual(line.amount, 300);
  assertEqual(line.itemRef, 42);
  assertEqual(line.quantity, 3);
});

runner.run().then((ok) => process.exit(ok ? 0 : 1));
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx tsx tests/unit/charge-documents.test.ts`
Expected: FAIL — cannot find module `../../lib/charge-documents`.

- [ ] **Step 3: Write the implementation**

Create `lib/charge-documents.ts`:

```typescript
/**
 * Pure logic for internal settlement / charge documents. No DB or IO here so
 * it stays unit-testable. The API routes call these to build line snapshots,
 * compute totals, and gate status transitions.
 */
import { calcHourlyAmount, calcItemAmount, sumMoney } from "./money";

export type ChargeStatus = "pending" | "paid" | "canceled";
export type SourceType = "time_entry" | "fixed_monthly" | "retainer";
export type BillingKind = "hourly" | "item" | "fixed";

/** A client's unbilled entry as returned by the billable query. */
export interface BillableEntry {
  id: string;
  description: string;
  notes: string | null;
  billingKind: "hourly" | "item" | null; // null => legacy hourly
  duration: number; // minutes (hourly)
  quantity: number | null; // units (item)
  rate: number | null;
  rateLabel: string | null;
  itemRef: number | null;
}

/** A snapshot line ready to INSERT into charge_document_lines (sans id/document_id). */
export interface ChargeLineDraft {
  sourceType: SourceType;
  timeEntryId: string | null;
  periodMonth: string | null;
  label: string;
  description: string | null;
  note: string | null;
  itemRef: number | null;
  billingKind: BillingKind;
  quantity: number | null;
  rate: number | null;
  amount: number;
}

/**
 * Allowed status transitions. A paid document must be reopened (unpay) before
 * it can be canceled; a canceled document is terminal.
 */
const TRANSITIONS: Record<ChargeStatus, ChargeStatus[]> = {
  pending: ["paid", "canceled"],
  paid: ["pending"],
  canceled: [],
};

export function canTransition(from: ChargeStatus, to: ChargeStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

/** Sum of line amounts, money-safe (null amounts count as 0). */
export function computeDocumentTotal(lines: Array<{ amount: number | null }>): number {
  return sumMoney(lines.map((l) => l.amount ?? 0));
}

/** Build a snapshot line from an unbilled time entry. */
export function buildLineFromEntry(entry: BillableEntry): ChargeLineDraft {
  const isItem = entry.billingKind === "item";
  const amount = isItem
    ? calcItemAmount(entry.quantity, entry.rate)
    : calcHourlyAmount(entry.duration, entry.rate);
  return {
    sourceType: "time_entry",
    timeEntryId: entry.id,
    periodMonth: null,
    label: entry.rateLabel ?? entry.description,
    description: entry.description,
    note: entry.notes,
    itemRef: isItem ? entry.itemRef : null,
    billingKind: isItem ? "item" : "hourly",
    quantity: isItem ? entry.quantity : null,
    rate: entry.rate,
    amount,
  };
}
```

> Verify `calcHourlyAmount(durationMinutes, ratePerHour)` argument order against `lib/money.ts:44` before finalizing; adjust the call if the signature differs.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx tsx tests/unit/charge-documents.test.ts`
Expected: PASS — all assertions green.

- [ ] **Step 5: Commit**

```bash
git add lib/charge-documents.ts tests/unit/charge-documents.test.ts
git commit -m "feat: charge-document pure logic (transitions, totals, line snapshot)"
```

---

### Task 5: Zod schemas

**Files:**
- Create: `lib/schemas/charge-documents.ts`
- Test: `tests/unit/charge-documents-schema.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/charge-documents-schema.test.ts`:

```typescript
/**
 * Unit tests for lib/schemas/charge-documents.ts
 */
import {
  createChargeDocumentSchema,
  patchChargeLineSchema,
} from "../../lib/schemas/charge-documents";

class TestRunner {
  private tests: Array<{ name: string; fn: () => void }> = [];
  private passed = 0;
  private failed = 0;
  test(name: string, fn: () => void) { this.tests.push({ name, fn }); }
  async run() {
    console.log("🧪 Running charge-documents-schema tests...\n");
    for (const { name, fn } of this.tests) {
      try { fn(); this.passed++; console.log(`  ✅ ${name}`); }
      catch (e) { this.failed++; console.error(`  ❌ ${name}`); if (e instanceof Error) console.error(`     ${e.message}`); }
    }
    console.log(`\n📊 Results: ${this.passed} passed, ${this.failed} failed`);
    return this.failed === 0;
  }
}
function assert(cond: boolean, message: string) { if (!cond) throw new Error(message); }

const runner = new TestRunner();

runner.test("create: valid payload parses", () => {
  const r = createChargeDocumentSchema.safeParse({
    clientId: "c1",
    pdfTemplate: "modern",
    notes: "יוני",
    timeEntryIds: ["e1", "e2"],
    computedLines: [],
  });
  assert(r.success, "expected valid payload to parse");
});
runner.test("create: rejects empty clientId", () => {
  const r = createChargeDocumentSchema.safeParse({
    clientId: "", pdfTemplate: "modern", timeEntryIds: ["e1"], computedLines: [],
  });
  assert(!r.success, "expected empty clientId to fail");
});
runner.test("create: rejects when no lines selected at all", () => {
  const r = createChargeDocumentSchema.safeParse({
    clientId: "c1", pdfTemplate: "modern", timeEntryIds: [], computedLines: [],
  });
  assert(!r.success, "expected zero-line document to fail");
});
runner.test("create: accepts a computed (retainer) line with period", () => {
  const r = createChargeDocumentSchema.safeParse({
    clientId: "c1", pdfTemplate: "modern", timeEntryIds: [],
    computedLines: [{ sourceType: "retainer", periodMonth: "2026-06", label: "ריטיינר יוני", amount: 1500 }],
  });
  assert(r.success, "expected computed line to parse");
});
runner.test("create: rejects malformed periodMonth", () => {
  const r = createChargeDocumentSchema.safeParse({
    clientId: "c1", pdfTemplate: "modern", timeEntryIds: [],
    computedLines: [{ sourceType: "retainer", periodMonth: "2026/6", label: "x", amount: 1 }],
  });
  assert(!r.success, "expected bad periodMonth to fail");
});
runner.test("patchLine: edit description/note parses", () => {
  const r = patchChargeLineSchema.safeParse({ lineId: "l1", description: "מכתב חדש", note: "" });
  assert(r.success, "expected line edit to parse");
});

runner.run().then((ok) => process.exit(ok ? 0 : 1));
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx tsx tests/unit/charge-documents-schema.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the schemas**

Create `lib/schemas/charge-documents.ts`:

```typescript
import { z } from "zod";

const PERIOD_MONTH = /^\d{4}-\d{2}$/;
const KNOWN_TEMPLATES = ["modern", "classic", "bold", "elegant", "nature", "ocean"] as const;

/** A computed (non-time-entry) line the client chose to include. */
export const computedLineSchema = z.object({
  sourceType: z.enum(["fixed_monthly", "retainer"]),
  periodMonth: z.string().regex(PERIOD_MONTH, "חודש לא תקין"),
  label: z.string().min(1).max(200),
  amount: z.number(),
});

/** POST /api/charge-documents body. */
export const createChargeDocumentSchema = z
  .object({
    clientId: z.string({ message: "נא לבחור לקוח" }).min(1, "נא לבחור לקוח"),
    pdfTemplate: z.enum(KNOWN_TEMPLATES).default("modern"),
    notes: z.string().max(2000).nullish(),
    timeEntryIds: z.array(z.string().min(1)).default([]),
    computedLines: z.array(computedLineSchema).default([]),
  })
  .refine((d) => d.timeEntryIds.length + d.computedLines.length > 0, {
    message: "נא לבחור לפחות פריט אחד לחיוב",
    path: ["timeEntryIds"],
  });

/** PATCH a single line on a pending document (edit text or remove). */
export const patchChargeLineSchema = z.object({
  lineId: z.string().min(1),
  description: z.string().max(5000).nullish(),
  note: z.string().max(5000).nullish(),
});

/** PATCH document-level fields / line operations. */
export const patchChargeDocumentSchema = z.object({
  notes: z.string().max(2000).nullish(),
  editLine: patchChargeLineSchema.nullish(),
  removeLineId: z.string().min(1).nullish(),
  addTimeEntryId: z.string().min(1).nullish(),
});

export type CreateChargeDocumentBody = z.infer<typeof createChargeDocumentSchema>;
export type PatchChargeDocumentBody = z.infer<typeof patchChargeDocumentSchema>;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx tsx tests/unit/charge-documents-schema.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/schemas/charge-documents.ts tests/unit/charge-documents-schema.test.ts
git commit -m "feat: Zod schemas for charge documents"
```

---

## Phase 3 — API routes

> Pattern for every route (from `app/api/entries/route.ts`): `const user = await getUser(); if (!user) return 401`; dynamic `const { query, withTransaction } = await import("@/lib/db")`; validate bodies with `parseBody(request, schema)`; filter every query by `user.id`; return `{ success, ... }`; Hebrew messages.

### Task 6: Billable list endpoint

**Files:**
- Create: `app/api/charge-documents/billable/route.ts`

- [ ] **Step 1: Implement `GET /api/charge-documents/billable`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { calculateFixedMonthlyCharges, type FixedChargeProject } from "@/lib/fixed-charges";

/**
 * GET /api/charge-documents/billable?clientId=&periodMonth=YYYY-MM
 * Returns the client's unbilled, billable time entries plus the computed
 * fixed-monthly/retainer charge for the chosen month, each flagged if that
 * month is already covered by a non-canceled document (soft warning).
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ success: false, message: "לא מחובר" }, { status: 401 });
    }
    const { query } = await import("@/lib/db");
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId");
    const periodMonth = searchParams.get("periodMonth"); // YYYY-MM

    if (!clientId) {
      return NextResponse.json({ success: false, message: "נא לבחור לקוח" }, { status: 400 });
    }

    // Unbilled, billable entries for this client.
    const entries = await query<{
      id: string; description: string; notes: string | null; date: string;
      billing_kind: string | null; duration: number; quantity: number | null;
      rate: number | null; rate_label: string | null; item_ref: number | null;
      project_name: string; currency: string;
    }>(
      `SELECT te.id, te.description, te.notes, te.date, te.billing_kind, te.duration,
              te.quantity, te.rate, te.rate_label, te.item_ref,
              p.name AS project_name, c.currency
         FROM time_entries te
         JOIN projects p ON te.project_id = p.id
         JOIN clients  c ON p.client_id = c.id
        WHERE te.user_id = $1
          AND c.id = $2
          AND te.charge_document_id IS NULL
          AND te.is_billable = true
        ORDER BY te.date DESC, te.created_at DESC`,
      [user.id, clientId]
    );

    // Computed fixed/retainer charge for the month (reuse existing helper).
    let computedLines: Array<{ sourceType: string; periodMonth: string; label: string; amount: number; currency: string; alreadyBilled: boolean }> = [];
    if (periodMonth && /^\d{4}-\d{2}$/.test(periodMonth)) {
      const monthStart = `${periodMonth}-01`;
      const monthEnd = `${periodMonth}-31`;
      const projects = await query<FixedChargeProject>(
        `SELECT p.id AS "projectId", p.name AS "projectName", c.id AS "clientId",
                c.name AS "clientName", c.currency AS currency,
                p.fixed_monthly_fee AS "fixedMonthlyFee",
                p.fixed_monthly_start_date AS "fixedMonthlyStartDate",
                p.fixed_monthly_end_date AS "fixedMonthlyEndDate"
           FROM projects p
           JOIN clients c ON p.client_id = c.id
          WHERE p.user_id = $1 AND c.id = $2 AND p.fixed_monthly_enabled = true`,
        [user.id, clientId]
      );
      const lines = calculateFixedMonthlyCharges(projects.rows, monthStart, monthEnd);

      // Which periods are already covered by a non-canceled document for this client?
      const billed = await query<{ period_month: string }>(
        `SELECT DISTINCT l.period_month
           FROM charge_document_lines l
           JOIN charge_documents d ON l.document_id = d.id
          WHERE l.user_id = $1 AND d.client_id = $2 AND d.status <> 'canceled'
            AND l.period_month IS NOT NULL`,
        [user.id, clientId]
      );
      const billedSet = new Set(billed.rows.map((r) => r.period_month));
      computedLines = lines.map((l) => ({
        sourceType: "fixed_monthly",
        periodMonth: l.month,
        label: `${l.projectName} — חיוב חודשי ${l.month}`,
        amount: l.amount,
        currency: l.currency,
        alreadyBilled: billedSet.has(l.month),
      }));
    }

    return NextResponse.json({ success: true, data: { entries: entries.rows, computedLines } });
  } catch (error) {
    console.error("GET /api/charge-documents/billable failed:", error);
    return NextResponse.json({ success: false, message: "שגיאה בטעינת פריטים לחיוב" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npm run build`
Expected: build passes (route compiles). Cannot run live until Phase 5 (tables don't exist yet).

- [ ] **Step 3: Commit**

```bash
git add app/api/charge-documents/billable/route.ts
git commit -m "feat(api): GET charge-documents/billable"
```

---

### Task 7: Create document endpoint

**Files:**
- Create: `app/api/charge-documents/route.ts`

- [ ] **Step 1: Implement `GET` (list) + `POST` (create)**

```typescript
import { NextRequest, NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { getUser } from "@/lib/auth";
import { parseBody } from "@/lib/api-validation";
import { createChargeDocumentSchema } from "@/lib/schemas/charge-documents";
import { buildLineFromEntry, computeDocumentTotal, type BillableEntry, type ChargeLineDraft } from "@/lib/charge-documents";

/** GET /api/charge-documents?clientId=&status= — list documents for the user. */
export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ success: false, message: "לא מחובר" }, { status: 401 });
    const { query } = await import("@/lib/db");
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId");
    const status = searchParams.get("status");

    const params: (string | number)[] = [user.id];
    let where = "d.user_id = $1";
    if (clientId) { params.push(clientId); where += ` AND d.client_id = $${params.length}`; }
    if (status)   { params.push(status);   where += ` AND d.status = $${params.length}`; }

    const rows = await query(
      `SELECT d.id, d.doc_number, d.status, d.currency, d.total, d.issued_at, d.paid_at,
              d.canceled_at, c.name AS client_name
         FROM charge_documents d
         JOIN clients c ON d.client_id = c.id
        WHERE ${where}
        ORDER BY d.doc_number DESC`,
      params
    );
    return NextResponse.json({ success: true, data: rows.rows });
  } catch (error) {
    console.error("GET /api/charge-documents failed:", error);
    return NextResponse.json({ success: false, message: "שגיאה בטעינת תעודות" }, { status: 500 });
  }
}

/** POST /api/charge-documents — issue a new settlement document. */
export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ success: false, message: "לא מחובר" }, { status: 401 });

    const parsed = await parseBody(request, createChargeDocumentSchema);
    if (!parsed.ok) return parsed.response;
    const { clientId, pdfTemplate, notes, timeEntryIds, computedLines } = parsed.data;

    const { withTransaction } = await import("@/lib/db");

    const result = await withTransaction(async (client: PoolClient) => {
      // 1. Verify client ownership + currency.
      const clientRow = await client.query(
        `SELECT currency FROM clients WHERE id = $1 AND user_id = $2`,
        [clientId, user.id]
      );
      if (clientRow.rowCount === 0) throw new Error("CLIENT_NOT_FOUND");
      const currency: string = clientRow.rows[0].currency ?? "ILS";

      // 2. Load the selected entries — only ones owned, for this client, still unbilled.
      let entries: BillableEntry[] = [];
      if (timeEntryIds.length > 0) {
        const er = await client.query(
          `SELECT te.id, te.description, te.notes, te.billing_kind AS "billingKind",
                  te.duration, te.quantity, te.rate, te.rate_label AS "rateLabel",
                  te.item_ref AS "itemRef"
             FROM time_entries te
             JOIN projects p ON te.project_id = p.id
            WHERE te.id = ANY($1::text[]) AND te.user_id = $2 AND p.client_id = $3
              AND te.charge_document_id IS NULL AND te.is_billable = true`,
          [timeEntryIds, user.id, clientId]
        );
        entries = er.rows as BillableEntry[];
        if (entries.length !== timeEntryIds.length) throw new Error("ENTRY_STATE_CHANGED");
      }

      // 3. Build all line drafts.
      const entryLines: ChargeLineDraft[] = entries.map(buildLineFromEntry);
      const computedDrafts: ChargeLineDraft[] = computedLines.map((c) => ({
        sourceType: c.sourceType,
        timeEntryId: null,
        periodMonth: c.periodMonth,
        label: c.label,
        description: null,
        note: null,
        itemRef: null,
        billingKind: "fixed",
        quantity: null,
        rate: null,
        amount: c.amount,
      }));
      const allLines = [...entryLines, ...computedDrafts];
      const total = computeDocumentTotal(allLines);

      // 4. Assign doc_number atomically (row-locked counter).
      const counter = await client.query(
        `UPDATE user_profiles SET next_charge_doc_number = next_charge_doc_number + 1
          WHERE user_id = $1 RETURNING next_charge_doc_number - 1 AS doc_number`,
        [user.id]
      );
      let docNumber: number;
      if (counter.rowCount === 0) {
        const max = await client.query(
          `SELECT COALESCE(MAX(doc_number), 0) + 1 AS n FROM charge_documents WHERE user_id = $1`,
          [user.id]
        );
        docNumber = max.rows[0].n;
      } else {
        docNumber = counter.rows[0].doc_number;
      }

      // 5. Insert the document.
      const doc = await client.query(
        `INSERT INTO charge_documents
           (id, user_id, client_id, doc_number, status, currency, total, notes, pdf_template, issued_at)
         VALUES (gen_random_uuid()::text, $1, $2, $3, 'pending', $4, $5, $6, $7, NOW())
         RETURNING id, doc_number`,
        [user.id, clientId, docNumber, currency, total, notes ?? null, pdfTemplate]
      );
      const documentId: string = doc.rows[0].id;

      // 6. Insert lines.
      for (const l of allLines) {
        await client.query(
          `INSERT INTO charge_document_lines
             (id, user_id, document_id, source_type, time_entry_id, period_month, label,
              description, note, item_ref, billing_kind, quantity, rate, amount)
           VALUES (gen_random_uuid()::text, $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [user.id, documentId, l.sourceType, l.timeEntryId, l.periodMonth, l.label,
           l.description, l.note, l.itemRef, l.billingKind, l.quantity, l.rate, l.amount]
        );
      }

      // 7. Mark the entries billed (IS NULL guard prevents double-claim races).
      if (entries.length > 0) {
        await client.query(
          `UPDATE time_entries SET charge_document_id = $1
            WHERE id = ANY($2::text[]) AND user_id = $3 AND charge_document_id IS NULL`,
          [documentId, entries.map((e) => e.id), user.id]
        );
      }

      return { id: documentId, docNumber: doc.rows[0].doc_number };
    });

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    if (msg === "CLIENT_NOT_FOUND") return NextResponse.json({ success: false, message: "לקוח לא נמצא" }, { status: 404 });
    if (msg === "ENTRY_STATE_CHANGED") return NextResponse.json({ success: false, message: "חלק מהפריטים כבר חויבו או השתנו — רענן ונסה שוב" }, { status: 409 });
    console.error("POST /api/charge-documents failed:", error);
    return NextResponse.json({ success: false, message: "שגיאה ביצירת תעודה" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npm run build`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add app/api/charge-documents/route.ts
git commit -m "feat(api): GET list + POST create charge documents (atomic)"
```

---

### Task 8: Single document GET / PATCH / DELETE

**Files:**
- Create: `app/api/charge-documents/[id]/route.ts`

- [ ] **Step 1: Implement the route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { getUser } from "@/lib/auth";
import { parseBody } from "@/lib/api-validation";
import { patchChargeDocumentSchema } from "@/lib/schemas/charge-documents";
import { buildLineFromEntry, computeDocumentTotal, type BillableEntry } from "@/lib/charge-documents";

type Ctx = { params: Promise<{ id: string }> };

/** GET — document + its lines (ownership enforced). */
export async function GET(_request: NextRequest, ctx: Ctx) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ success: false, message: "לא מחובר" }, { status: 401 });
    const { id } = await ctx.params;
    const { query } = await import("@/lib/db");

    const doc = await query(
      `SELECT d.*, c.name AS client_name FROM charge_documents d
         JOIN clients c ON d.client_id = c.id
        WHERE d.id = $1 AND d.user_id = $2`,
      [id, user.id]
    );
    if (doc.rowCount === 0) return NextResponse.json({ success: false, message: "תעודה לא נמצאה" }, { status: 404 });

    const lines = await query(
      `SELECT * FROM charge_document_lines WHERE document_id = $1 AND user_id = $2 ORDER BY created_at`,
      [id, user.id]
    );
    return NextResponse.json({ success: true, data: { document: doc.rows[0], lines: lines.rows } });
  } catch (error) {
    console.error("GET /api/charge-documents/[id] failed:", error);
    return NextResponse.json({ success: false, message: "שגיאה בטעינת תעודה" }, { status: 500 });
  }
}

/** PATCH — only when pending: edit notes, edit a line, remove a line, add an entry. */
export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ success: false, message: "לא מחובר" }, { status: 401 });
    const { id } = await ctx.params;
    const parsed = await parseBody(request, patchChargeDocumentSchema);
    if (!parsed.ok) return parsed.response;
    const { notes, editLine, removeLineId, addTimeEntryId } = parsed.data;
    const { withTransaction } = await import("@/lib/db");

    await withTransaction(async (client: PoolClient) => {
      const doc = await client.query(
        `SELECT id, client_id, status FROM charge_documents WHERE id = $1 AND user_id = $2 FOR UPDATE`,
        [id, user.id]
      );
      if (doc.rowCount === 0) throw new Error("NOT_FOUND");
      if (doc.rows[0].status !== "pending") throw new Error("LOCKED");
      const clientId: string = doc.rows[0].client_id;

      if (typeof notes !== "undefined" && notes !== null) {
        await client.query(`UPDATE charge_documents SET notes = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3`, [notes, id, user.id]);
      }

      if (editLine) {
        await client.query(
          `UPDATE charge_document_lines SET description = COALESCE($1, description),
             note = COALESCE($2, note), updated_at = NOW()
            WHERE id = $3 AND document_id = $4 AND user_id = $5`,
          [editLine.description ?? null, editLine.note ?? null, editLine.lineId, id, user.id]
        );
      }

      if (removeLineId) {
        const line = await client.query(
          `SELECT time_entry_id FROM charge_document_lines WHERE id = $1 AND document_id = $2 AND user_id = $3`,
          [removeLineId, id, user.id]
        );
        if (line.rowCount === 0) throw new Error("LINE_NOT_FOUND");
        const teId: string | null = line.rows[0].time_entry_id;
        await client.query(`DELETE FROM charge_document_lines WHERE id = $1 AND user_id = $2`, [removeLineId, user.id]);
        if (teId) {
          await client.query(`UPDATE time_entries SET charge_document_id = NULL WHERE id = $1 AND user_id = $2`, [teId, user.id]);
        }
      }

      if (addTimeEntryId) {
        const er = await client.query(
          `SELECT te.id, te.description, te.notes, te.billing_kind AS "billingKind", te.duration,
                  te.quantity, te.rate, te.rate_label AS "rateLabel", te.item_ref AS "itemRef"
             FROM time_entries te JOIN projects p ON te.project_id = p.id
            WHERE te.id = $1 AND te.user_id = $2 AND p.client_id = $3
              AND te.charge_document_id IS NULL AND te.is_billable = true`,
          [addTimeEntryId, user.id, clientId]
        );
        if (er.rowCount === 0) throw new Error("ENTRY_UNAVAILABLE");
        const l = buildLineFromEntry(er.rows[0] as BillableEntry);
        await client.query(
          `INSERT INTO charge_document_lines
             (id, user_id, document_id, source_type, time_entry_id, period_month, label,
              description, note, item_ref, billing_kind, quantity, rate, amount)
           VALUES (gen_random_uuid()::text,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [user.id, id, l.sourceType, l.timeEntryId, l.periodMonth, l.label, l.description,
           l.note, l.itemRef, l.billingKind, l.quantity, l.rate, l.amount]
        );
        await client.query(`UPDATE time_entries SET charge_document_id = $1 WHERE id = $2 AND user_id = $3 AND charge_document_id IS NULL`, [id, addTimeEntryId, user.id]);
      }

      // Recompute total from the surviving lines.
      const sum = await client.query(`SELECT amount FROM charge_document_lines WHERE document_id = $1 AND user_id = $2`, [id, user.id]);
      const total = computeDocumentTotal(sum.rows as Array<{ amount: number | null }>);
      await client.query(`UPDATE charge_documents SET total = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3`, [total, id, user.id]);
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    if (msg === "NOT_FOUND") return NextResponse.json({ success: false, message: "תעודה לא נמצאה" }, { status: 404 });
    if (msg === "LOCKED") return NextResponse.json({ success: false, message: "התעודה נעולה — בטל תשלום כדי לערוך" }, { status: 409 });
    if (msg === "LINE_NOT_FOUND") return NextResponse.json({ success: false, message: "שורה לא נמצאה" }, { status: 404 });
    if (msg === "ENTRY_UNAVAILABLE") return NextResponse.json({ success: false, message: "הפריט כבר חויב או אינו זמין" }, { status: 409 });
    console.error("PATCH /api/charge-documents/[id] failed:", error);
    return NextResponse.json({ success: false, message: "שגיאה בעדכון תעודה" }, { status: 500 });
  }
}

/** DELETE — only a canceled document (cleanup of a mistake). */
export async function DELETE(_request: NextRequest, ctx: Ctx) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ success: false, message: "לא מחובר" }, { status: 401 });
    const { id } = await ctx.params;
    const { query } = await import("@/lib/db");
    const r = await query(
      `DELETE FROM charge_documents WHERE id = $1 AND user_id = $2 AND status = 'canceled' RETURNING id`,
      [id, user.id]
    );
    if (r.rowCount === 0) return NextResponse.json({ success: false, message: "ניתן למחוק רק תעודה מבוטלת" }, { status: 409 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/charge-documents/[id] failed:", error);
    return NextResponse.json({ success: false, message: "שגיאה במחיקת תעודה" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Type-check + commit**

Run: `npm run build` → passes.

```bash
git add app/api/charge-documents/[id]/route.ts
git commit -m "feat(api): GET/PATCH/DELETE single charge document"
```

---

### Task 9: Status transitions (pay / unpay / cancel)

**Files:**
- Create: `app/api/charge-documents/[id]/pay/route.ts`
- Create: `app/api/charge-documents/[id]/unpay/route.ts`
- Create: `app/api/charge-documents/[id]/cancel/route.ts`

- [ ] **Step 1: Implement `pay`**

`app/api/charge-documents/[id]/pay/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

/** POST — mark a pending document paid (locks it). */
export async function POST(_request: NextRequest, ctx: Ctx) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ success: false, message: "לא מחובר" }, { status: 401 });
    const { id } = await ctx.params;
    const { query } = await import("@/lib/db");
    const r = await query(
      `UPDATE charge_documents SET status = 'paid', paid_at = NOW(), updated_at = NOW()
        WHERE id = $1 AND user_id = $2 AND status = 'pending' RETURNING id`,
      [id, user.id]
    );
    if (r.rowCount === 0) return NextResponse.json({ success: false, message: "לא ניתן לסמן כשולם (התעודה אינה ממתינה)" }, { status: 409 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST pay failed:", error);
    return NextResponse.json({ success: false, message: "שגיאה בסימון תשלום" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Implement `unpay`**

`app/api/charge-documents/[id]/unpay/route.ts` — identical shape, transition `paid → pending`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

/** POST — reopen a paid document for editing. */
export async function POST(_request: NextRequest, ctx: Ctx) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ success: false, message: "לא מחובר" }, { status: 401 });
    const { id } = await ctx.params;
    const { query } = await import("@/lib/db");
    const r = await query(
      `UPDATE charge_documents SET status = 'pending', paid_at = NULL, updated_at = NOW()
        WHERE id = $1 AND user_id = $2 AND status = 'paid' RETURNING id`,
      [id, user.id]
    );
    if (r.rowCount === 0) return NextResponse.json({ success: false, message: "לא ניתן לבטל תשלום (התעודה אינה משולמת)" }, { status: 409 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST unpay failed:", error);
    return NextResponse.json({ success: false, message: "שגיאה בביטול תשלום" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Implement `cancel` (atomic sweep)**

`app/api/charge-documents/[id]/cancel/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { getUser } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

/** POST — cancel a non-paid document and return its entries to unbilled. */
export async function POST(_request: NextRequest, ctx: Ctx) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ success: false, message: "לא מחובר" }, { status: 401 });
    const { id } = await ctx.params;
    const { withTransaction } = await import("@/lib/db");

    await withTransaction(async (client: PoolClient) => {
      const doc = await client.query(
        `SELECT status FROM charge_documents WHERE id = $1 AND user_id = $2 FOR UPDATE`,
        [id, user.id]
      );
      if (doc.rowCount === 0) throw new Error("NOT_FOUND");
      if (doc.rows[0].status !== "pending") throw new Error("BAD_STATE"); // must unpay before cancel

      await client.query(
        `UPDATE time_entries SET charge_document_id = NULL WHERE charge_document_id = $1 AND user_id = $2`,
        [id, user.id]
      );
      await client.query(
        `UPDATE charge_documents SET status = 'canceled', canceled_at = NOW(), updated_at = NOW()
          WHERE id = $1 AND user_id = $2`,
        [id, user.id]
      );
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    if (msg === "NOT_FOUND") return NextResponse.json({ success: false, message: "תעודה לא נמצאה" }, { status: 404 });
    if (msg === "BAD_STATE") return NextResponse.json({ success: false, message: "בטל תשלום לפני ביטול התעודה" }, { status: 409 });
    console.error("POST cancel failed:", error);
    return NextResponse.json({ success: false, message: "שגיאה בביטול תעודה" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Type-check + commit**

Run: `npm run build` → passes.

```bash
git add app/api/charge-documents/[id]/pay/route.ts app/api/charge-documents/[id]/unpay/route.ts app/api/charge-documents/[id]/cancel/route.ts
git commit -m "feat(api): pay/unpay/cancel charge document transitions"
```

---

## Phase 4 — UI

> The current report lives in `app/(auth)/reports/page.tsx` (1726 lines). Split the three tabs into focused components; keep today's report behavior identical in `AdHocReportTab`. Use design tokens only (no raw colors), RTL logical properties, tap targets ≥44px.

### Task 10: Tab scaffold + extract today's report + nav rename

**Files:**
- Modify: `app/(auth)/reports/page.tsx`
- Create: `app/(auth)/reports/AdHocReportTab.tsx`
- Modify: nav component(s) showing "דוחות"

- [ ] **Step 1: Find the nav label**

Run: `grep -rn "דוחות" app components --include="*.tsx"`
Expected: one or more nav entries. Change the user-facing label text to `התחשבנות` (keep the route `/reports`).

- [ ] **Step 2: Extract today's report into `AdHocReportTab.tsx`**

Move the existing report JSX + its state/handlers out of `page.tsx` into a new client component `AdHocReportTab.tsx` (`"use client"`). Export `export default function AdHocReportTab() { ... }`. This is a mechanical move — no behavior change. Keep the PDF `confirmExportPdf` logic with it.

- [ ] **Step 3: Turn `page.tsx` into a tab shell**

```typescript
"use client";
import { useState } from "react";
import AdHocReportTab from "./AdHocReportTab";
import BillableTab from "./BillableTab";
import DocumentsTab from "./DocumentsTab";

type Tab = "billable" | "documents" | "report";

export default function SettlementPage() {
  const [tab, setTab] = useState<Tab>("billable");
  return (
    <div className="p-4 space-y-4" dir="rtl">
      <div className="flex gap-2 border-b border-border">
        {([
          ["billable", "לחיוב"],
          ["documents", "תעודות"],
          ["report", "דוח חד-פעמי"],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`min-h-[44px] px-4 rounded-t-[var(--radius)] ${
              tab === key ? "bg-card text-foreground" : "text-muted-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "billable" && <BillableTab />}
      {tab === "documents" && <DocumentsTab />}
      {tab === "report" && <AdHocReportTab />}
    </div>
  );
}
```

- [ ] **Step 4: Build to verify (BillableTab/DocumentsTab stubs needed)**

Create temporary stub files so the build passes (replaced in Tasks 11–12):

```typescript
// app/(auth)/reports/BillableTab.tsx
"use client";
export default function BillableTab() { return <div>לחיוב</div>; }
```
```typescript
// app/(auth)/reports/DocumentsTab.tsx
"use client";
export default function DocumentsTab() { return <div>תעודות</div>; }
```

Run: `npm run build`
Expected: passes; nav now shows "התחשבנות"; tabs render.

- [ ] **Step 5: Commit**

```bash
git add app/(auth)/reports/ app components
git commit -m "feat(ui): התחשבנות tab shell + extract ad-hoc report + nav rename"
```

---

### Task 11: BillableTab (build & issue)

**Files:**
- Modify: `app/(auth)/reports/BillableTab.tsx`

- [ ] **Step 1: Implement client+month pickers, list, selection, issue**

Replace the stub with a component that:
1. loads clients (reuse the existing client fetch used by the report — `GET /api/clients`),
2. on client/month change, `GET /api/charge-documents/billable?clientId=&periodMonth=`,
3. renders four states (loading skeleton / empty "אין פריטים לחיוב ללקוח הזה 🎉" / error + "נסה שוב" / list),
4. checkboxes per entry + per computed line (computed lines with `alreadyBilled` show a soft badge "כבר נכלל בתעודה"),
5. a sticky footer with the running selected total and **"הפק תעודת התחשבנות"** which `POST`s to `/api/charge-documents` and on success shows a toast "תעודה #N נוצרה" and switches the parent to the documents tab (lift a callback prop `onIssued?(id)` or use a shared store — pass a prop from `page.tsx`).

Key shape:

```typescript
"use client";
import { useEffect, useState } from "react";

interface BillableEntryRow {
  id: string; description: string; notes: string | null; date: string;
  billing_kind: string | null; duration: number; quantity: number | null;
  rate: number | null; rate_label: string | null; item_ref: number | null;
  project_name: string; currency: string;
}
interface ComputedRow { sourceType: string; periodMonth: string; label: string; amount: number; currency: string; alreadyBilled: boolean; }

export default function BillableTab({ onIssued }: { onIssued?: () => void }) {
  const [clientId, setClientId] = useState("");
  const [periodMonth, setPeriodMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [entries, setEntries] = useState<BillableEntryRow[]>([]);
  const [computed, setComputed] = useState<ComputedRow[]>([]);
  const [selEntries, setSelEntries] = useState<Set<string>>(new Set());
  const [selComputed, setSelComputed] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [issuing, setIssuing] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    setStatus("loading");
    fetch(`/api/charge-documents/billable?clientId=${clientId}&periodMonth=${periodMonth}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.success) throw new Error(d.message);
        setEntries(d.data.entries); setComputed(d.data.computedLines);
        setSelEntries(new Set()); setSelComputed(new Set()); setStatus("idle");
      })
      .catch((e) => { console.error("billable load failed", e); setStatus("error"); });
  }, [clientId, periodMonth]);

  const issue = async () => {
    setIssuing(true);
    try {
      const computedLines = computed
        .filter((c) => selComputed.has(c.periodMonth))
        .map((c) => ({ sourceType: "fixed_monthly", periodMonth: c.periodMonth, label: c.label, amount: c.amount }));
      const res = await fetch("/api/charge-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, pdfTemplate: "modern", timeEntryIds: [...selEntries], computedLines }),
      });
      const d = await res.json();
      if (!d.success) throw new Error(d.message);
      onIssued?.();
    } catch (e) {
      console.error("issue failed", e);
      // surface a Hebrew toast via the app's existing toast util
    } finally { setIssuing(false); }
  };

  // ...render client <select>, month <input type="month">, four states, checkboxes,
  //    sticky footer with total + "הפק תעודת התחשבנות" (disabled while issuing or no selection)
  return null; // replace with full JSX
}
```

> Use the app's existing toast utility (grep `toast` under `components`/`lib`) and the existing currency/number formatters from `lib/format.ts`. Render amounts with `tabular-nums`.

- [ ] **Step 2: Wire `onIssued` from `page.tsx`** to switch `setTab("documents")`.

- [ ] **Step 3: Build + manual check**

Run: `npm run build` → passes. (Live data check happens in Phase 5 after migration.)

- [ ] **Step 4: Commit**

```bash
git add app/(auth)/reports/BillableTab.tsx app/(auth)/reports/page.tsx
git commit -m "feat(ui): BillableTab — select unbilled items and issue a document"
```

---

### Task 12: DocumentsTab + ChargeDocumentView (history, actions, PDF)

**Files:**
- Modify: `app/(auth)/reports/DocumentsTab.tsx`
- Create: `app/(auth)/reports/ChargeDocumentView.tsx`

- [ ] **Step 1: DocumentsTab — list with status badges**

`GET /api/charge-documents` → render rows (doc number, client, issued date, total, status badge ממתין/שולם/בוטל). Four states (loading/empty "עדיין לא הפקת תעודות"/error/list). Clicking a row opens `ChargeDocumentView` (inline panel or modal) with the document id.

- [ ] **Step 2: ChargeDocumentView — detail, edit, actions, PDF**

`GET /api/charge-documents/[id]` → render document + lines. When `status === "pending"`: allow inline edit of each line's `description`/`note` (PATCH `editLine`), remove a line (PATCH `removeLineId`) with confirm, edit document notes. Action buttons:
- pending → **"סמן כשולם"** (confirm dialog) → `POST .../pay`.
- paid → **"בטל תשלום"** → `POST .../unpay`; show fields `disabled` with hint "בטל תשלום כדי לערוך".
- pending → **"בטל תעודה"** (confirm) → `POST .../cancel`.
- **"ייצוא PDF"** → reuse the existing print mechanism (the same `confirmExportPdf` template-injection approach from `AdHocReportTab`), but render the printable region from the document's lines with header **"תעודת התחשבנות פנימית"** + `doc_number` + status. Item lines print `אסמכתא {item_ref}` when present; each line prints `label`, `description`, `note`, quantity/rate/amount; fixed/retainer lines print `label` + amount; footer shows the total in `currency`.

> Factor the print-style injection out of `AdHocReportTab` into a small shared helper `app/(auth)/reports/printStyles.ts` (export `injectPrintStyles(template, primary, accent)`), so both the ad-hoc report and the document share one implementation (DRY).

- [ ] **Step 3: Build + commit**

Run: `npm run build` → passes.

```bash
git add app/(auth)/reports/DocumentsTab.tsx app/(auth)/reports/ChargeDocumentView.tsx app/(auth)/reports/printStyles.ts
git commit -m "feat(ui): documents history + document view with actions and PDF"
```

---

## Phase 5 — Apply migration (dev → prod) + verify

### Task 13: Apply to dev and smoke-test

- [ ] **Step 1: Apply the migration to the dev Neon branch**

Run (uses admin URL — `db:migrate` is intentionally NOT used):
```bash
psql "$DATABASE_URL_ADMIN" -f drizzle/0011_charge_documents.sql
```
Expected: `COMMIT` with no errors. (If `item_ref`/`next_item_ref` referenced anywhere fails, confirm `0009_item_ref.sql` was applied first.)

- [ ] **Step 2: Apply RLS to dev**

```bash
psql "$DATABASE_URL_ADMIN" -f drizzle/rls-policies.sql
```
Expected: idempotent; policies created on both new tables.

- [ ] **Step 3: Verify RLS + tables**

```bash
psql "$DATABASE_URL_ADMIN" -c "\d charge_documents" -c "\d charge_document_lines"
psql "$DATABASE_URL_ADMIN" -c "SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname IN ('charge_documents','charge_document_lines');"
```
Expected: both tables exist; `relrowsecurity` and `relforcerowsecurity` both `t`.

- [ ] **Step 4: Run the dev server and exercise the flow end-to-end**

Run: `npm run dev`
Manually: pick a client in "לחיוב" → select items → "הפק תעודת התחשבנות" → appears in "תעודות" as ממתין → the selected entries disappear from "לחיוב" → open the document → "סמן כשולם" locks it → "בטל תשלום" reopens → remove a line returns the entry to "לחיוב" → "ייצוא PDF" shows "תעודת התחשבנות פנימית". Confirm the four states (loading/empty/error/success) and Hebrew/RTL.

- [ ] **Step 5: IDOR smoke test**

With two users (Alice issues a document; Bob logged in), confirm Bob's `GET /api/charge-documents` does not include Alice's document and `GET /api/charge-documents/<alice-id>` returns 404.

- [ ] **Step 6: Run the unit suite**

Run: `npm test`
Expected: all unit tests pass (including the two new files).

- [ ] **Step 7: Commit any fixes found during smoke-testing**

```bash
git add -A
git commit -m "fix: settlement flow issues found in dev smoke test"
```

### Task 14: Apply to prod

- [ ] **Step 1: Snapshot prod first**

Take a Neon snapshot of the prod (`main`) branch (per infra memory, also keep the local backup path). Do not skip.

- [ ] **Step 2: Apply migration + RLS to prod**

```bash
psql "$DATABASE_URL_ADMIN_PROD" -f drizzle/0011_charge_documents.sql
psql "$DATABASE_URL_ADMIN_PROD" -f drizzle/rls-policies.sql
```
(Use the prod admin connection string. Confirm `0009_item_ref` is already on prod first.)

- [ ] **Step 3: Verify prod tables + RLS** (same `\d` / `pg_class` checks as dev Step 3, against prod).

- [ ] **Step 4: Smoke-test prod** with a real login: issue one small document, mark paid, cancel a throwaway one. Confirm isolation.

- [ ] **Step 5: Update memory** noting the migration is applied to dev + prod (mirrors the rate-types memory pattern).

---

## Self-Review

**Spec coverage:**
- Data model (2 tables + 2 columns) → Tasks 1, 2. ✅
- RLS one `FOR ALL` policy → Task 3. ✅
- Counter `next_charge_doc_number` → Tasks 1, 7. ✅
- Pure logic (transitions/total/snapshot) → Task 4. ✅
- Zod validation → Task 5. ✅
- Billable list incl. computed charges + soft "already billed" warning → Task 6. ✅
- Create (atomic, IDOR/race guards) → Task 7. ✅
- GET/PATCH(edit/remove/add)/DELETE → Task 8. ✅
- pay/unpay/cancel atomic sweep → Task 9. ✅
- UI rename + 3 tabs + 4 states → Tasks 10–12. ✅
- PDF "תעודת התחשבנות פנימית" from snapshot incl. `item_ref` → Task 12. ✅
- Coordination with ad-hoc (0011 migration, item_ref snapshot) → Tasks 2, 4, 6. ✅
- Migration dev→prod manual → Tasks 13–14. ✅
- Tests (unit + IDOR/integration smoke) → Tasks 4, 5, 13. ✅

**Placeholder scan:** UI Tasks 11–12 intentionally describe JSX at the component level with concrete data shapes, state, endpoints, and the four states, rather than pasting full 200-line render trees — the data contracts and handlers are fully specified, which is the part that's easy to get wrong. All logic/API/DB tasks contain complete code.

**Type consistency:** `BillableEntry`, `ChargeLineDraft`, `ChargeStatus`, `canTransition`, `computeDocumentTotal`, `buildLineFromEntry` are defined in Task 4 and used consistently in Tasks 7–8. Schema names `createChargeDocumentSchema` / `patchChargeDocumentSchema` / `patchChargeLineSchema` match between Task 5 and Tasks 7–8. Column names match the DDL (Task 2) and Drizzle (Task 1).

---

## Notes for the implementer

- **Verify `calcHourlyAmount` argument order** (`lib/money.ts:44`) before trusting `buildLineFromEntry`'s hourly amount — fix the call if the signature is `(minutes, rate)` vs `(rate, minutes)`.
- **Toast utility:** grep for the existing toast helper before writing UI; reuse it for all success/error toasts (don't introduce a new one).
- **Do not run `db:migrate`/`db:push`** for this feature — meta drift. psql only, dev then prod, snapshot prod first.
- **Land the ad-hoc-items work first** (it owns `0009`/`item_ref`); this builds on top.
