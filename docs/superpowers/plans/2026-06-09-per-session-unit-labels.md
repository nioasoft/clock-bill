# Per-Session Unit Labels + Profession Starter Items — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Item rates get an optional `unit` label ("פגישה"/"מילה"/"יום") that snapshots through entry → charge-doc line so reports read "3 × פגישה"; session-professions get starter item rows prefilled on the first client; a static pre-VAT note appears on reports/charge docs.

**Architecture:** Three nullable `unit text` columns (`client_rates`, `time_entries`, `charge_document_lines`) ride the existing item infrastructure — no new billing kind. The unit is **client-sent** exactly like `rate_label` (the server never resolves it from `client_rates`). Aggregated report rows that sum quantities across entries stay generic ("יח׳"); only per-entry/per-line rendering is unit-aware.

**Tech Stack:** Next.js 16 App Router, raw `pg` via `lib/db.ts` (`$1..$n` placeholders), Zod, next-intl (he+en parity), custom test runner (`npx tsx tests/unit/<file>.test.ts`).

**Spec:** `docs/superpowers/specs/2026-06-09-per-session-unit-labels-design.md`

**Conventions that apply to every task:**
- All UI strings via next-intl keys in BOTH `messages/he.json` and `messages/en.json` (parity test enforces this).
- Design tokens only (`text-muted-foreground`, `fieldClass(...)`, `rounded-[var(--radius)]`) — no raw colors except inside the PDF/print regions which are intentionally light.
- Migrations: **psql with `DATABASE_URL_ADMIN` only** — Drizzle journal is drifted, never `db:migrate`/`db:push`. DEV now; PROD only after explicit owner approval (final task).
- Every DB query keeps its `user_id` filter (defense in depth on top of RLS).

---

### Task 1: DB migration (DEV) + Drizzle schema columns

**Files:**
- Create: `drizzle/0020_unit_labels.sql`
- Modify: `src/db/schema.ts` (tables `clientRates` ~line 216, `timeEntries` ~line 318, `chargeDocumentLines` ~line 478)

- [ ] **Step 1: Write the migration file**

```sql
-- 0020: per-session unit labels (nullable -> fully backward-compatible).
-- unit = the per-unit noun for an item rate ("פגישה"/"מילה"/"יום").
-- Snapshots: client_rates (source) -> time_entries (at log time) -> charge_document_lines (at issue time).
ALTER TABLE client_rates ADD COLUMN IF NOT EXISTS unit text;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS unit text;
ALTER TABLE charge_document_lines ADD COLUMN IF NOT EXISTS unit text;
```

- [ ] **Step 2: Apply to DEV via psql (admin role)**

Run from the project root:
```bash
eval "$(grep '^DATABASE_URL_ADMIN=' .env.local)" && psql "$DATABASE_URL_ADMIN" -f drizzle/0020_unit_labels.sql
```
Expected: three `ALTER TABLE` lines, no errors.

- [ ] **Step 3: Verify the columns exist**

```bash
psql "$DATABASE_URL_ADMIN" -c "\d client_rates" | grep unit && psql "$DATABASE_URL_ADMIN" -c "\d time_entries" | grep unit && psql "$DATABASE_URL_ADMIN" -c "\d charge_document_lines" | grep unit
```
Expected: ` unit | text ...` in each output. (New nullable columns on RLS-policied tables need no policy changes — policies are row-scoped.)

- [ ] **Step 4: Mirror in `src/db/schema.ts` (descriptive only)**

In `clientRates`, after the `isDefault` line:
```typescript
    // Per-unit noun for an item rate ("פגישה"/"מילה"). NULL for hourly (implicit "שעה").
    unit: text("unit"),
```

In `timeEntries`, after the `rateLabel` line:
```typescript
    unit: text("unit"), // item unit-noun snapshot at log time (mirrors rate_label)
```

In `chargeDocumentLines`, after the `quantity` line:
```typescript
    unit: text("unit"), // item unit-noun snapshot at issue time
```

- [ ] **Step 5: Build still green**

Run: `npm run lint`
Expected: no errors/warnings.

- [ ] **Step 6: Commit**

```bash
git add drizzle/0020_unit_labels.sql src/db/schema.ts
git commit -m "feat(db): nullable unit columns on client_rates/time_entries/charge_document_lines (migration 0020, DEV applied)"
```

---

### Task 2: Rate schemas accept `unit` (TDD)

**Files:**
- Modify: `lib/schemas/rates.ts`
- Test: `tests/unit/rates.test.ts`

- [ ] **Step 1: Write the failing tests**

In `tests/unit/rates.test.ts`, extend the import at the top:
```typescript
import { pickDefaultHourlyRate, cleanClientRates, clientRateSchema, type ClientRate } from "../../lib/schemas/rates";
```
Append before the final `runner.run()` block:
```typescript
runner.test("clientRateSchema: item with unit validates and trims", () => {
  const r = clientRateSchema.safeParse({ kind: "item", name: "פגישה", rate: 400, isDefault: false, unit: " פגישה " });
  assertEqual(r.success, true);
  if (r.success) assertEqual(r.data.unit, "פגישה");
});
runner.test("clientRateSchema: rate without unit still validates", () => {
  const r = clientRateSchema.safeParse({ kind: "hourly", name: "תכנות", rate: 300, isDefault: true });
  assertEqual(r.success, true);
  if (r.success) assertEqual(r.data.unit ?? null, null);
});
runner.test("clientRateSchema: rejects unit longer than 30 chars", () => {
  const r = clientRateSchema.safeParse({ kind: "item", name: "פגישה", rate: 400, isDefault: false, unit: "א".repeat(31) });
  assertEqual(r.success, false);
});
runner.test("cleanClientRates: carries unit through, nulls empty unit", () => {
  const out = cleanClientRates([
    { kind: "item", name: "פגישה", rate: 400, isDefault: false, unit: "פגישה" },
    { kind: "item", name: "מכתב", rate: 100, isDefault: false, unit: "  " },
  ]);
  assertEqual(out[0].unit, "פגישה");
  assertEqual(out[1].unit ?? null, null);
});
```

- [ ] **Step 2: Run — verify it fails**

Run: `npx tsx tests/unit/rates.test.ts`
Expected: FAIL (tsx type/compile error: `clientRateSchema` not exported is already exported — the failures are `unit` not on `ClientRateInput` / unknown key stripped, so the trim assertion fails).

- [ ] **Step 3: Implement in `lib/schemas/rates.ts`**

`ClientRateInput` gains the optional field:
```typescript
export interface ClientRateInput {
  kind: RateKind;
  name: string;
  rate: number;
  isDefault: boolean;
  /** Per-unit noun for an item rate ("פגישה"/"מילה"). Hourly rows leave it unset. */
  unit?: string | null;
}
```

`clientRateSchema` gains the key (inside the `z.object({...})`):
```typescript
  unit: z.string().trim().max(30, "שם היחידה ארוך מדי").nullish(),
```

`addClientItemSchema` gains the same key:
```typescript
  unit: z.string().trim().max(30, "שם היחידה ארוך מדי").nullish(),
```

`cleanClientRates` carries it through — the `.map()` body becomes:
```typescript
    .map((r) => ({
      kind: r.kind,
      name: r.name.trim(),
      rate: r.rate,
      isDefault: r.kind === "hourly" && r.isDefault,
      unit: r.unit?.trim() || null,
    }));
```

- [ ] **Step 4: Run — verify it passes**

Run: `npx tsx tests/unit/rates.test.ts`
Expected: all PASS (old + 4 new).

- [ ] **Step 5: Commit**

```bash
git add lib/schemas/rates.ts tests/unit/rates.test.ts
git commit -m "feat(rates): optional unit label on rate schemas + cleanClientRates passthrough"
```

---

### Task 3: Entry body schema accepts `unit` (TDD)

**Files:**
- Modify: `lib/schemas/entries.ts`
- Test: `tests/unit/entry-item.test.ts`

- [ ] **Step 1: Write the failing tests**

`tests/unit/entry-item.test.ts` uses a `runner.test(name, fn)` pattern with `assert(cond, msg)` and a `base` fixture (`{ projectId, date, description }`). Append before the run block at the bottom:
```typescript
// ── unit label (optional snapshot on item lines) ────────────────────────────
runner.test("item: unit validates and is trimmed", () => {
  const r = entryBodySchema.safeParse({
    ...base, billingKind: "item", duration: 0, quantity: 2, rate: 400, rateLabel: "פגישה", unit: " פגישה ",
  });
  assert(r.success, "item entry with unit should validate");
  if (r.success) assert(r.data.unit === "פגישה", `unit should be trimmed, got "${r.data.unit}"`);
});
runner.test("item: unit is optional", () => {
  const r = entryBodySchema.safeParse({
    ...base, billingKind: "item", duration: 0, quantity: 2, rate: 400, rateLabel: "פגישה",
  });
  assert(r.success, "item entry without unit should still validate");
});
runner.test("item: rejects unit longer than 30 chars", () => {
  const r = entryBodySchema.safeParse({
    ...base, billingKind: "item", duration: 0, quantity: 2, rate: 400, rateLabel: "פגישה", unit: "א".repeat(31),
  });
  assert(!r.success, "31-char unit should be rejected");
});
```

- [ ] **Step 2: Run — verify it fails**

Run: `npx tsx tests/unit/entry-item.test.ts`
Expected: FAIL — `unit` is stripped by the schema (trim assertion fails).

- [ ] **Step 3: Implement**

In `lib/schemas/entries.ts`, inside the `z.object({...})`, after the `rateLabel` line:
```typescript
    unit: z.string().trim().max(30).nullish(),
```

- [ ] **Step 4: Run — verify it passes**

Run: `npx tsx tests/unit/entry-item.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/schemas/entries.ts tests/unit/entry-item.test.ts
git commit -m "feat(entries): entry body schema accepts optional unit snapshot"
```

---

### Task 4: `buildLineFromEntry` carries `unit` (TDD)

**Files:**
- Modify: `lib/charge-documents.ts`
- Test: `tests/unit/charge-documents.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/unit/charge-documents.test.ts` before the run block:
```typescript
runner.test("buildLineFromEntry: item entry carries unit into the draft (amount unchanged)", () => {
  const entry: BillableEntry = {
    id: "e10", description: "טיפול", notes: null, billingKind: "item",
    duration: 0, quantity: 3, rate: 400, rateLabel: "פגישה", itemRef: 7, unit: "פגישה",
  };
  const line = buildLineFromEntry(entry);
  assertEqual(line.unit, "פגישה");
  assertEqual(line.amount, 1200);
});
runner.test("buildLineFromEntry: hourly entry gets null unit", () => {
  const entry: BillableEntry = {
    id: "e11", description: "ייעוץ", notes: null, billingKind: "hourly",
    duration: 60, quantity: null, rate: 150, rateLabel: "ייעוץ", itemRef: null, unit: "פגישה",
  };
  assertEqual(buildLineFromEntry(entry).unit, null);
});
runner.test("buildLineFromEntry: item without unit -> null unit", () => {
  const entry: BillableEntry = {
    id: "e12", description: "מכתב", notes: null, billingKind: "item",
    duration: 0, quantity: 2, rate: 100, rateLabel: "מכתב", itemRef: 8,
  };
  assertEqual(buildLineFromEntry(entry).unit, null);
});
```

- [ ] **Step 2: Run — verify it fails**

Run: `npx tsx tests/unit/charge-documents.test.ts`
Expected: FAIL — `unit` does not exist on `BillableEntry`/`ChargeLineDraft` (tsx compile error).

- [ ] **Step 3: Implement in `lib/charge-documents.ts`**

`BillableEntry` gains (after `itemRef`):
```typescript
  /** Item unit-noun snapshot ("פגישה"). Optional so legacy callers/tests compile. */
  unit?: string | null;
```

`ChargeLineDraft` gains (after `quantity`):
```typescript
  unit: string | null;
```

`buildLineFromEntry` return object gains (after the `quantity` line):
```typescript
    unit: isItem ? entry.unit ?? null : null,
```

- [ ] **Step 4: Run — verify it passes**

Run: `npx tsx tests/unit/charge-documents.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/charge-documents.ts tests/unit/charge-documents.test.ts
git commit -m "feat(charge-docs): buildLineFromEntry snapshots unit onto the line draft"
```

---

### Task 5: Persist `unit` on client rates (API routes)

**Files:**
- Modify: `app/api/clients/route.ts` (POST rates INSERT, ~line 241)
- Modify: `app/api/clients/[id]/route.ts` (PUT rates re-INSERT ~line 235, re-read SELECT ~line 254, and its `RateRow` type + response mapping)
- Modify: `app/api/clients/[id]/rates/route.ts` (GET SELECT + response, POST insert)

- [ ] **Step 1: `app/api/clients/route.ts` — POST create inserts unit**

Replace the rates INSERT (currently `(id, user_id, client_id, kind, name, rate, is_default)` over `unnest($3..$6)`) with:
```typescript
        await db.query(
          `INSERT INTO client_rates (id, user_id, client_id, kind, name, rate, is_default, unit)
           SELECT gen_random_uuid()::text, $1, $2, kind, name, rate, is_default, unit
           FROM unnest($3::text[], $4::text[], $5::numeric[], $6::boolean[], $7::text[])
             AS r(kind, name, rate, is_default, unit)`,
          [
            user.id,
            row.id,
            ratesList.map((r) => r.kind),
            ratesList.map((r) => r.name.trim()),
            ratesList.map((r) => r.rate),
            ratesList.map((r) => (r.kind === "hourly" ? r.isDefault : false)),
            ratesList.map((r) => (r.kind === "item" ? r.unit ?? null : null)),
          ]
        );
```

- [ ] **Step 2: `app/api/clients/[id]/route.ts` — PUT update inserts + re-reads unit**

The rates re-INSERT block becomes:
```typescript
          const kinds = ratesList.map((r) => r.kind);
          const names = ratesList.map((r) => r.name.trim());
          const rateValues = ratesList.map((r) => r.rate);
          const isDefaults = ratesList.map((r) => (r.kind === "hourly" ? r.isDefault : false));
          const units = ratesList.map((r) => (r.kind === "item" ? r.unit ?? null : null));
          await db.query(
            `INSERT INTO client_rates (id, user_id, client_id, kind, name, rate, is_default, unit)
             SELECT gen_random_uuid()::text, $1, $2, k, n, rt, d, u
             FROM unnest($3::text[], $4::text[], $5::numeric[], $6::boolean[], $7::text[]) AS t(k, n, rt, d, u)`,
            [user.id, clientId, kinds, names, rateValues, isDefaults, units]
          );
```
Then four more spots in the same file:
- The GET rates SELECT (~line 86) and the PUT re-read SELECT (~line 254) both become `SELECT id, kind, name, rate, is_default, unit FROM client_rates ...` (same WHERE/ORDER).
- The `RateRow` type (~line 197) becomes `type RateRow = { id: string; kind: string; name: string; rate: number; is_default: boolean; unit: string | null };`
- Both response mappings (~line 102 and ~line 272) gain the field:
```typescript
      id: r.id, kind: r.kind as "hourly" | "item", name: r.name, rate: r.rate, isDefault: r.is_default, unit: r.unit,
```

- [ ] **Step 3: `app/api/clients/[id]/rates/route.ts` — GET returns unit, POST stores it**

GET: SELECT becomes `SELECT id, kind, name, rate, is_default, unit`; the generic type gains `unit: string | null;`; the response mapping becomes:
```typescript
      rates: result.rows.map((r) => ({
        id: r.id, kind: r.kind as "hourly" | "item", name: r.name, rate: r.rate, isDefault: r.is_default, unit: r.unit,
      })),
```
POST: destructure becomes `const { name, rate, unit } = parsed.data;` and the INSERT becomes:
```typescript
      const inserted = await client.query<{ id: string; name: string; rate: number; unit: string | null }>(
        `INSERT INTO client_rates (id, user_id, client_id, kind, name, rate, is_default, unit)
         VALUES (gen_random_uuid()::text, $1, $2, 'item', $3, $4, false, $5)
         RETURNING id, name, rate, unit`,
        [user.id, clientId, name, rate, unit ?? null]
      );
```
The existing-row early return and the success response mapping each gain `unit` (`unit: existing.rows[0].unit` requires adding `unit` to that SELECT too: `SELECT id, name, rate, unit FROM client_rates ...`; response: `unit: result.rate.unit ?? null`).

- [ ] **Step 4: Lint + typecheck**

Run: `npm run lint && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add app/api/clients/route.ts "app/api/clients/[id]/route.ts" "app/api/clients/[id]/rates/route.ts"
git commit -m "feat(api): persist + return unit on client_rates (create/update/list/append)"
```

---

### Task 6: Snapshot `unit` on time entries (API routes)

**Files:**
- Modify: `app/api/entries/route.ts` (GET SELECT ~line 93 + type ~129 + mapping ~164; POST destructure ~line 209, INSERT ~251, RETURNING/`CreatedRow`/response)
- Modify: `app/api/entries/[id]/route.ts` (GET SELECT ~68/type ~45/mapping ~113; PUT destructure ~149, UPDATE ~188–223, `UpdatedRow`/response ~261)

- [ ] **Step 1: GET list (`app/api/entries/route.ts`)**

Add `te.unit,` to the SELECT (after `te.rate_label,`), `unit: string | null;` to the result generic (after `rate_label`), and `unit: entry.unit,` to the entries mapping (after `rateLabel: entry.rate_label,`).

- [ ] **Step 2: POST create (`app/api/entries/route.ts`)**

Destructure gains `unit`:
```typescript
    const { projectId, taskId, date, duration, description, notes, isBillable, tags, billingKind, rate, rateLabel, quantity, unit } = parsed.data;
```
INSERT column list gains `unit` (17th column) and the VALUES tuple gains `$17`:
```sql
             (id, user_id, project_id, task_id, description, start_time, end_time, duration, date, tags, notes, is_billable, billing_kind, rate, rate_label, quantity, item_ref, unit)
           VALUES
             (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
```
Append to the params array (after the `itemRef` param): `isItem ? unit?.trim() || null : null,`
Add `ins.unit,` to the RETURNING SELECT list (after `ins.item_ref,`), `unit: string | null;` to `CreatedRow`, and `unit: entry.unit,` to the response mapping (next to `itemRef`). There are TWO response mappings in this file (~164 and ~320) — update both.

- [ ] **Step 3: GET single + PUT (`app/api/entries/[id]/route.ts`)**

GET: add `te.unit,` to the SELECT, `unit: string | null;` to the row type, `unit: entry.unit,` to the mapping.

PUT: destructure gains `unit` (same line shape as POST). The UPDATE gains `unit = $14` with the WHERE placeholders renumbered:
```sql
           SET project_id = $1, task_id = $2, description = $3, duration = $4, date = $5,
               tags = $6, notes = $7, is_billable = $8, billing_kind = $9, rate = $10,
               rate_label = $11, quantity = $12, item_ref = $13, unit = $14, updated_at = NOW()
           WHERE id = $15 AND user_id = $16
```
Params array: insert `isItem ? unit?.trim() || null : null,` after the `itemRef` param (so `id` and `user.id` shift to positions 15/16). Add `upd.unit,` to the RETURNING SELECT, `unit: string | null;` to `UpdatedRow`, `unit: entry.unit,` to the response mapping.

- [ ] **Step 4: Lint + typecheck + unit tests**

Run: `npm run lint && npx tsc --noEmit && npm test`
Expected: clean, all tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/api/entries/route.ts "app/api/entries/[id]/route.ts"
git commit -m "feat(api): snapshot unit on time entries (create/update) and return it (list/single)"
```

---

### Task 7: Carry `unit` into charge documents + billable/reports queries (API)

**Files:**
- Modify: `app/api/charge-documents/route.ts` (entries SELECT ~line 71, computed drafts ~95, lines INSERT ~133)
- Modify: `app/api/charge-documents/[id]/route.ts` (PATCH addTimeEntryId SELECT ~85 + INSERT ~94)
- Modify: `app/api/charge-documents/billable/route.ts` (SELECT ~42 + row type ~35)
- Modify: `app/api/reports/route.ts` (SELECT ~57 + type ~119 + mapping ~171)

- [ ] **Step 1: `charge-documents/route.ts` POST**

Entries SELECT gains `te.unit AS "unit",` (after `te.rate_label AS "rateLabel",`). The `computedDrafts` literal gains `unit: null,` (after `quantity: null,`). The lines INSERT gains the column + a 14th unnest array:
```typescript
        await client.query(
          `INSERT INTO charge_document_lines
             (id, user_id, document_id, source_type, time_entry_id, period_month, label,
              description, notes, item_ref, billing_kind, quantity, rate, amount, unit)
           SELECT gen_random_uuid()::text, $1, $2, t.source_type, t.time_entry_id, t.period_month,
                  t.label, t.description, t.notes, t.item_ref, t.billing_kind, t.quantity, t.rate, t.amount, t.unit
             FROM unnest(
               $3::text[], $4::text[], $5::text[], $6::text[], $7::text[],
               $8::text[], $9::text[], $10::text[], $11::numeric[], $12::numeric[], $13::numeric[], $14::text[]
             ) AS t(source_type, time_entry_id, period_month, label, description,
                    notes, item_ref, billing_kind, quantity, rate, amount, unit)`,
          [
            user.id,
            documentId,
            allLines.map((l) => l.sourceType),
            allLines.map((l) => l.timeEntryId),
            allLines.map((l) => l.periodMonth),
            allLines.map((l) => l.label),
            allLines.map((l) => l.description),
            allLines.map((l) => l.notes),
            allLines.map((l) => l.itemRef),
            allLines.map((l) => l.billingKind),
            allLines.map((l) => l.quantity),
            allLines.map((l) => l.rate),
            allLines.map((l) => l.amount),
            allLines.map((l) => l.unit),
          ]
        );
```

- [ ] **Step 2: `charge-documents/[id]/route.ts` PATCH (add-entry path)**

SELECT gains `te.unit AS "unit"` (after `te.item_ref AS "itemRef"`). The single-line INSERT becomes:
```typescript
        await client.query(
          `INSERT INTO charge_document_lines
             (id, user_id, document_id, source_type, time_entry_id, period_month, label,
              description, notes, item_ref, billing_kind, quantity, rate, amount, unit)
           VALUES (gen_random_uuid()::text,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
          [user.id, id, l.sourceType, l.timeEntryId, l.periodMonth, l.label, l.description,
           l.notes, l.itemRef, l.billingKind, l.quantity, l.rate, l.amount, l.unit]
        );
```
(The GET in this file uses `SELECT *` — `unit` flows to the client automatically.)

- [ ] **Step 3: `charge-documents/billable/route.ts`**

SELECT gains `te.unit,` (after `te.item_ref,`); the row generic gains `unit: string | null;` (after `item_ref`). The `...e` spread already forwards it to the response.

- [ ] **Step 4: `reports/route.ts`**

SELECT gains `te.unit,` (after `te.item_ref,`); the result generic gains `unit: string | null;`; the entries mapping gains `unit: entry.unit,` (after `itemRef: entry.item_ref,`).

- [ ] **Step 5: Lint + typecheck**

Run: `npm run lint && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add app/api/charge-documents "app/api/reports/route.ts"
git commit -m "feat(api): unit flows into charge_document_lines and billable/reports payloads"
```

---

### Task 8: Rates editor UI — unit input on item rows

**Files:**
- Modify: `components/client-rates-editor.tsx`
- Modify: `app/[locale]/clients/page.tsx` (edit-path rates load mapping ~line 343)
- Modify: `messages/he.json` + `messages/en.json` (`Clients` section)

- [ ] **Step 1: Add i18n keys (both files, `Clients` section, e.g. next to `unitItem`)**

`messages/he.json`:
```json
    "unitPlaceholder": "יחידה (פגישה / מילה / יום)",
    "unitAria": "יחידת הפריט",
```
`messages/en.json`:
```json
    "unitPlaceholder": "Unit (session / word / day)",
    "unitAria": "Item unit",
```

- [ ] **Step 2: `components/client-rates-editor.tsx` — item rows get the unit field**

`addRate` seeds it:
```typescript
  const addRate = (kind: RateKind) =>
    onChange([
      ...rates,
      {
        kind,
        name: "",
        rate: 0,
        isDefault: kind === "hourly" && !rates.some((r) => r.kind === "hourly" && r.isDefault),
        unit: null,
      },
    ]);
```
In the `row(...)` helper, insert a unit input between the name input and the price wrapper, rendered only for item rows (`!showDefault`):
```tsx
      {!showDefault && (
        <input
          type="text"
          value={r.unit ?? ""}
          onChange={(e) => updateRate(idx, { unit: e.target.value || null })}
          placeholder={t("unitPlaceholder")}
          className={`${fieldClass(false)} w-28 shrink-0 sm:w-32`}
          disabled={disabled}
          aria-label={t("unitAria")}
          maxLength={30}
        />
      )}
```
Make the price suffix echo the typed unit — change the suffix span content from `{symbol}/{unit}` to:
```tsx
          {symbol}/{r.unit?.trim() || unit}
```

- [ ] **Step 3: `app/[locale]/clients/page.tsx` — edit path keeps the unit**

The edit-mode rates load (~line 343) maps rows explicitly; add `unit`:
```typescript
        const loaded: ClientRateInput[] = (data.rates as ClientRate[]).map((r) => ({
          kind: r.kind,
          name: r.name,
          rate: r.rate,
          isDefault: r.isDefault,
          unit: r.unit ?? null,
        }));
```
(Match the existing field list at that line — only `unit` is new. The save path needs no change: `cleanClientRates` (Task 2) already carries `unit` and the API routes (Task 5) persist it.)

- [ ] **Step 4: Messages parity + lint**

Run: `npx tsx tests/unit/messages-parity.test.ts && npm run lint`
Expected: PASS, clean.

- [ ] **Step 5: Manual smoke (dev server)**

`npm run dev` → clients page → add item rate "פגישה" with unit "פגישה", price 400 → save → reopen edit → unit field shows "פגישה", price suffix reads "₪/פגישה". RTL intact on the row.

- [ ] **Step 6: Commit**

```bash
git add components/client-rates-editor.tsx "app/[locale]/clients/page.tsx" messages/he.json messages/en.json
git commit -m "feat(ui): unit input on item rate rows (editor + edit-path load)"
```

---

### Task 9: Entry form sends the unit snapshot

**Files:**
- Modify: `app/[locale]/entries/page.tsx` (submit body ~line 433–462)

- [ ] **Step 1: Thread the chosen rate's unit into the POST/PUT body**

In `handleSubmit`, after the `itemLabel` line (~438), add:
```typescript
      // Ad-hoc items have no unit field — only catalog items snapshot one.
      const itemUnit = isAdhoc ? null : chosen?.unit ?? null;
```
And in the `JSON.stringify({...})` body, after the `rateLabel` line:
```typescript
          unit: isItem ? itemUnit : null,
```
(`chosen` is a `ClientRate` — `unit` exists on it since Task 2, and the rates GET returns it since Task 5. No other change needed; the preselect/edit effects key off `rateLabel` and stay as-is.)

- [ ] **Step 2: Lint + typecheck**

Run: `npm run lint && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Manual smoke**

Dev server → entries page → log an item entry from the "פגישה" catalog item → in psql:
```bash
psql "$DATABASE_URL_ADMIN" -c "SELECT rate_label, unit FROM time_entries WHERE billing_kind='item' ORDER BY created_at DESC LIMIT 1"
```
Expected: `פגישה | פגישה`. Then edit the same entry (change quantity, save) and re-run — `unit` must still be `פגישה`, not NULL.

- [ ] **Step 4: Commit**

```bash
git add "app/[locale]/entries/page.tsx"
git commit -m "feat(entries): send the chosen item rate's unit with create/update"
```

---

### Task 10: Unit-aware rendering (reports + charge docs)

**Files:**
- Modify: `messages/he.json` + `messages/en.json` (`Reports.units`)
- Modify: `app/[locale]/(auth)/reports/BillableTab.tsx` (row type ~25, render ~353)
- Modify: `app/[locale]/(auth)/reports/AdHocReportTab.tsx` (entry type ~44, renders ~867 + ~1336 — NOT the aggregate at ~419)
- Modify: `app/[locale]/(auth)/reports/ChargeDocumentView.tsx` (line type ~21, renders ~475 + ~803)

- [ ] **Step 1: Add the i18n key (both files, inside `Reports` → `"units"`)**

`messages/he.json`:
```json
      "itemsWithUnit": "{count} × {unit}",
```
`messages/en.json`:
```json
      "itemsWithUnit": "{count} × {unit}",
```

- [ ] **Step 2: `BillableTab.tsx`**

`BillableEntryRow` gains `unit: string | null;` (after `rate_label`). The quantity render (~353) becomes:
```tsx
                              {entry.billing_kind === "item"
                                ? (entry.unit
                                    ? t("units.itemsWithUnit", { count: entry.quantity ?? 0, unit: entry.unit })
                                    : t("units.items", { count: entry.quantity ?? 0 }))
                                : formatDuration(billedMinutes(entry), locale)}
```

- [ ] **Step 3: `AdHocReportTab.tsx` — per-entry rows only**

`ReportEntry` gains `unit?: string | null;` (after `itemRef`). Apply the same conditional at BOTH per-entry renders (~line 867 print table, ~line 1336 screen table):
```tsx
                            {entry.billingKind === "item"
                              ? (entry.unit
                                  ? t("units.itemsWithUnit", { count: entry.quantity ?? 0, unit: entry.unit })
                                  : t("units.items", { count: entry.quantity ?? 0 }))
                              : formatDuration(entry.duration)}
```
**Scope guard:** the aggregate render at ~line 419 (`row.totalQuantity`) stays `t("units.items", ...)` — aggregated rows can mix units.

- [ ] **Step 4: `ChargeDocumentView.tsx`**

`DocumentLine` gains `unit: string | null;` (after `quantity`). Screen qty cell (~475) becomes:
```tsx
                    {isItemLine(line) && line.quantity != null && line.rate != null ? (
                      <span className="font-mono tabular-nums">
                        {line.quantity}{line.unit ? <> <bdi>{line.unit}</bdi></> : null} × {formatCurrency(line.rate, doc.currency, locale)}
                      </span>
                    ) : (
                      "—"
                    )}
```
PDF qty cell (~803) becomes:
```tsx
                  {isItemLine(line) && line.quantity != null && line.rate != null
                    ? `${line.quantity}${line.unit ? ` ${line.unit}` : ""} × ${formatCurrency(line.rate, doc.currency, locale)}`
                    : ""}
```

- [ ] **Step 5: Parity + lint + manual smoke**

Run: `npx tsx tests/unit/messages-parity.test.ts && npm run lint`
Dev server → reports → billable tab shows "3 × פגישה" on the item entry from Task 9; issue a charge doc → doc view + PDF preview show "3 פגישה × ₪400"; an old item entry (no unit) still shows the generic "3 יח׳". Check a LIGHT theme for legibility (token classes only — should hold).

- [ ] **Step 6: Commit**

```bash
git add messages/he.json messages/en.json "app/[locale]/(auth)/reports/BillableTab.tsx" "app/[locale]/(auth)/reports/AdHocReportTab.tsx" "app/[locale]/(auth)/reports/ChargeDocumentView.tsx"
git commit -m "feat(reports): unit-aware quantity rendering (per-line only; aggregates stay generic)"
```

---

### Task 11: Profession starter item-templates (TDD)

**Files:**
- Modify: `lib/professions.ts`
- Test: `tests/unit/professions.test.ts`
- Modify: `app/[locale]/clients/page.tsx`

- [ ] **Step 1: Write the failing registry tests**

Append to `tests/unit/professions.test.ts` before the `if (failed > 0)` block:
```typescript
test("starterItems (when present) have non-empty he/en names + units", () => {
  for (const p of PROFESSIONS) {
    for (const s of p.starterItems ?? []) {
      assert(
        !!s.nameHe && !!s.nameEn && !!s.unitHe && !!s.unitEn,
        `${p.id}: incomplete starter item ${JSON.stringify(s)}`
      );
    }
  }
});

test("session professions ship starter items", () => {
  for (const id of ["therapist", "health-pro", "tutor", "fitness-trainer", "photographer", "translator", "writer"]) {
    assert((getProfession(id)?.starterItems?.length ?? 0) > 0, `${id}: missing starterItems`);
  }
});
```

- [ ] **Step 2: Run — verify it fails**

Run: `npx tsx tests/unit/professions.test.ts`
Expected: FAIL — `starterItems` does not exist on `Profession`.

- [ ] **Step 3: Implement the registry**

In `lib/professions.ts`, after `ProfessionDefaults`:
```typescript
/** A ready-made item rate seeded into the new-client form (price left blank). */
export interface StarterItem {
  nameHe: string;
  nameEn: string;
  unitHe: string;
  unitEn: string;
}
```
`Profession` gains:
```typescript
  /** Prefilled item rows on the first client for per-session professions. */
  starterItems?: StarterItem[];
```
Add to the matching presets (one `starterItems: [...]` line each, after `defaults`):
- `therapist`: `starterItems: [{ nameHe: "פגישה", nameEn: "Session", unitHe: "פגישה", unitEn: "session" }],`
- `health-pro`: `starterItems: [{ nameHe: "פגישה", nameEn: "Session", unitHe: "פגישה", unitEn: "session" }],`
- `tutor`: `starterItems: [{ nameHe: "שיעור", nameEn: "Lesson", unitHe: "שיעור", unitEn: "lesson" }],`
- `fitness-trainer`: `starterItems: [{ nameHe: "אימון", nameEn: "Session", unitHe: "אימון", unitEn: "session" }],`
- `photographer`: `starterItems: [{ nameHe: "יום צילום", nameEn: "Shoot day", unitHe: "יום", unitEn: "day" }],`
- `translator`: `starterItems: [{ nameHe: "תרגום", nameEn: "Translation", unitHe: "מילה", unitEn: "word" }],`
- `writer`: `starterItems: [{ nameHe: "כתיבת תוכן", nameEn: "Content", unitHe: "מילה", unitEn: "word" }],`

All other presets: untouched (no `starterItems`).

- [ ] **Step 4: Run — verify it passes**

Run: `npx tsx tests/unit/professions.test.ts`
Expected: all PASS.

- [ ] **Step 5: New-client prefill in `app/[locale]/clients/page.tsx`**

Import `useLocale` (extend the existing next-intl import at line 19): `import { useTranslations, useLocale } from "next-intl";` and inside `ClientsPageContent` add `const locale = useLocale();` near the other hooks.

Next to the `suggestsRetainer` memo (~line 96), add:
```typescript
  const starterItems = useMemo(
    () => getProfession(professionId)?.starterItems ?? [],
    [professionId],
  );
  // One-shot per create session — mirrors retainerTouched so the prefill never
  // re-appends after the user removes/edits rows.
  const [starterSeeded, setStarterSeeded] = useState(false);
```
Below the retainer-prefill effect (~line 167), add a sibling effect:
```typescript
  // Create-mode default: seed the profession's starter item rows once, only if
  // the user hasn't already added an item row. Never runs in edit mode.
  useEffect(() => {
    if (showForm && editingClient === null && !starterSeeded && starterItems.length > 0) {
      setFormData((prev) =>
        prev.rates.some((r) => r.kind === "item")
          ? prev
          : {
              ...prev,
              rates: [
                ...prev.rates,
                ...starterItems.map((s) => ({
                  kind: "item" as const,
                  name: locale === "he" ? s.nameHe : s.nameEn,
                  rate: 0,
                  isDefault: false,
                  unit: locale === "he" ? s.unitHe : s.unitEn,
                })),
              ],
            }
      );
      setStarterSeeded(true);
    }
  }, [showForm, editingClient, starterSeeded, starterItems, locale]);
```
In the new-client button onClick (~line 455), add one line directly after `setRetainerTouched(false);`:
```typescript
                setStarterSeeded(false);
```

- [ ] **Step 6: Manual smoke**

Dev server, profile profession = therapist → clients → "לקוח חדש" → rates editor shows the hourly seed row PLUS an item row "פגישה" / unit "פגישה" / price empty. Remove the row, close, reopen → it reappears (new create session). Edit an existing client → NO starter row appended. Profession = lawyer → no starter row.

- [ ] **Step 7: Full test run + commit**

Run: `npm test`
Expected: all suites pass.
```bash
git add lib/professions.ts tests/unit/professions.test.ts "app/[locale]/clients/page.tsx"
git commit -m "feat(professions): starter item-templates + new-client prefill (price left blank)"
```

---

### Task 12: Pre-VAT note (static, no calculation)

**Files:**
- Modify: `messages/he.json` + `messages/en.json` (`Reports` + `Clients` sections)
- Modify: `app/[locale]/(auth)/reports/ChargeDocumentView.tsx` (screen total ~392, PDF after-table ~820)
- Modify: `app/[locale]/(auth)/reports/AdHocReportTab.tsx` (print grand-total box ~966)
- Modify: `components/client-rates-editor.tsx` (one-line hint)

- [ ] **Step 1: i18n keys**

`messages/he.json` — in `Reports` (top level of the section): `"preVatNote": "כל הסכומים הם לפני מע\"מ",` and in `Clients`: `"preVatHint": "המחירים לפני מע\"מ",`
`messages/en.json` — `Reports`: `"preVatNote": "All amounts are pre-VAT",` and `Clients`: `"preVatHint": "Prices are pre-VAT",`

- [ ] **Step 2: `ChargeDocumentView.tsx` — screen + PDF**

Screen: directly under the total block (~line 392–395, the `t("doc.total")` + `formatCurrency(doc.total, ...)` pair), add:
```tsx
            <div className="text-xs text-muted-foreground">{t("preVatNote")}</div>
```
PDF: immediately after the closing `</table>` of the `pdf-table` (the one whose `<tfoot>` renders `t("doc.total")`, ~line 820), add:
```tsx
        <div style={{ marginTop: "0.5rem", fontSize: "11px", color: "#94a3b8" }}>{t("preVatNote")}</div>
```

- [ ] **Step 3: `AdHocReportTab.tsx` — print grand-total box**

Inside the "── Grand total ──" container (~line 949–966), after the inner flex `</div>` and before the container's closing `</div>`, add:
```tsx
                <div style={{ marginTop: "0.5rem", fontSize: "11px", color: "#94a3b8" }}>{t("preVatNote")}</div>
```

- [ ] **Step 4: `components/client-rates-editor.tsx` — hint line**

At the bottom of the items section `<div className="space-y-2 p-3">` (after the items list / its closing conditional), add:
```tsx
        <p className="text-xs text-muted-foreground">{t("preVatHint")}</p>
```

- [ ] **Step 5: Parity + lint + smoke**

Run: `npx tsx tests/unit/messages-parity.test.ts && npm run lint`
Dev: charge-doc view shows the note under the total (screen + PDF preview); report print preview shows it in the grand-total box; rates editor shows the hint.

- [ ] **Step 6: Commit**

```bash
git add messages/he.json messages/en.json "app/[locale]/(auth)/reports/ChargeDocumentView.tsx" "app/[locale]/(auth)/reports/AdHocReportTab.tsx" components/client-rates-editor.tsx
git commit -m "feat(ui): static pre-VAT note on reports, charge docs, and rates editor"
```

---

### Task 13: Final verification + PROD migration gate

**Files:** none new.

- [ ] **Step 1: Full suite**

Run: `npm test && npm run lint && npm run build`
Expected: all tests pass, zero lint warnings (CI gate), build succeeds.

- [ ] **Step 2: End-to-end smoke (dev)**

Therapist profile → new client (starter "פגישה" prefilled, set price 400) → log 3 sessions as an item entry → reports billable shows "3 × פגישה" → issue התחשבנות → doc lines read "3 פגישה × ₪400" + pre-VAT note → edit the entry (quantity 4) → unit survives. Old entries without unit still render "יח׳".

- [ ] **Step 3: PROD migration — STOP, needs owner approval**

Do NOT run without explicit approval from the owner (benatia.asaf@gmail.com). When approved:
```bash
eval "$(grep '^DATABASE_URL_ADMIN=' .env.local.bak.prod-shared)" && psql "$DATABASE_URL_ADMIN" -f drizzle/0020_unit_labels.sql
```
(Backward-compatible: old code ignores the nullable columns, so deploy order doesn't matter — but per project convention PROD migrates before merge.)

- [ ] **Step 4: Merge decision**

Use superpowers:finishing-a-development-branch (merge vs PR vs keep).

---

## Explicitly out of scope (per spec §8)

- Profession task/tag presets (`custom_tags` has no create/consume path).
- A `billingKind = "session"` — rejected; sessions are items + unit.
- Packages / punch-card balances; VAT computation; unit on hourly rates.
- Excel export (`app/api/reports/excel/route.ts`) unit rendering — not in spec scope; the generic count stays.
- Aggregated report rows (by-label/by-client `totalQuantity`) stay generic — units can mix.
