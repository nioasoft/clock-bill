# Per-Client Rate Types & Items ("תעריפים ופריטים") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let each client own a named list of hourly **rates** (e.g. תכנות=300, הדרכה=200) and fixed-price **items** (e.g. "כתיבת מכתב"=100/unit); the chosen rate/item is snapshotted onto every time entry, and reports bill + break down by label.

**Architecture:** New `client_rates` table (holds both `kind='hourly'` and `kind='item'`), 4 new snapshot columns on `time_entries` (`rate`, `rate_label`, `billing_kind`, `quantity`). Rates are written atomically as part of the client save (`withTransaction`) and read for pickers via a lightweight `GET /api/clients/[id]/rates`. Reports compute per-line amount from the snapshot (`COALESCE(te.rate, clients.default_rate)` for hourly, `quantity × te.rate` for items) and add a per-label breakdown. Full backward compatibility: everything that exists today becomes hourly "תכנות".

**Tech Stack:** Next.js 16 App Router, raw `pg` via `lib/db.ts` (`query`/`withTransaction`, RLS GUC `app.current_user_id`), Drizzle schema as source of truth (`src/db/schema.ts`), Zod (`parseBody`), Tailwind v4 ClickHouse dark theme (`fieldClass`), ExcelJS, custom tsx test runner.

---

## Spec & Conventions (read before starting)

- Spec: `docs/superpowers/specs/2026-05-31-per-client-rate-types-design.md`
- **DB migrations:** drizzle migration meta is drifted from prod — **DO NOT** run `db:migrate`/`db:generate`. Edit `src/db/schema.ts` as the source of truth, then write + run hand-authored SQL via `psql` using `DATABASE_URL_ADMIN`. Take a Neon branch/snapshot first.
- **`.env.local` cannot be `source`d** (connection string contains unquoted `&`). Always extract a single var with `grep`/`cut` (see Task 1.0) — never `. ./.env.local`.
- **RLS is FORCE-enabled.** New tenant tables MUST be added to the `FOREACH` array in `drizzle/rls-policies.sql` and the policy block applied to the DB. Keep app-level `WHERE user_id = $` too (defense in depth).
- **Hebrew RTL** everywhere; logical props (`ps`/`pe`/`me`/`ms`); user-facing strings Hebrew, code/comments English.
- **Design tokens only** (no hardcoded colors, no drop shadows). Forms use `fieldClass()` from `lib/form-styles.ts`. On yellow (`bg-primary`) use `text-primary-foreground`.
- **Validation:** every route reading a body uses `parseBody(request, zodSchema)`.
- `time_entries` has **no** `client_id` — reach the client via `project_id → projects.client_id`.
- API response shape: `{ success: boolean, ... }`, Hebrew user-facing messages.
- After **each phase**: `npx tsc --noEmit` → `npm run build` → `npm test` → browser check (Claude-in-Chrome). Commit incrementally.

---

## File Structure

**Create:**
- `drizzle/0007_per_client_rate_types.sql` — migration (table + columns + seed + backfill).
- `lib/schemas/rates.ts` — shared Zod schemas + TS types for rates/items + entry snapshot fields (imported on client AND server).
- `app/api/clients/[id]/rates/route.ts` — `GET` a client's rates (for pickers).
- `tests/unit/rates.test.ts` — unit tests for `calcItemAmount` + rate-list helpers.

**Modify:**
- `src/db/schema.ts` — add `clientRates` table; add 4 columns to `timeEntries`.
- `drizzle/rls-policies.sql` — add `client_rates` to the FOREACH array + explicit grant.
- `lib/money.ts` — add `calcItemAmount(quantity, rate)`.
- `app/api/clients/route.ts` — POST accepts `rates`, inserts in a transaction; keeps `default_rate` synced.
- `app/api/clients/[id]/route.ts` — GET returns `rates`; PUT replaces `rates` in a transaction; keeps `default_rate` synced.
- `app/api/timer/start/route.ts` — accept + snapshot `rate`/`rateLabel` (hourly).
- `app/api/entries/route.ts` (POST) + `app/api/entries/[id]/route.ts` (PUT, GET) — accept + snapshot `billingKind`/`rate`/`rateLabel`/`quantity`; item lines set `duration=0`.
- `contexts/timer-context.tsx` — fetch client hourly rates on project change; expose `timerRates`/`selectedRateId`; post snapshot on start.
- `components/timer-start-modal.tsx` — "תעריף" dropdown of hourly rates.
- `app/clients/page.tsx` — rates & items editor in the "חיוב" section of the create/edit form.
- `app/entries/page.tsx` — "סוג" toggle (שעות / פריט) + rate/item picker + quantity field; snapshot on submit & edit.
- `app/api/reports/route.ts` + `app/api/reports/excel/route.ts` — per-line amount from snapshot; `byRateLabel` breakdown.
- `app/(auth)/reports/page.tsx` — render the label breakdown in the PDF templates (read first).

---

## Shared contracts (types & signatures used across tasks)

```ts
// lib/schemas/rates.ts
export type RateKind = "hourly" | "item";
export type BillingKind = "hourly" | "item";

export interface ClientRateInput {
  kind: RateKind;        // "hourly" => ₪/hour, "item" => ₪/unit
  name: string;          // e.g. "תכנות" / "כתיבת מכתב"
  rate: number;          // >= 0
  isDefault: boolean;    // exactly one hourly row is default; items never default
}
export interface ClientRate extends ClientRateInput { id: string; }
```

- `clientRateSchema: ZodType<ClientRateInput>` and `clientRatesSchema = z.array(clientRateSchema)`.
- Entry snapshot fields on create/update bodies: `billingKind?: BillingKind | null`, `rate?: number | null`, `rateLabel?: string | null`, `quantity?: number | null`.
- `lib/money.ts` adds: `calcItemAmount(quantity: number | null | undefined, rate: number | null | undefined): number`.
- Reports effective hourly rate = `COALESCE(te.rate, c.default_rate)`; item amount = `te.quantity × te.rate`.

---

# Phase 0 — Backup & DB branch

### Task 0: Take a safety backup before any DDL

**Files:** none (ops only).

- [ ] **Step 1: Confirm which env vars exist (no values printed)**

Run:
```bash
grep -oE '^[A-Z_]+=' .env.local | sort -u
```
Expected: includes `DATABASE_URL=` and `DATABASE_URL_ADMIN=`.

- [ ] **Step 2: Create a Neon branch snapshot (preferred) OR a pg_dump**

Neon branch (neonctl is available via npx; it is logged in):
```bash
npx neonctl branches create --name pre-rate-types-2026-05-31 2>&1 | tail -20
```
Expected: a new branch row prints. If neonctl errors (auth/project ambiguity), fall back to pg_dump:
```bash
ADMIN=$(grep '^DATABASE_URL_ADMIN=' .env.local | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//')
mkdir -p ~/clockbill-backups
pg_dump "$ADMIN" --no-owner --no-privileges -f ~/clockbill-backups/dev-pre-rate-types.sql
ls -lh ~/clockbill-backups/dev-pre-rate-types.sql
```
Expected: a file > 50 KB.

- [ ] **Step 3: Verify the backup is real (fail loudly if not)**

Run (pg_dump path):
```bash
test -s ~/clockbill-backups/dev-pre-rate-types.sql && grep -c "CREATE TABLE" ~/clockbill-backups/dev-pre-rate-types.sql
```
Expected: a count ≥ 10. If 0 or file missing, STOP — the dump failed (likely `$ADMIN` empty); re-extract the var and retry. Do not run any migration without a confirmed snapshot.

---

# Phase 1 — Data model (schema + migration + RLS)

### Task 1: Add `clientRates` table + `timeEntries` snapshot columns to Drizzle schema

**Files:**
- Modify: `src/db/schema.ts` (clients block ends `:189`; timeEntries block `:252-288`)

- [ ] **Step 1: Add the `clientRates` table after the `clients` table (after line 189)**

```ts
// ─── Client Rates (hourly rates + fixed items) ──────────────────────

export const clientRates = pgTable(
  "client_rates",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    // 'hourly' => price per hour; 'item' => price per unit (billed by quantity)
    kind: text("kind").notNull().default("hourly"),
    name: text("name").notNull(),
    rate: real("rate").notNull(),
    // Preselected hourly rate for the client; items are never default.
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_client_rates_client_id").on(table.clientId),
    index("idx_client_rates_user_id").on(table.userId),
    check("client_rates_kind_check", sql`${table.kind} IN ('hourly', 'item')`),
  ]
);
```

- [ ] **Step 2: Add the 4 snapshot columns to `timeEntries` (inside the columns object, after `totalPausedTime` at line 272)**

```ts
    // Per-line billing snapshot (immune to later edits of client_rates).
    rate: real("rate"), // ₪/hour for hourly lines, ₪/unit for item lines
    rateLabel: text("rate_label"), // the rate/item name at log time
    billingKind: text("billing_kind"), // 'hourly' | 'item'; NULL => legacy hourly
    quantity: real("quantity"), // units for an item line; ignored for hourly
```

- [ ] **Step 3: Type-check the schema**

Run: `npx tsc --noEmit`
Expected: PASS (no errors). `index`/`check`/`real`/`boolean` are already imported at the top of the file.

### Task 2: Write the migration SQL

**Files:**
- Create: `drizzle/0007_per_client_rate_types.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- 0007_per_client_rate_types.sql
-- Per-client rate types & items. Applied via psql + DATABASE_URL_ADMIN
-- (drizzle migration meta is drifted; do NOT use drizzle-kit).
-- Everything that exists today is programming work ("תכנות").

BEGIN;

-- 1. New table: client_rates (holds both hourly rates and fixed items).
CREATE TABLE IF NOT EXISTS client_rates (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  client_id text NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'hourly',
  name text NOT NULL,
  rate real NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamp DEFAULT NOW(),
  updated_at timestamp DEFAULT NOW(),
  CONSTRAINT client_rates_kind_check CHECK (kind IN ('hourly', 'item'))
);
CREATE INDEX IF NOT EXISTS idx_client_rates_client_id ON client_rates(client_id);
CREATE INDEX IF NOT EXISTS idx_client_rates_user_id ON client_rates(user_id);

-- 2. Snapshot columns on time_entries.
ALTER TABLE time_entries
  ADD COLUMN IF NOT EXISTS rate real,
  ADD COLUMN IF NOT EXISTS rate_label text,
  ADD COLUMN IF NOT EXISTS billing_kind text,
  ADD COLUMN IF NOT EXISTS quantity real;

-- 3. Seed one default hourly rate per existing client = "תכנות" at its default_rate.
INSERT INTO client_rates (id, user_id, client_id, kind, name, rate, is_default, created_at, updated_at)
SELECT gen_random_uuid()::text, user_id, id, 'hourly', 'תכנות', COALESCE(default_rate, 0), true, NOW(), NOW()
FROM clients
WHERE NOT EXISTS (SELECT 1 FROM client_rates cr WHERE cr.client_id = clients.id);

-- 4. Backfill existing entries as hourly "תכנות" at their client's current rate.
--    Guard on billing_kind IS NULL (NULL for every legacy row; rate may legitimately
--    be NULL when the client's default_rate is NULL -> still falls back in reports).
UPDATE time_entries te
SET rate_label = 'תכנות',
    billing_kind = 'hourly',
    rate = c.default_rate
FROM projects p
JOIN clients c ON c.id = p.client_id
WHERE te.project_id = p.id AND te.billing_kind IS NULL;

COMMIT;
```

### Task 3: Add `client_rates` to RLS and apply policies

**Files:**
- Modify: `drizzle/rls-policies.sql:32` (the FOREACH array)

- [ ] **Step 1: Add `client_rates` to the tenant-table array (line 32)**

Change:
```sql
  FOREACH t IN ARRAY ARRAY['user_profiles','clients','projects','tasks','time_entries','report_presets']
```
to:
```sql
  FOREACH t IN ARRAY ARRAY['user_profiles','clients','projects','tasks','time_entries','report_presets','client_rates']
```

- [ ] **Step 2: Add an explicit grant for the new table at the end of the file** (belt-and-suspenders; `ALTER DEFAULT PRIVILEGES` should already cover it)

```sql
-- client_rates: explicit grant (defense in depth; default privileges also apply).
GRANT SELECT, INSERT, UPDATE, DELETE ON client_rates TO clockbill_app;
```

### Task 4: Apply migration + RLS to the dev branch and verify

**Files:** none (ops only). Prereq: Task 0 backup confirmed.

- [ ] **Step 1: Apply the migration as admin**

Run:
```bash
ADMIN=$(grep '^DATABASE_URL_ADMIN=' .env.local | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//')
psql "$ADMIN" -v ON_ERROR_STOP=1 -f drizzle/0007_per_client_rate_types.sql 2>&1 | tail -20
```
Expected: `BEGIN ... CREATE TABLE ... ALTER TABLE ... INSERT 0 N ... UPDATE M ... COMMIT` with no error.

- [ ] **Step 2: Apply the RLS policy block for client_rates** (re-running the whole file is idempotent — it `DROP POLICY IF EXISTS` then recreates)

Run:
```bash
ADMIN=$(grep '^DATABASE_URL_ADMIN=' .env.local | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//')
psql "$ADMIN" -v ON_ERROR_STOP=1 -f drizzle/rls-policies.sql 2>&1 | tail -20
```
Expected: completes without error (`GRANT`, `DO`, `ALTER TABLE`).

- [ ] **Step 3: Verify table, columns, seed, backfill, and RLS**

Run:
```bash
ADMIN=$(grep '^DATABASE_URL_ADMIN=' .env.local | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//')
psql "$ADMIN" -tA -c "
SELECT 'rates_rows', count(*) FROM client_rates
UNION ALL SELECT 'clients', count(*) FROM clients
UNION ALL SELECT 'entries_backfilled', count(*) FROM time_entries WHERE billing_kind='hourly'
UNION ALL SELECT 'entries_unbackfilled', count(*) FROM time_entries WHERE billing_kind IS NULL
UNION ALL SELECT 'rls_forced', count(*) FROM pg_class WHERE relname='client_rates' AND relforcerowsecurity
UNION ALL SELECT 'policies', count(*) FROM pg_policies WHERE tablename='client_rates';"
```
Expected: `rates_rows` == `clients`; `entries_unbackfilled` == 0; `rls_forced` == 1; `policies` == 1 (the FOR ALL `tenant_isolation`).

- [ ] **Step 4: Verify the restricted app role can read client_rates under RLS** (no leak / no lockout)

Run:
```bash
APP=$(grep '^DATABASE_URL=' .env.local | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//')
psql "$APP" -tA -c "BEGIN; SELECT set_config('app.current_user_id','__nobody__',true); SELECT count(*) FROM client_rates; COMMIT;"
```
Expected: `0` (RLS hides all rows for an unknown user — proves policy is active and the app role is not BYPASSRLS).

- [ ] **Step 5: Commit Phase 1**

```bash
git add src/db/schema.ts drizzle/0007_per_client_rate_types.sql drizzle/rls-policies.sql
git commit -m "feat(db): client_rates table + time_entries billing snapshot columns + RLS"
```

---

# Phase 2 — Shared schema, types & money helper (TDD)

### Task 5: Add `calcItemAmount` to money.ts with tests first

**Files:**
- Modify: `lib/money.ts` (append after `calcHourlyAmount`, line 50)
- Create: `tests/unit/rates.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/unit/rates.test.ts`:
```ts
/**
 * Unit tests for lib/money.ts calcItemAmount and rate-list helpers.
 */
import { calcItemAmount, sumMoney } from "../../lib/money";
import { pickDefaultHourlyRate, type ClientRate } from "../../lib/schemas/rates";

class TestRunner {
  private tests: Array<{ name: string; fn: () => void }> = [];
  private passed = 0;
  private failed = 0;
  test(name: string, fn: () => void) { this.tests.push({ name, fn }); }
  async run() {
    console.log("🧪 Running rates tests...\n");
    for (const { name, fn } of this.tests) {
      try { fn(); this.passed++; console.log(`  ✅ ${name}`); }
      catch (e) { this.failed++; console.error(`  ❌ ${name}`); if (e instanceof Error) console.error(`     ${e.message}`); }
    }
    console.log(`\n📊 Results: ${this.passed} passed, ${this.failed} failed`);
    return this.failed === 0;
  }
}
function assertEqual<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) throw new Error(message || `Expected "${expected}" but got "${actual}"`);
}

const runner = new TestRunner();

runner.test("calcItemAmount: 3 units @ 100 = 300", () => {
  assertEqual(calcItemAmount(3, 100), 300);
});
runner.test("calcItemAmount: fractional units rounds to cents", () => {
  assertEqual(calcItemAmount(2.5, 33.33), 83.33); // 83.325 -> 83.33
});
runner.test("calcItemAmount: null/zero is 0", () => {
  assertEqual(calcItemAmount(null, 100), 0);
  assertEqual(calcItemAmount(3, null), 0);
  assertEqual(calcItemAmount(0, 100), 0);
});
runner.test("calcItemAmount: summing item lines stays exact", () => {
  assertEqual(sumMoney([calcItemAmount(3, 100), calcItemAmount(2, 50)]), 400);
});

const hourly = (name: string, rate: number, isDefault: boolean): ClientRate =>
  ({ id: name, kind: "hourly", name, rate, isDefault });

runner.test("pickDefaultHourlyRate: returns the default hourly row", () => {
  const rates = [hourly("הדרכה", 200, false), hourly("תכנות", 300, true)];
  assertEqual(pickDefaultHourlyRate(rates)?.name, "תכנות");
});
runner.test("pickDefaultHourlyRate: falls back to first hourly when none default", () => {
  const rates: ClientRate[] = [
    { id: "i", kind: "item", name: "מכתב", rate: 100, isDefault: false },
    hourly("הדרכה", 200, false),
  ];
  assertEqual(pickDefaultHourlyRate(rates)?.name, "הדרכה");
});
runner.test("pickDefaultHourlyRate: null when no hourly rates", () => {
  assertEqual(pickDefaultHourlyRate([]), null);
});

runner.run().then((ok) => process.exit(ok ? 0 : 1));
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx tsx tests/unit/rates.test.ts`
Expected: FAIL — `calcItemAmount`/`pickDefaultHourlyRate` not found (module errors).

- [ ] **Step 3: Add `calcItemAmount` to `lib/money.ts`**

```ts
/**
 * Bill a fixed-price item line: quantity × unit price, rounded to whole cents.
 * Returns 0 when quantity or rate is missing/zero.
 *
 * @param quantity - Number of units billed
 * @param rate - Price per unit, or null/undefined when unset
 */
export function calcItemAmount(
  quantity: number | null | undefined,
  rate: number | null | undefined
): number {
  if (!rate || !Number.isFinite(rate)) return 0;
  if (!quantity || !Number.isFinite(quantity)) return 0;
  return roundMoney(quantity * rate);
}
```

- [ ] **Step 4: Create `lib/schemas/rates.ts` (shared types + Zod + helper)**

```ts
import { z } from "zod";

export type RateKind = "hourly" | "item";
export type BillingKind = "hourly" | "item";

export interface ClientRateInput {
  kind: RateKind;
  name: string;
  rate: number;
  isDefault: boolean;
}
export interface ClientRate extends ClientRateInput {
  id: string;
}

/** One rate/item row as accepted from the client on a client save. */
export const clientRateSchema: z.ZodType<ClientRateInput> = z.object({
  kind: z.enum(["hourly", "item"]),
  name: z.string().trim().min(1, "יש להזין שם לתעריף").max(100, "שם התעריף ארוך מדי"),
  rate: z.number().min(0, "התעריף לא יכול להיות שלילי"),
  isDefault: z.boolean(),
});

/** The full list sent on a client save (may be empty for a brand-new client). */
export const clientRatesSchema = z.array(clientRateSchema).max(100, "יותר מדי תעריפים");

/**
 * Pick the hourly rate to preselect: the one flagged default, else the first
 * hourly rate, else null (client has no hourly rates -> fall back to default_rate).
 */
export function pickDefaultHourlyRate(rates: ClientRate[]): ClientRate | null {
  const hourly = rates.filter((r) => r.kind === "hourly");
  return hourly.find((r) => r.isDefault) ?? hourly[0] ?? null;
}
```

- [ ] **Step 5: Run the test to confirm it passes**

Run: `npx tsx tests/unit/rates.test.ts`
Expected: PASS — all 8 tests green.

- [ ] **Step 6: Full type-check + test suite + commit**

Run: `npx tsc --noEmit && npm test`
Expected: PASS.
```bash
git add lib/money.ts lib/schemas/rates.ts tests/unit/rates.test.ts
git commit -m "feat(money): calcItemAmount + shared rate schemas/types/helpers"
```

---

# Phase 3 — Clients API (write folded into save, read for pickers)

### Task 6: Extend `POST /api/clients` to persist rates in a transaction

**Files:**
- Modify: `app/api/clients/route.ts`

- [ ] **Step 1: Import shared schema + transaction helper, extend the body schema**

At top, add:
```ts
import { clientRatesSchema } from "@/lib/schemas/rates";
```
Add to `createClientSchema` (after `notes`, line 26):
```ts
  rates: clientRatesSchema.nullish(),
```

- [ ] **Step 2: Replace the single `query` insert with a `withTransaction` that inserts client + rates and syncs `default_rate`**

Replace the POST body (lines 142-207) `const parsed ...` through the `return NextResponse.json({...})` with:
```ts
    const parsed = await parseBody(request, createClientSchema);
    if (!parsed.ok) return parsed.response;
    const { name, contactName, email, phone, address, defaultRate, currency, isRetainer, retainerHours, retainerMonthlyFee, overageRate, notes, rates } = parsed.data;

    const { withTransaction } = await import("@/lib/db");

    // default_rate stays in sync with the default hourly rate (legacy fallback).
    const ratesList = rates ?? [];
    const defaultHourly = ratesList.find((r) => r.kind === "hourly" && r.isDefault)
      ?? ratesList.find((r) => r.kind === "hourly");
    const effectiveDefaultRate = defaultHourly ? defaultHourly.rate : (defaultRate ?? null);

    const client = await withTransaction(async (db) => {
      const clientResult = await db.query<{
        id: string; name: string; contact_name: string | null; email: string | null;
        phone: string | null; address: string | null; default_rate: number | null;
        currency: string | null; is_retainer: boolean | null; retainer_hours: number | null;
        retainer_monthly_fee: number | null; overage_rate: number | null; notes: string | null;
        is_active: boolean; created_at: string;
      }>(
        `INSERT INTO clients (id, user_id, name, contact_name, email, phone, address, default_rate, currency, is_retainer, retainer_hours, retainer_monthly_fee, overage_rate, notes, is_active)
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, TRUE)
         RETURNING id, name, contact_name, email, phone, address, default_rate, currency, is_retainer, retainer_hours, retainer_monthly_fee, overage_rate, notes, is_active, created_at`,
        [
          user.id, name.trim(), contactName?.trim() || null, email?.trim() || null,
          phone?.trim() || null, address?.trim() || null, effectiveDefaultRate,
          currency || "ILS", isRetainer ?? false, retainerHours || null,
          retainerMonthlyFee || null, overageRate || null, notes?.trim() || null,
        ]
      );
      const row = clientResult.rows[0];

      for (const r of ratesList) {
        await db.query(
          `INSERT INTO client_rates (id, user_id, client_id, kind, name, rate, is_default)
           VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6)`,
          [user.id, row.id, r.kind, r.name.trim(), r.rate, r.kind === "hourly" ? r.isDefault : false]
        );
      }
      return row;
    });

    return NextResponse.json({
      success: true,
      client: {
        id: client.id, name: client.name, contactName: client.contact_name,
        email: client.email, phone: client.phone, address: client.address,
        defaultRate: client.default_rate, currency: client.currency || "ILS",
        isRetainer: client.is_retainer ?? false, retainerHours: client.retainer_hours,
        retainerMonthlyFee: client.retainer_monthly_fee, overageRate: client.overage_rate,
        notes: client.notes, isActive: client.is_active, createdAt: client.created_at,
      },
    });
```
(`withTransaction(async (db) => ...)` passes a `PoolClient`; call `db.query(...)` inside — RLS GUC is already bound by `withTransaction`.)

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

### Task 7: `GET /api/clients/[id]` returns rates; `PUT` replaces rates atomically

**Files:**
- Modify: `app/api/clients/[id]/route.ts`

- [ ] **Step 1: Import shared schema; extend `updateClientSchema` with `rates`**

```ts
import { clientRatesSchema } from "@/lib/schemas/rates";
```
Add to `updateClientSchema` (after `notes`, line 26): `rates: clientRatesSchema.nullish(),`

- [ ] **Step 2: In `GET`, fetch the client's rates and include them in the response**

After the client `result` block (after line 83 `const client = result.rows[0];`), add:
```ts
    const ratesResult = await query<{
      id: string; kind: string; name: string; rate: number; is_default: boolean;
    }>(
      `SELECT id, kind, name, rate, is_default
       FROM client_rates WHERE client_id = $1 AND user_id = $2
       ORDER BY kind, is_default DESC, name`,
      [clientId, user.id]
    );
    const rates = ratesResult.rows.map((r) => ({
      id: r.id, kind: r.kind as "hourly" | "item", name: r.name, rate: r.rate, isDefault: r.is_default,
    }));
```
Then add `rates,` to the returned `client: { ... }` object.

- [ ] **Step 3: In `PUT`, replace rates inside a transaction and sync `default_rate`**

Replace the body from `const parsed ...` (line 136) through the update + refetch with a `withTransaction` that: verifies ownership, updates the client (using the synced default rate), `DELETE FROM client_rates WHERE client_id=$ AND user_id=$`, then re-inserts the submitted rows. Keep the existing GET-shaped refetch (now including rates). Key snippet:
```ts
    const { name, /* ...all fields... */ rates } = parsed.data;
    const { query, withTransaction } = await import("@/lib/db");

    const ownershipCheck = await query<{ exists: boolean }>(
      `SELECT EXISTS(SELECT 1 FROM clients WHERE id = $1 AND user_id = $2) as exists`,
      [clientId, user.id]
    );
    if (!ownershipCheck.rows[0].exists) {
      return NextResponse.json({ success: false, message: "הלקוח לא נמצא" }, { status: 404 });
    }

    const ratesList = rates ?? null; // null => caller didn't manage rates; leave them untouched
    const defaultHourly = ratesList?.find((r) => r.kind === "hourly" && r.isDefault)
      ?? ratesList?.find((r) => r.kind === "hourly");
    const effectiveDefaultRate = defaultHourly ? defaultHourly.rate : (defaultRate ?? null);

    await withTransaction(async (db) => {
      await db.query(
        `UPDATE clients SET name=$1, contact_name=$2, email=$3, phone=$4, address=$5, default_rate=$6,
          currency=$7, is_retainer=$8, retainer_hours=$9, retainer_monthly_fee=$10, overage_rate=$11, notes=$12
         WHERE id=$13 AND user_id=$14`,
        [name.trim(), contactName?.trim() || null, email?.trim() || null, phone?.trim() || null,
         address?.trim() || null, effectiveDefaultRate, currency || "ILS", isRetainer ?? false,
         retainerHours || null, retainerMonthlyFee || null, overageRate || null, notes?.trim() || null,
         clientId, user.id]
      );
      if (ratesList !== null) {
        await db.query(`DELETE FROM client_rates WHERE client_id = $1 AND user_id = $2`, [clientId, user.id]);
        for (const r of ratesList) {
          await db.query(
            `INSERT INTO client_rates (id, user_id, client_id, kind, name, rate, is_default)
             VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6)`,
            [user.id, clientId, r.kind, r.name.trim(), r.rate, r.kind === "hourly" ? r.isDefault : false]
          );
        }
      }
    });
```
Then refetch the client + rates (as in GET) and return them. **Note:** `ratesList === null` (key absent) leaves rates untouched — important because `app/clients/[id]/page.tsx` PUTs without `rates`; an empty array `[]` would wipe them. The main form (`app/clients/page.tsx`) always sends an array.

- [ ] **Step 4: Type-check + build**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS.

### Task 8: Add `GET /api/clients/[id]/rates` for pickers

**Files:**
- Create: `app/api/clients/[id]/rates/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";

/**
 * GET /api/clients/[id]/rates
 * Lightweight list of a client's rates/items, for the timer & entry pickers.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ success: false, message: "לא מחובר" }, { status: 401 });
    }
    const { query } = await import("@/lib/db");
    const { id: clientId } = await params;

    const result = await query<{
      id: string; kind: string; name: string; rate: number; is_default: boolean;
    }>(
      `SELECT id, kind, name, rate, is_default
       FROM client_rates WHERE client_id = $1 AND user_id = $2
       ORDER BY kind, is_default DESC, name`,
      [clientId, user.id]
    );

    return NextResponse.json({
      success: true,
      rates: result.rows.map((r) => ({
        id: r.id, kind: r.kind as "hourly" | "item", name: r.name, rate: r.rate, isDefault: r.is_default,
      })),
    }, { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" } });
  } catch (error) {
    console.error("Error fetching client rates:", error);
    return NextResponse.json({ success: false, message: "שגיאה בטעינת התעריפים" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Build + manual API smoke test (browser/devtools while logged in)**

Run: `npm run build` (PASS), then in the app `fetch('/api/clients/<existing id>/rates').then(r=>r.json()).then(console.log)`.
Expected: `{ success: true, rates: [{ kind:'hourly', name:'תכנות', ... isDefault:true }] }` for a migrated client.

- [ ] **Step 3: Commit Phase 3**

```bash
git add app/api/clients/route.ts app/api/clients/[id]/route.ts app/api/clients/[id]/rates/route.ts
git commit -m "feat(api): persist & read per-client rates; default_rate kept in sync"
```

---

# Phase 4 — Timer & entries API snapshot

### Task 9: Snapshot rate on `POST /api/timer/start` (hourly only)

**Files:**
- Modify: `app/api/timer/start/route.ts`

- [ ] **Step 1: Extend the schema (after `description`, line 14)**

```ts
  rate: z.number().min(0).nullish(),
  rateLabel: z.string().max(100).nullish(),
```

- [ ] **Step 2: Persist the snapshot in the INSERT** (timers are always hourly)

Destructure `rate`, `rateLabel` from `parsed.data`, then change the INSERT (lines 57-62) to include the snapshot columns:
```ts
    const result = await query<{ id: string }>(
      `INSERT INTO time_entries (id, user_id, project_id, task_id, description, start_time, date, duration, is_billable, billing_kind, rate, rate_label)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, 0, TRUE, 'hourly', $7, $8)
       RETURNING id`,
      [userId, projectId, taskId || null, description || '', now.toISOString(), today, rate ?? null, rateLabel?.trim() || null]
    );
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

### Task 10: Snapshot billing fields on entry create/update

**Files:**
- Modify: `app/api/entries/route.ts` (POST), `app/api/entries/[id]/route.ts` (PUT + GET projection)

- [ ] **Step 1: Extend `createEntrySchema` and make `duration` valid for item lines**

In `app/api/entries/route.ts`, replace `duration` and add snapshot fields:
```ts
  // hourly lines use duration (minutes); item lines use quantity with duration 0.
  duration: z.number({ message: "נא להזין משך זמן תקין" }).min(0),
  billingKind: z.enum(["hourly", "item"]).nullish(),
  rate: z.number().min(0).nullish(),
  rateLabel: z.string().max(100).nullish(),
  quantity: z.number().min(0).nullish(),
```
Add a refinement after the object so an item needs quantity and an hourly needs positive duration:
```ts
}).refine(
  (d) => d.billingKind === "item" ? (d.quantity ?? 0) > 0 : d.duration > 0,
  { message: "נא להזין כמות לפריט או משך זמן לשעות", path: ["duration"] }
);
```

- [ ] **Step 2: Persist snapshot in the POST INSERT**

Destructure the new fields. Compute `const kind = billingKind ?? "hourly";` and `const effectiveDuration = kind === "item" ? 0 : duration;`. Change the INSERT column list/values to add `billing_kind, rate, rate_label, quantity` and use `effectiveDuration`:
```ts
      `INSERT INTO time_entries (id, user_id, project_id, task_id, description, start_time, end_time, duration, date, tags, notes, is_billable, billing_kind, rate, rate_label, quantity)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [ entryId, user.id, projectId, taskId || null, description.trim(),
        now.toISOString(), endTime.toISOString(), effectiveDuration, date,
        JSON.stringify(tags || []), notes?.trim() || null,
        isBillable !== undefined ? isBillable : true,
        kind, rate ?? null, rateLabel?.trim() || null, kind === "item" ? (quantity ?? null) : null ]
```
(For item lines `endTime = now + 0`, which is fine.)

- [ ] **Step 3: Add the snapshot columns to the POST refetch projection and JSON**

Add `te.billing_kind, te.rate, te.rate_label, te.quantity` to the SELECT and map them to `billingKind`, `rate`, `rateLabel`, `quantity` in the returned `entry`.

- [ ] **Step 4: Mirror the same in `PUT /api/entries/[id]`**

Apply the identical `updateEntrySchema` changes (duration min 0 + 4 snapshot fields + refine), compute `kind`/`effectiveDuration`, and change the UPDATE to also set `billing_kind=$, rate=$, rate_label=$, quantity=$` and `duration=effectiveDuration`. Add the 4 columns to the refetch SELECT + JSON (both GET and PUT in this file).

- [ ] **Step 5: Type-check + build + test**

Run: `npx tsc --noEmit && npm run build && npm test`
Expected: PASS.

- [ ] **Step 6: Commit Phase 4**

```bash
git add app/api/timer/start/route.ts app/api/entries/route.ts app/api/entries/[id]/route.ts
git commit -m "feat(api): snapshot billing kind/rate/label/quantity on timer & entries"
```

---

# Phase 5 — Timer context: rate picker on project select

### Task 11: Fetch the selected project's client hourly rates and expose them

**Files:**
- Modify: `contexts/timer-context.tsx`

- [ ] **Step 1: Import the helper + types**

```ts
import { pickDefaultHourlyRate, type ClientRate } from "@/lib/schemas/rates";
```

- [ ] **Step 2: Extend `TimerContextValue` (after `timerTasks`, line 60) and the default value**

Add to the interface:
```ts
  /** Hourly rates of the selected project's client (for the "תעריף" dropdown). */
  timerRates: ClientRate[];
  selectedRateId: string;
  setSelectedRateId: (id: string) => void;
```
Add to `defaultTimerValue`: `timerRates: [], selectedRateId: "", setSelectedRateId: noop,`.

- [ ] **Step 3: Add state**

```ts
  const [timerRates, setTimerRates] = useState<ClientRate[]>([]);
  const [selectedRateId, setSelectedRateId] = useState("");
```

- [ ] **Step 4: When `selectedProject` changes, fetch that client's rates and preselect the default hourly**

Add an effect (next to the tasks effect, ~line 247). Resolve the client via the in-memory `projects` list (`projects.find(p => p.id === selectedProject)?.clientId`), then `GET /api/clients/{clientId}/rates`:
```ts
  useEffect(() => {
    if (!selectedProject) { setTimerRates([]); setSelectedRateId(""); return; }
    const clientId = projects.find((p) => p.id === selectedProject)?.clientId;
    if (!clientId) { setTimerRates([]); setSelectedRateId(""); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/clients/${clientId}/rates`);
        const data = await res.json();
        if (cancelled || !data.success) return;
        const hourly: ClientRate[] = (data.rates || []).filter((r: ClientRate) => r.kind === "hourly");
        setTimerRates(hourly);
        setSelectedRateId(pickDefaultHourlyRate(hourly)?.id ?? "");
      } catch (e) { console.error("Error fetching client rates for timer:", e); }
    })();
    return () => { cancelled = true; };
  }, [selectedProject, projects]);
```

- [ ] **Step 5: Send the snapshot in `handleStartTimer`**

In the POST body (line 339), add the chosen rate/label:
```ts
        body: JSON.stringify({
          projectId: selectedProject,
          taskId: selectedTask || null,
          description: timerDescription || null,
          rate: timerRates.find((r) => r.id === selectedRateId)?.rate ?? null,
          rateLabel: timerRates.find((r) => r.id === selectedRateId)?.name ?? null,
        }),
```
Reset `setSelectedRateId("")` in the success block alongside the other resets. Add `selectedRateId` and `timerRates` to the `handleStartTimer` `useCallback` deps.

- [ ] **Step 6: Expose the new values in the `value` object** (`timerRates, selectedRateId, setSelectedRateId`).

- [ ] **Step 7: Type-check + build**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS.
```bash
git add contexts/timer-context.tsx
git commit -m "feat(timer): load client hourly rates and snapshot the chosen rate on start"
```

---

# Phase 6 — Client form: rates & items editor

### Task 12: Replace the single "תעריף שעתי" field with a rates & items editor

**Files:**
- Modify: `app/clients/page.tsx`

- [ ] **Step 1: Import types/helper + extend `formData` shape**

```ts
import type { ClientRate, ClientRateInput, RateKind } from "@/lib/schemas/rates";
```
Add a `rates: ClientRateInput[]` field to the `formData` useState initial object (and to both reset objects in `handleCancelEdit` and the post-save reset): `rates: [],`.

- [ ] **Step 2: On edit, load the client's rates from the API** (the list endpoint doesn't return rates)

In `handleEdit(client)`, before `setShowForm(true)`, fetch and seed:
```ts
    try {
      const res = await fetch(`/api/clients/${client.id}/rates`);
      const data = await res.json();
      const loaded: ClientRateInput[] = data.success
        ? (data.rates as ClientRate[]).map((r) => ({ kind: r.kind, name: r.name, rate: r.rate, isDefault: r.isDefault }))
        : [];
      setFormData((prev) => ({ ...prev, rates: loaded }));
    } catch { /* leave rates empty on failure */ }
```
(Make `handleEdit` `async`.) For a brand-new client, default `rates` to one row: when opening the create form, if `rates` is empty, seed `[{ kind: "hourly", name: "תכנות", rate: 0, isDefault: true }]`.

- [ ] **Step 3: Add rate-row helpers inside the component**

```ts
  const addRate = (kind: RateKind) =>
    setFormData((p) => ({
      ...p,
      rates: [...p.rates, { kind, name: "", rate: 0, isDefault: kind === "hourly" && !p.rates.some((r) => r.kind === "hourly" && r.isDefault) }],
    }));
  const removeRate = (idx: number) =>
    setFormData((p) => ({ ...p, rates: p.rates.filter((_, i) => i !== idx) }));
  const updateRate = (idx: number, patch: Partial<ClientRateInput>) =>
    setFormData((p) => ({ ...p, rates: p.rates.map((r, i) => (i === idx ? { ...r, ...patch } : r)) }));
  const setDefaultRate = (idx: number) =>
    setFormData((p) => ({ ...p, rates: p.rates.map((r, i) => ({ ...r, isDefault: i === idx && r.kind === "hourly" })) }));
```

- [ ] **Step 4: Render the editor inside the "חיוב" fieldset, replacing the single `defaultRate` input (lines 497-521)**

Render two groups — hourly rates (each row: name input, rate input with "₪ לשעה" suffix via `CURRENCY_SYMBOLS`, a default ★ radio, remove ✕) and items (name input, rate input "₪ ליחידה", remove ✕) — using `fieldClass()`. Add "+ הוסף תעריף שעתי" and "+ הוסף פריט" buttons (`addRate("hourly")` / `addRate("item")`). Keep it inside `{!formData.isRetainer && (...)}`? **No** — per spec, the rates list applies to retainer clients too (hourly/overage work). Show the editor always; keep retainer fields as-is. Example hourly row:
```tsx
{formData.rates.map((r, idx) => r.kind === "hourly" && (
  <div key={idx} className="flex items-center gap-2">
    <input type="radio" name="defaultHourly" checked={r.isDefault}
      onChange={() => setDefaultRate(idx)} className="h-4 w-4 accent-primary" aria-label="תעריף ברירת מחדל" />
    <input type="text" value={r.name} onChange={(e) => updateRate(idx, { name: e.target.value })}
      placeholder="שם (למשל תכנות)" className={fieldClass(false)} disabled={submitting} />
    <div className="relative">
      <input type="number" min="0" step="0.01" value={r.rate || ""}
        onChange={(e) => updateRate(idx, { rate: parseFloat(e.target.value) || 0 })}
        className={`${fieldClass(false)} font-mono pe-12`} disabled={submitting} placeholder="0.00" />
      <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-xs text-muted-foreground">
        {CURRENCY_SYMBOLS[formData.currency] || "₪"} לשעה
      </span>
    </div>
    <button type="button" onClick={() => removeRate(idx)} className="shrink-0 text-destructive" aria-label="הסר">✕</button>
  </div>
))}
```
(Items mirror this without the default radio, suffix "ליחידה".)

- [ ] **Step 5: Send `rates` on submit** (POST and PUT both go through `handleSubmit`)

In the `body: JSON.stringify({...})` (line 188), add:
```ts
          rates: formData.rates
            .filter((r) => r.name.trim() !== "")
            .map((r) => ({ kind: r.kind, name: r.name.trim(), rate: r.rate, isDefault: r.kind === "hourly" && r.isDefault })),
```
Also keep sending `defaultRate` — the server overrides it with the default hourly rate, so it's harmless; or drop it. Add a client-side guard: if there are hourly rates but none is marked default, mark the first hourly as default before sending.

- [ ] **Step 6: Empty/validation states** — if a row has a name but rate 0, that's allowed (free item). Block submit only if a row has a rate but empty name (inline message "יש להזין שם לתעריף"). Show an empty hint when `rates` is empty ("לא הוגדרו תעריפים — ייעשה שימוש בתעריף ברירת המחדל").

- [ ] **Step 7: Type-check + build + browser check**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS. Then in-browser: create a client with two hourly rates (תכנות 300 default, הדרכה 200) + one item (מכתב 100); reopen edit → rows persist; `GET /api/clients/<id>/rates` returns all three.
```bash
git add app/clients/page.tsx
git commit -m "feat(clients): rates & items editor in the client form"
```

---

# Phase 7 — Timer start modal: rate dropdown

### Task 13: Add the "תעריף" dropdown to the start modal

**Files:**
- Modify: `components/timer-start-modal.tsx`

- [ ] **Step 1: Pull the new context values**

Add `timerRates, selectedRateId, setSelectedRateId` to the `useTimer()` destructure.

- [ ] **Step 2: Render the dropdown after the task select (only when the client has ≥1 hourly rate)**

```tsx
{selectedProject && timerRates.length > 0 && (
  <div>
    <label htmlFor="timer-rate" className="block text-sm font-medium text-foreground mb-1">תעריף</label>
    <select id="timer-rate" value={selectedRateId} onChange={(e) => setSelectedRateId(e.target.value)}
      className="w-full rounded-[var(--radius)] border border-border bg-background px-3 py-2.5 text-sm focus:border-primary focus:ring-1 focus:ring-primary"
      disabled={startingTimer}>
      {timerRates.map((r) => (
        <option key={r.id} value={r.id}>{r.name} — {r.rate}/שעה</option>
      ))}
    </select>
  </div>
)}
```
(Zero-friction: a single hourly rate is auto-selected by the context; no rates → dropdown hidden, server falls back to `default_rate`.)

- [ ] **Step 3: Build + browser check**

Run: `npm run build` (PASS). Start a timer for a client with two rates → pick "הדרכה" → stop → confirm the saved entry has `rate=200, rate_label='הדרכה', billing_kind='hourly'` (verify via `psql` or `/api/entries/<id>`).
```bash
git add components/timer-start-modal.tsx
git commit -m "feat(timer): rate dropdown in the start modal"
```

---

# Phase 8 — Entries page: type toggle + rate/item picker

### Task 14: Add "סוג" (שעות/פריט), rate/item dropdown, and quantity field

**Files:**
- Modify: `app/entries/page.tsx`

- [ ] **Step 1: Extend `formData` and add rates state**

Add to `formData` initial + both resets: `billingKind: "hourly" as "hourly" | "item", rateId: "", quantity: ""`. Add:
```ts
  const [formRates, setFormRates] = useState<ClientRate[]>([]);
```
Import `import { pickDefaultHourlyRate, type ClientRate } from "@/lib/schemas/rates";`.

- [ ] **Step 2: When the form's project changes, fetch that project's client rates**

The page already has `projects` (with `clientId`). Add an effect keyed on `formData.projectId`:
```ts
  useEffect(() => {
    const clientId = projects.find((p) => p.id === formData.projectId)?.clientId;
    if (!clientId) { setFormRates([]); return; }
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/clients/${clientId}/rates`);
      const data = await res.json();
      if (cancelled || !data.success) return;
      setFormRates(data.rates as ClientRate[]);
    })();
    return () => { cancelled = true; };
  }, [formData.projectId, projects]);
```
When `billingKind`/project changes, preselect: hourly → `pickDefaultHourlyRate(formRates.filter hourly)`, item → first item rate.

- [ ] **Step 3: Render the "סוג" toggle + conditional fields**

Add a segmented toggle (two buttons: "שעות" / "פריט", active = `bg-primary text-primary-foreground`). When `billingKind==="hourly"`: show the existing duration field **plus** a "תעריף" dropdown of hourly rates. When `"item"`: hide duration, show an "פריט" dropdown of item rates **and** a "כמות" number field bound to `formData.quantity`. Reuse the existing form styling classes already in this file.

- [ ] **Step 4: Snapshot on submit**

In the `body: JSON.stringify({...})` (line 295), compute the chosen rate and send the snapshot:
```ts
          billingKind: formData.billingKind,
          duration: formData.billingKind === "item" ? 0 : parseInt(formData.duration, 10),
          quantity: formData.billingKind === "item" ? parseFloat(formData.quantity) || 0 : null,
          rate: chosen?.rate ?? null,
          rateLabel: chosen?.name ?? null,
```
where `const chosen = formRates.find((r) => r.id === formData.rateId);`. Update client-side validation: for item require `quantity > 0` and a selected item; for hourly require `duration > 0` (existing).

- [ ] **Step 5: On edit, seed billing fields from the entry**

`handleEdit(entry)` must set `billingKind: entry.billingKind ?? "hourly"`, `quantity: entry.quantity?.toString() ?? ""`, and resolve `rateId` by matching `entry.rateLabel`+`kind` against `formRates` once they load (match by name+kind). Add `billingKind`, `rate`, `rateLabel`, `quantity` to the `TimeEntry` interface (lines 39-58).

- [ ] **Step 6: Show kind/label in the entries table**

In the duration cell, for item lines render `{entry.quantity} יח׳` instead of `formatDuration`, and show the `rateLabel` as a small muted tag for all lines.

- [ ] **Step 7: Type-check + build + browser check**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS. Add an item line ("כתיבת מכתב", qty 3) → row shows "3 יח׳"; edit it → fields repopulate; DB row has `billing_kind='item', quantity=3, rate=100, duration=0`.
```bash
git add app/entries/page.tsx
git commit -m "feat(entries): hours/item toggle with rate & quantity snapshot"
```

---

# Phase 9 — Reports API: per-line amount from snapshot + label breakdown

### Task 15: Update `app/api/reports/route.ts`

**Files:**
- Modify: `app/api/reports/route.ts`

- [ ] **Step 1: Import `calcItemAmount`** alongside `calcHourlyAmount` (line 4):
```ts
import { addMoney, calcHourlyAmount, calcItemAmount } from "@/lib/money";
```

- [ ] **Step 2: Select the snapshot columns** — add to the SELECT (after `te.is_billable`, ~line 43):
```ts
        te.billing_kind,
        te.rate,
        te.rate_label,
        te.quantity,
```
and add to the result row type: `billing_kind: string | null; rate: number | null; rate_label: string | null; quantity: number | null;`.

- [ ] **Step 3: Compute amount per line from the snapshot** (replace line 112):
```ts
      const isItem = entry.billing_kind === "item";
      const effectiveRate = entry.rate ?? entry.hourly_rate; // COALESCE(te.rate, default_rate)
      const amount = isItem
        ? calcItemAmount(entry.quantity, entry.rate)
        : calcHourlyAmount(entry.duration, effectiveRate);
```
Add to each mapped entry: `billingKind: entry.billing_kind ?? "hourly"`, `rateLabel: entry.rate_label, quantity: entry.quantity`, and set `hourlyRate: effectiveRate`.

- [ ] **Step 4: Add a `byRateLabel` aggregation** (after `byWeek`, ~line 298):
```ts
    const byRateLabel = entries.reduce((acc, entry) => {
      const label = entry.rateLabel || "—";
      const key = `${label}|${entry.currency || "ILS"}`;
      if (!acc[key]) {
        acc[key] = {
          label, kind: entry.billingKind, currency: entry.currency || "ILS",
          totalMinutes: 0, totalQuantity: 0, totalAmount: 0, entryCount: 0,
        };
      }
      acc[key].entryCount += 1;
      if (entry.billingKind === "item") acc[key].totalQuantity += entry.quantity || 0;
      else acc[key].totalMinutes += entry.duration;
      acc[key].totalAmount = addMoney(acc[key].totalAmount, entry.amount || 0);
      return acc;
    }, {} as Record<string, { label: string; kind: string; currency: string; totalMinutes: number; totalQuantity: number; totalAmount: number; entryCount: number; }>);
```
Add `byRateLabel: Object.values(byRateLabel)` to the returned `report`.

- [ ] **Step 5: Type-check + build**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS. Old entries (now `billing_kind='hourly'`, `rate` = their client's rate or NULL→falls back) bill identically to before.

### Task 16: Update `app/api/reports/excel/route.ts`

**Files:**
- Modify: `app/api/reports/excel/route.ts`

- [ ] **Step 1: Import `calcItemAmount`; select + type the snapshot columns** (same 4 columns as Task 15 Step 2).

- [ ] **Step 2: Per-row amount + a unit column.** In the `result.rows.forEach` (line 143): compute `isItem`, `effectiveRate = entry.rate ?? entry.hourly_rate`, `amount = isItem ? calcItemAmount(entry.quantity, entry.rate) : calcHourlyAmount(entry.duration, effectiveRate)`. Add columns "סוג" (`isItem ? "פריט" : "שעות"`), "תווית" (`entry.rate_label`), "כמות" (`isItem ? entry.quantity : ""`) and set "תעריף שעתי" to `effectiveRate`.

- [ ] **Step 3: Add a "פירוט לפי תווית" worksheet** mirroring the `byRateLabel` aggregation: columns תווית / סוג / שעות-או-כמות / מטבע / סכום. Hourly rows show hours (`totalMinutes/60`), item rows show `totalQuantity` units.

- [ ] **Step 4: Build + browser check**

Run: `npm run build` (PASS). Export Excel for a client with mixed hourly + item entries → amounts correct; "פירוט לפי תווית" sheet groups by label.
```bash
git add app/api/reports/route.ts app/api/reports/excel/route.ts
git commit -m "feat(reports): bill from snapshot (hourly+item) and add by-label breakdown"
```

---

# Phase 10 — Reports UI / PDF: render the label breakdown

### Task 17: Show the by-label breakdown + item lines in the report page & PDF templates

**Files:**
- Modify: `app/(auth)/reports/page.tsx`

- [ ] **Step 1: Read the file first** (it holds the 6 PDF templates + on-screen report)

Run: open `app/(auth)/reports/page.tsx`. Identify: the `report` data type, where entry rows render (duration/amount), and each PDF template's section list. This task's exact JSX depends on that structure — map it before editing.

- [ ] **Step 2: Extend the report TS type** consumed by the page with `byRateLabel: { label; kind; currency; totalMinutes; totalQuantity; totalAmount; entryCount }[]` and add `billingKind`, `rateLabel`, `quantity` to the per-entry type.

- [ ] **Step 3: On-screen — add a "פירוט לפי תווית" section** (loading/empty/success states): a table of label · (hours or "N יח׳") · amount, grouped by currency. For item entries in any entry list, render `quantity` יח׳ instead of duration and show the `rateLabel`.

- [ ] **Step 4: PDF templates — add the breakdown block** to each of the 6 templates (a compact "פירוט לפי תווית" table: `תכנות — 3.0ש׳ — ₪900`, `כתיבת מכתב — 3 יח׳ — ₪300`). Keep PDF pages light-themed (the documented exception to the dark-token rule). Entries with no label fall under "—".

- [ ] **Step 5: Type-check + build + visual check**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS. Generate each PDF template for a mixed report → label breakdown appears, totals = hourly + item + fixed-monthly.
```bash
git add "app/(auth)/reports/page.tsx"
git commit -m "feat(reports): by-label breakdown + item lines in report UI and PDF templates"
```

---

# Phase 11 — End-to-end verification & deploy

### Task 18: Full regression + ship

**Files:** none.

- [ ] **Step 1: Full gate**

Run: `npx tsc --noEmit && npm run build && npm test`
Expected: all PASS.

- [ ] **Step 2: Backward-compat spot check** (a client/entry that predates the feature)

Run:
```bash
ADMIN=$(grep '^DATABASE_URL_ADMIN=' .env.local | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//')
psql "$ADMIN" -tA -c "SELECT billing_kind, rate_label, count(*) FROM time_entries GROUP BY 1,2 ORDER BY 3 DESC LIMIT 10;"
```
Expected: legacy rows are `hourly | תכנות`. Generate a report covering them → amounts unchanged vs. before the feature.

- [ ] **Step 3: E2E happy path in-browser**

Create client with תכנות(300,default)+הדרכה(200)+item מכתב(100) → start timer on הדרכה, stop → manual hourly entry on תכנות → manual item entry מכתב qty 2 → report shows three labels with correct amounts (e.g. הדרכה Xש׳, תכנות Yש׳, מכתב 2 יח׳=₪200) → PDF + Excel match.

- [ ] **Step 4: Prod migration prerequisite (do NOT skip)**

The migration ran on the **dev** branch. Before deploy, apply `drizzle/0007_*.sql` and the `client_rates` block of `rls-policies.sql` to the **prod (main)** Neon branch using prod `DATABASE_URL_ADMIN` (take a prod snapshot first). Confirm seed+backfill counts on prod as in Task 4 Step 3. Verify Vercel envs: `DATABASE_URL`=clockbill_app, `DATABASE_URL_ADMIN`=neondb_owner.

- [ ] **Step 5: Deploy**

```bash
git push origin main
```
Vercel auto-deploys. Smoke-test prod: open a client, see the seeded "תכנות" rate; generate a report.

---

## Self-Review

**Spec coverage:**
- Data model `client_rates` (kind/name/rate/is_default + indexes + RLS) → Tasks 1,2,3,4. ✅
- `time_entries` snapshot columns (rate/rate_label/billing_kind/quantity) → Tasks 1,2. ✅
- `clients.default_rate` retained + kept in sync → Tasks 6,7. ✅
- Managing rates in client form (hourly + items, default radio, currency suffix) → Task 12. ✅
- Timer rate dropdown (hourly only, default preselected, snapshot) → Tasks 11,13. ✅
- Manual entry/edit toggle (שעות/פריט + quantity) → Task 14. ✅
- Zero-friction fallback (1 rate auto-select, 0 rates → default_rate) → Tasks 11,13 (context), reports COALESCE Task 15. ✅
- Reports per-line amount (hourly COALESCE, item quantity×rate) + by-label breakdown (PDF+Excel) → Tasks 15,16,17. ✅
- Migration: seed "תכנות" per client, backfill entries, backward compat → Tasks 2,4. ✅
- RLS FORCE + policies + grants for client_rates → Tasks 3,4. ✅
- Read/write API decision (fold writes into client save; dedicated GET rates for pickers) → Tasks 6,7,8. ✅

**Placeholder scan:** Task 17 (PDF templates) is intentionally read-first because the 6 templates' JSX must be mapped before editing; all code-bearing steps elsewhere include concrete code. No TBD/TODO left.

**Type consistency:** `ClientRateInput`/`ClientRate`, `RateKind`/`BillingKind`, `pickDefaultHourlyRate`, `calcItemAmount`, and the `rate`/`rateLabel`/`billingKind`/`quantity` snapshot field names are used identically across schema, money, API, context, and UI tasks. `withTransaction((db) => db.query(...))` matches `lib/db.ts`. `GET /api/clients/[id]/rates` response (`{ success, rates: [{id,kind,name,rate,isDefault}] }`) is consumed identically by Tasks 11, 12, 14.

**Risks / watch-items:**
1. PUT `/api/clients/[id]` treats **absent** `rates` as "leave untouched" and `[]` as "wipe" — the `[id]` detail form (`app/clients/[id]/page.tsx`) PUTs without `rates`, so its saves won't clobber rates. ✅ (documented in Task 7 Step 3).
2. `npm test` runner auto-discovers `tests/unit/*.test.ts` → `rates.test.ts` is picked up automatically (Task 5).
3. `zod` is a transitive dep used by existing routes — new routes/schemas import it the same way.
