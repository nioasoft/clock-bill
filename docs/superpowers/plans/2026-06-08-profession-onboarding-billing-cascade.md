# Profession Onboarding + Billing-Base Cascade — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a new user set their billing base (profession preset + currency + hourly rate + rounding + theme) in a first-run dashboard modal, with a 3-tier cascade where client overrides base and project overrides client.

**Architecture:** A profession registry (`lib/professions.ts`, mirroring `lib/themes.ts`) supplies presets. Three new `user_profiles` columns store the base (`profession`, `default_rate`, `default_billing_rounding`) plus an `onboarded` flag. Billing rounding resolves via a 3-tier fall-through (`project ?? client ?? profile ?? 'none'`); rate falls through at log/billing time and is snapshotted; currency is seeded from the base into each new client at creation. A dismissible client modal on the dashboard collects the base and PATCHes the profile.

**Tech Stack:** Next.js 16 App Router, Better Auth, raw `query()` (lib/db.ts) + Drizzle schema (src/db/schema.ts), Zod, next-intl (he/en), Tailwind v4 design tokens, custom tsx test runner.

**Spec:** `docs/superpowers/specs/2026-06-08-profession-onboarding-billing-cascade-design.md`

---

## File Structure

**Create:**
- `lib/professions.ts` — profession registry + helpers (single source of truth).
- `lib/geo-currency.ts` — pure country→currency mapping.
- `app/api/geo/route.ts` — GET, returns suggested currency from request country.
- `components/onboarding-modal.tsx` — the first-run billing-base modal.
- `tests/unit/professions.test.ts`, `tests/unit/geo-currency.test.ts` — new unit tests.
- `drizzle/0019_profession_onboarding_cascade.sql` — DEV migration (applied via psql).

**Modify:**
- `lib/rounding.ts` — add `tenth_hour_up` + `quarter_hour_up`; 3-arg `resolveRounding`.
- `tests/unit/rounding.test.ts` — cover new modes + profile tier.
- `lib/currency.ts` — add `EUR`.
- `lib/schemas/charge-documents.ts` — `export` `KNOWN_TEMPLATES` (DRY for the registry test).
- `src/db/schema.ts` — 4 new `user_profiles` columns; widen rounding CHECKs.
- `app/api/profile/route.ts` — PATCH/GET the new fields.
- `app/api/clients/route.ts` — widen rounding enum; NULL-inherit rounding; seed currency.
- `app/api/reports/route.ts`, `app/api/charge-documents/route.ts`,
  `app/api/charge-documents/billable/route.ts` — thread profile rounding + rate base.
- `app/[locale]/dashboard/page.tsx` — mount the onboarding modal.
- `app/[locale]/settings/page.tsx` — base fields (rate + rounding) in the billing tab.
- `messages/he.json`, `messages/en.json` — rounding modes, professions, onboarding, EUR.

---

## Task 1: Extend rounding modes + 3-tier resolve

**Files:**
- Modify: `lib/rounding.ts`
- Test: `tests/unit/rounding.test.ts`

- [ ] **Step 1: Add failing tests for the new modes + profile tier**

Append to `tests/unit/rounding.test.ts` (before the final `runner.run()` call — check the file end for how it runs; tests are registered with `runner.test(...)`):

```typescript
// --- new increments ---
runner.test('roundBillableMinutes: tenth_hour_up rounds to 6 min', () => {
  assertEqual(roundBillableMinutes(1, 'tenth_hour_up'), 6);
  assertEqual(roundBillableMinutes(7, 'tenth_hour_up'), 12);
  assertEqual(roundBillableMinutes(12, 'tenth_hour_up'), 12);
});
runner.test('roundBillableMinutes: quarter_hour_up rounds to 15 min', () => {
  assertEqual(roundBillableMinutes(1, 'quarter_hour_up'), 15);
  assertEqual(roundBillableMinutes(16, 'quarter_hour_up'), 30);
  assertEqual(roundBillableMinutes(30, 'quarter_hour_up'), 30);
});
// --- 3-tier resolve (profile is lowest priority) ---
runner.test('resolveRounding: profile used when project+client empty', () => {
  assertEqual(resolveRounding(null, null, 'tenth_hour_up'), 'tenth_hour_up');
  assertEqual(resolveRounding(undefined, undefined, 'quarter_hour_up'), 'quarter_hour_up');
});
runner.test('resolveRounding: client overrides profile', () => {
  assertEqual(resolveRounding(null, 'hour_up', 'tenth_hour_up'), 'hour_up');
});
runner.test('resolveRounding: project overrides client and profile', () => {
  assertEqual(resolveRounding('none', 'hour_up', 'tenth_hour_up'), 'none');
});
runner.test('resolveRounding: all empty → none (no profile arg)', () => {
  assertEqual(resolveRounding(null, null), 'none');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx tsx tests/unit/rounding.test.ts`
Expected: FAIL — `tenth_hour_up`/`quarter_hour_up` not handled, `resolveRounding` ignores the 3rd arg.

- [ ] **Step 3: Rewrite `lib/rounding.ts` with the new modes + 3-tier resolve**

Replace the whole file body below the header comment with:

```typescript
export type RoundingMode =
  | "none"
  | "tenth_hour_up"
  | "quarter_hour_up"
  | "half_hour_up"
  | "hour_up";

/** All valid modes, smallest→largest — handy for Zod enums and UI lists. */
export const ROUNDING_MODES: readonly RoundingMode[] = [
  "none",
  "tenth_hour_up",
  "quarter_hour_up",
  "half_hour_up",
  "hour_up",
];

// Labels live in the message catalogs under the `Rounding` namespace. A mode
// value IS its own message key, so resolve at the call site with
// `useTranslations("Rounding")(mode)`.

/** Return the value as a RoundingMode if it is an explicit mode, else null. */
function explicitMode(value: string | null | undefined): RoundingMode | null {
  return value && (ROUNDING_MODES as readonly string[]).includes(value)
    ? (value as RoundingMode)
    : null;
}

/** Narrow an arbitrary string to a RoundingMode, falling back to 'none'. */
export function asRoundingMode(value: string | null | undefined): RoundingMode {
  return explicitMode(value) ?? "none";
}

/**
 * Resolve the effective rounding mode through the billing cascade:
 * project override wins, else client, else the user-profile base, else 'none'.
 * Any level's NULL/empty/unknown value means "inherit from the next level".
 * Note 'none' IS an explicit override (e.g. a project set to 'none' beats a
 * client 'hour_up').
 */
export function resolveRounding(
  projectMode: string | null | undefined,
  clientMode: string | null | undefined,
  profileMode?: string | null | undefined
): RoundingMode {
  return (
    explicitMode(projectMode) ??
    explicitMode(clientMode) ??
    explicitMode(profileMode) ??
    "none"
  );
}

/**
 * Round a worked-minutes value UP to the billing increment for the given mode.
 * 'none' returns the minutes unchanged. Non-positive durations stay as-is.
 */
export function roundBillableMinutes(minutes: number, mode: RoundingMode): number {
  if (!Number.isFinite(minutes) || minutes <= 0) return minutes;
  if (mode === "hour_up") return Math.ceil(minutes / 60) * 60;
  if (mode === "half_hour_up") return Math.ceil(minutes / 30) * 30;
  if (mode === "quarter_hour_up") return Math.ceil(minutes / 15) * 15;
  if (mode === "tenth_hour_up") return Math.ceil(minutes / 6) * 6;
  return minutes;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx tsx tests/unit/rounding.test.ts`
Expected: PASS (all tests, including the pre-existing ones).

- [ ] **Step 5: Commit**

```bash
git add lib/rounding.ts tests/unit/rounding.test.ts
git commit -m "feat(rounding): add 6-min/15-min modes and 3-tier (profile) resolve"
```

---

## Task 2: Profession registry

**Files:**
- Create: `lib/professions.ts`
- Modify: `lib/schemas/charge-documents.ts` (export `KNOWN_TEMPLATES`)
- Test: `tests/unit/professions.test.ts`

- [ ] **Step 1: Export `KNOWN_TEMPLATES`**

In `lib/schemas/charge-documents.ts:4`, change:

```typescript
const KNOWN_TEMPLATES = ["modern", "classic", "bold", "elegant", "nature", "ocean"] as const;
```
to:
```typescript
export const KNOWN_TEMPLATES = ["modern", "classic", "bold", "elegant", "nature", "ocean"] as const;
```

- [ ] **Step 2: Write the failing registry-integrity test**

Create `tests/unit/professions.test.ts`:

```typescript
/**
 * Unit tests for lib/professions.ts — registry integrity.
 * Every preset must reference valid rounding modes and PDF templates.
 */
import { PROFESSIONS, isProfessionId, getProfession } from "../../lib/professions";
import { ROUNDING_MODES } from "../../lib/rounding";
import { KNOWN_TEMPLATES } from "../../lib/schemas/charge-documents";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

let failed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (e) {
    failed++;
    console.error(`✗ ${name}: ${(e as Error).message}`);
  }
}

test("has at least 8 professions including 'other'", () => {
  assert(PROFESSIONS.length >= 8, `expected >=8, got ${PROFESSIONS.length}`);
  assert(PROFESSIONS.some((p) => p.id === "other"), "missing 'other'");
});

test("ids are unique", () => {
  const ids = PROFESSIONS.map((p) => p.id);
  assert(new Set(ids).size === ids.length, "duplicate profession ids");
});

test("every preset uses a valid rounding mode", () => {
  for (const p of PROFESSIONS) {
    assert(
      (ROUNDING_MODES as readonly string[]).includes(p.defaults.defaultBillingRounding),
      `${p.id}: invalid rounding ${p.defaults.defaultBillingRounding}`
    );
  }
});

test("every preset uses a valid PDF template", () => {
  for (const p of PROFESSIONS) {
    assert(
      (KNOWN_TEMPLATES as readonly string[]).includes(p.defaults.preferredPdfTemplate),
      `${p.id}: invalid template ${p.defaults.preferredPdfTemplate}`
    );
  }
});

test("every preset has he + en labels and model hints", () => {
  for (const p of PROFESSIONS) {
    assert(!!p.labelHe && !!p.labelEn, `${p.id}: missing label`);
    assert(!!p.modelHintHe && !!p.modelHintEn, `${p.id}: missing model hint`);
  }
});

test("isProfessionId + getProfession", () => {
  assert(isProfessionId("lawyer"), "lawyer should be valid");
  assert(!isProfessionId("nope"), "nope should be invalid");
  assert(getProfession("lawyer")?.id === "lawyer", "getProfession lawyer");
  assert(getProfession("nope") === undefined, "getProfession nope");
});

if (failed > 0) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log("\nAll profession tests passed");
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx tsx tests/unit/professions.test.ts`
Expected: FAIL — `lib/professions.ts` does not exist.

- [ ] **Step 4: Create `lib/professions.ts`**

```typescript
/**
 * Single source of truth for the selectable profession presets. Adding a
 * profession = one record here. A preset seeds the user's billing *base* during
 * onboarding: rounding mode, payment terms, and preferred PDF template. It does
 * NOT set currency (geo-suggested), rate (user-typed), or theme (user choice).
 * The "model hint" is descriptive only (billing model lives on client/project).
 */
import type { RoundingMode } from "@/lib/rounding";

export interface ProfessionDefaults {
  /** Applied to user_profiles.default_billing_rounding (the cascade base). */
  defaultBillingRounding: RoundingMode;
  /** Hebrew payment-terms text, or null for the generic preset. */
  paymentTerms: string | null;
  /** A KNOWN_TEMPLATES id (see lib/schemas/charge-documents.ts). */
  preferredPdfTemplate: string;
}

export interface Profession {
  id: string;
  labelHe: string;
  labelEn: string;
  /** Descriptive only — orients the user, never applied. */
  modelHintHe: string;
  modelHintEn: string;
  defaults: ProfessionDefaults;
}

export const PROFESSIONS: Profession[] = [
  {
    id: "lawyer",
    labelHe: 'עו"ד',
    labelEn: "Lawyer",
    modelHintHe: "חיוב שעתי",
    modelHintEn: "Hourly billing",
    defaults: { defaultBillingRounding: "tenth_hour_up", paymentTerms: "שוטף+30", preferredPdfTemplate: "classic" },
  },
  {
    id: "accountant",
    labelHe: 'רו"ח / יועץ מס',
    labelEn: "Accountant / Tax advisor",
    modelHintHe: "ריטיינר חודשי",
    modelHintEn: "Monthly retainer",
    defaults: { defaultBillingRounding: "tenth_hour_up", paymentTerms: "שוטף+30", preferredPdfTemplate: "classic" },
  },
  {
    id: "consultant",
    labelHe: "יועץ עסקי / מאמן",
    labelEn: "Consultant / Coach",
    modelHintHe: "ריטיינר / שעתי",
    modelHintEn: "Retainer / Hourly",
    defaults: { defaultBillingRounding: "half_hour_up", paymentTerms: "שוטף+30", preferredPdfTemplate: "modern" },
  },
  {
    id: "developer",
    labelHe: "מפתח תוכנה",
    labelEn: "Software developer",
    modelHintHe: "שעתי / ריטיינר",
    modelHintEn: "Hourly / Retainer",
    defaults: { defaultBillingRounding: "none", paymentTerms: "שוטף+30", preferredPdfTemplate: "modern" },
  },
  {
    id: "designer",
    labelHe: "מעצב גרפי / UX",
    labelEn: "Graphic / UX designer",
    modelHintHe: "פרויקט / Fixed",
    modelHintEn: "Project / Fixed",
    defaults: { defaultBillingRounding: "none", paymentTerms: "שוטף+30", preferredPdfTemplate: "modern" },
  },
  {
    id: "photographer",
    labelHe: "צלם / וידאו",
    labelEn: "Photographer / Video",
    modelHintHe: "Fixed (יום צילום)",
    modelHintEn: "Fixed (shoot day)",
    defaults: { defaultBillingRounding: "none", paymentTerms: "שוטף+30", preferredPdfTemplate: "modern" },
  },
  {
    id: "writer",
    labelHe: "כותב תוכן / קופירייטר",
    labelEn: "Content writer / Copywriter",
    modelHintHe: "לפי פריט / שעתי",
    modelHintEn: "Per item / Hourly",
    defaults: { defaultBillingRounding: "none", paymentTerms: "שוטף+30", preferredPdfTemplate: "modern" },
  },
  {
    id: "other",
    labelHe: "אחר / כללי",
    labelEn: "Other / General",
    modelHintHe: "",
    modelHintEn: "",
    defaults: { defaultBillingRounding: "none", paymentTerms: null, preferredPdfTemplate: "modern" },
  },
];

export function isProfessionId(value: unknown): value is string {
  return typeof value === "string" && PROFESSIONS.some((p) => p.id === value);
}

export function getProfession(id: string | null | undefined): Profession | undefined {
  return PROFESSIONS.find((p) => p.id === id);
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx tsx tests/unit/professions.test.ts`
Expected: PASS ("All profession tests passed").

- [ ] **Step 6: Commit**

```bash
git add lib/professions.ts tests/unit/professions.test.ts lib/schemas/charge-documents.ts
git commit -m "feat(professions): add profession registry with billing presets"
```

---

## Task 3: EUR currency + geo→currency mapping

**Files:**
- Modify: `lib/currency.ts`
- Create: `lib/geo-currency.ts`
- Test: `tests/unit/geo-currency.test.ts`

- [ ] **Step 1: Add EUR to `lib/currency.ts`**

In `CURRENCY_SYMBOLS` (lib/currency.ts:2-8) add the EUR line:

```typescript
export const CURRENCY_SYMBOLS: Record<string, string> = {
  ILS: "₪",
  USD: "$",
  EUR: "€",
  USDT: "₮",
  BTC: "₿",
  ETH: "Ξ",
};
```

(EUR is a real ISO 4217 code, so `Intl.NumberFormat({ style: "currency", currency: "EUR" })` formats it natively — no entry needed in `CRYPTO_FRACTION_DIGITS`.)

- [ ] **Step 2: Write the failing geo-currency test**

Create `tests/unit/geo-currency.test.ts`:

```typescript
/** Unit tests for lib/geo-currency.ts — country → suggested currency. */
import { currencyForCountry } from "../../lib/geo-currency";

function assertEqual(actual: unknown, expected: unknown, msg = "") {
  if (actual !== expected) throw new Error(`${msg} expected ${expected}, got ${actual}`);
}

let failed = 0;
function test(name: string, fn: () => void) {
  try { fn(); console.log(`✓ ${name}`); }
  catch (e) { failed++; console.error(`✗ ${name}: ${(e as Error).message}`); }
}

test("Israel → ILS", () => assertEqual(currencyForCountry("IL"), "ILS"));
test("US → USD", () => assertEqual(currencyForCountry("US"), "USD"));
test("EU member (DE) → EUR", () => assertEqual(currencyForCountry("DE"), "EUR"));
test("EU member (FR) → EUR", () => assertEqual(currencyForCountry("FR"), "EUR"));
test("lowercase il → ILS", () => assertEqual(currencyForCountry("il"), "ILS"));
test("unknown (GB) → ILS fallback", () => assertEqual(currencyForCountry("GB"), "ILS"));
test("null → ILS fallback", () => assertEqual(currencyForCountry(null), "ILS"));
test("undefined → ILS fallback", () => assertEqual(currencyForCountry(undefined), "ILS"));

if (failed > 0) { console.error(`\n${failed} test(s) failed`); process.exit(1); }
console.log("\nAll geo-currency tests passed");
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx tsx tests/unit/geo-currency.test.ts`
Expected: FAIL — `lib/geo-currency.ts` does not exist.

- [ ] **Step 4: Create `lib/geo-currency.ts`**

```typescript
/**
 * Pure mapping from an ISO 3166-1 alpha-2 country code (e.g. Vercel's
 * `x-vercel-ip-country` header) to a suggested currency for onboarding.
 * Suggestion only — the user always confirms it. Falls back to ILS.
 */
const EU_COUNTRIES = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR",
  "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK",
  "SI", "ES", "SE",
]);

export function currencyForCountry(country: string | null | undefined): string {
  if (!country) return "ILS";
  const c = country.toUpperCase();
  if (c === "IL") return "ILS";
  if (c === "US") return "USD";
  if (EU_COUNTRIES.has(c)) return "EUR";
  return "ILS";
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx tsx tests/unit/geo-currency.test.ts`
Expected: PASS ("All geo-currency tests passed").

- [ ] **Step 6: Commit**

```bash
git add lib/currency.ts lib/geo-currency.ts tests/unit/geo-currency.test.ts
git commit -m "feat(currency): add EUR + country→currency geo mapping"
```

---

## Task 4: Schema migration (DEV) + schema.ts

**Files:**
- Create: `drizzle/0019_profession_onboarding_cascade.sql`
- Modify: `src/db/schema.ts`

> Migrations are applied via **psql + `DATABASE_URL_ADMIN`** (the Drizzle journal is
> drifted — do NOT run `db:migrate`/`db:push`). This task applies to **DEV only**.
> PROD is a separate, owner-approved step (see Task 13 follow-up note).

- [ ] **Step 1: Write the migration SQL**

Create `drizzle/0019_profession_onboarding_cascade.sql`:

```sql
-- Profession onboarding + billing-base cascade.
-- New user_profiles base columns:
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS profession text,
  ADD COLUMN IF NOT EXISTS default_rate real,
  ADD COLUMN IF NOT EXISTS default_billing_rounding text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS onboarded boolean NOT NULL DEFAULT false;

-- CHECK for the profile-level rounding base (5-mode set).
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_default_billing_rounding_check;
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_default_billing_rounding_check
  CHECK (default_billing_rounding IN ('none','tenth_hour_up','quarter_hour_up','half_hour_up','hour_up'));

-- New-users-only: existing users never see onboarding.
UPDATE user_profiles SET onboarded = true;

-- Widen the rounding CHECK on clients + projects to the 5-mode set (NULL = inherit).
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_billing_rounding_check;
ALTER TABLE clients ADD CONSTRAINT clients_billing_rounding_check
  CHECK (billing_rounding IS NULL OR billing_rounding IN ('none','tenth_hour_up','quarter_hour_up','half_hour_up','hour_up'));

ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_billing_rounding_check;
ALTER TABLE projects ADD CONSTRAINT projects_billing_rounding_check
  CHECK (billing_rounding IS NULL OR billing_rounding IN ('none','tenth_hour_up','quarter_hour_up','half_hour_up','hour_up'));
```

- [ ] **Step 2: Apply the migration to DEV**

Run (uses the DEV admin role from `.env.local`):

```bash
psql "$(grep -E '^DATABASE_URL_ADMIN=' .env.local | head -1 | cut -d= -f2- | tr -d '"'"'"'')" -f drizzle/0019_profession_onboarding_cascade.sql
```

Expected: `ALTER TABLE` / `UPDATE N` lines, no errors.

- [ ] **Step 3: Verify the columns exist**

```bash
psql "$(grep -E '^DATABASE_URL_ADMIN=' .env.local | head -1 | cut -d= -f2- | tr -d '"'"'"'')" -c "\d user_profiles" | grep -E "profession|default_rate|default_billing_rounding|onboarded"
```

Expected: all four rows present; `default_billing_rounding` shows `not null default 'none'`, `onboarded` shows `not null default false`.

- [ ] **Step 4: Update `src/db/schema.ts`**

In the `userProfiles` table, after the `theme` column (src/db/schema.ts:146), add:

```typescript
  // ─── Onboarding / billing base (cascade root) ────────────────────────
  // Chosen profession preset id (see lib/professions.ts); NULL = never chose.
  profession: text("profession"),
  // Base hourly rate; new entries fall back to this when client/task have none.
  defaultRate: real("default_rate"),
  // Base billing rounding; clients/projects inherit when their value is NULL.
  defaultBillingRounding: text("default_billing_rounding").notNull().default("none"),
  // Controls the first-run onboarding modal. Backfilled true for existing users.
  onboarded: boolean("onboarded").notNull().default(false),
```

Then convert the `userProfiles` table to the constraint-callback form so the
CHECK is reflected in the schema. Change the table's closing from:

```typescript
  updatedAt: timestamp("updated_at").defaultNow(),
});
```
to:
```typescript
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  check(
    "user_profiles_default_billing_rounding_check",
    sql`${table.defaultBillingRounding} IN ('none', 'tenth_hour_up', 'quarter_hour_up', 'half_hour_up', 'hour_up')`
  ),
]);
```

(`check` and `sql` are already imported in this file — they're used by `clients`/`projects`.)

- [ ] **Step 5: Widen the clients + projects rounding CHECKs in schema.ts**

In `clients` (src/db/schema.ts:193-196), change the check `sql` to:

```typescript
    check(
      "clients_billing_rounding_check",
      sql`${table.billingRounding} IS NULL OR ${table.billingRounding} IN ('none', 'tenth_hour_up', 'quarter_hour_up', 'half_hour_up', 'hour_up')`
    ),
```

In `projects` (src/db/schema.ts:259-262), change the check `sql` to:

```typescript
    check(
      "projects_billing_rounding_check",
      sql`${table.billingRounding} IS NULL OR ${table.billingRounding} IN ('none', 'tenth_hour_up', 'quarter_hour_up', 'half_hour_up', 'hour_up')`
    ),
```

- [ ] **Step 6: Verify the app still type-checks**

Run: `npx tsc --noEmit`
Expected: no new errors from `src/db/schema.ts`.

- [ ] **Step 7: Commit**

```bash
git add drizzle/0019_profession_onboarding_cascade.sql src/db/schema.ts
git commit -m "feat(db): add profession/base columns + widen rounding checks (DEV applied)"
```

---

## Task 5: GET /api/geo

**Files:**
- Create: `app/api/geo/route.ts`

- [ ] **Step 1: Create the route**

```typescript
/**
 * GET /api/geo — best-effort country detection from Vercel's edge geo header,
 * returning a suggested onboarding currency. Suggestion only; never persisted
 * here. No header (local dev) → ILS fallback.
 */
import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { currencyForCountry } from "@/lib/geo-currency";

export async function GET(request: Request): Promise<NextResponse> {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ success: false, message: "לא מחובר" }, { status: 401 });
  }
  const country = request.headers.get("x-vercel-ip-country");
  return NextResponse.json({
    success: true,
    country,
    suggestedCurrency: currencyForCountry(country),
  });
}
```

- [ ] **Step 2: Verify type-check + a manual hit**

Run: `npx tsc --noEmit`
Expected: no errors.

Run (dev server already up, logged in): `curl -s localhost:3000/api/geo`
Expected (logged out via curl): `{"success":false,"message":"לא מחובר"}` — confirms the route resolves. (Authenticated browser hit returns `{ success: true, country: null, suggestedCurrency: "ILS" }` locally.)

- [ ] **Step 3: Commit**

```bash
git add app/api/geo/route.ts
git commit -m "feat(api): add GET /api/geo for onboarding currency suggestion"
```

---

## Task 6: Profile API — PATCH/GET the new fields

**Files:**
- Modify: `app/api/profile/route.ts`

- [ ] **Step 1: Extend imports + Zod schema**

In `app/api/profile/route.ts`, add imports near the existing `isThemeId` import (line 12):

```typescript
import { isThemeId } from "@/lib/themes";
import { isProfessionId } from "@/lib/professions";
import { ROUNDING_MODES } from "@/lib/rounding";
```

In `updateProfileSchema`, add these keys (after the `theme` line, ~line 54):

```typescript
  theme: z.string().max(50).optional(),
  // Onboarding / billing base. profession + defaultBillingRounding are
  // allow-list-checked in the handler (Hebrew 400 on bad value).
  profession: z.string().max(50).nullable().optional(),
  defaultRate: z.number().nullable().optional(),
  defaultBillingRounding: z.string().max(50).optional(),
  onboarded: z.boolean().optional(),
```

- [ ] **Step 2: Extend the `Profile` interface**

In the `Profile` interface, add (anywhere among the fields):

```typescript
  profession: string | null;
  defaultRate: number | null;
  defaultBillingRounding: string;
  onboarded: boolean;
```

- [ ] **Step 3: Add the fields to the GET SELECT + mapping**

In the GET handler's SELECT (around src/.../route.ts:122-134, the column list), add:

```sql
              COALESCE(theme, 'dark') as "theme",
              profession as "profession",
              default_rate as "defaultRate",
              COALESCE(default_billing_rounding, 'none') as "defaultBillingRounding",
              COALESCE(onboarded, false) as "onboarded",
```

(Insert the four new lines right after the existing `theme` line in that SELECT. Do the same in the second SELECT used by the PATCH response near line 355.)

- [ ] **Step 4: Add the PATCH update branches**

In the PATCH handler, after the existing `theme` branch (around line 323-334), add:

```typescript
    if (body.profession !== undefined) {
      // null clears the column; a value must be a known preset id.
      if (body.profession !== null && !isProfessionId(body.profession)) {
        return NextResponse.json(
          { success: false, error_code: "INVALID_PROFESSION", message: "מקצוע לא תקין" },
          { status: 400 }
        );
      }
      updates.push(`profession = $${paramIndex++}`);
      values.push(body.profession);
    }
    if (body.defaultRate !== undefined) {
      updates.push(`default_rate = $${paramIndex++}`);
      values.push(body.defaultRate);
    }
    if (body.defaultBillingRounding !== undefined) {
      if (!(ROUNDING_MODES as readonly string[]).includes(body.defaultBillingRounding)) {
        return NextResponse.json(
          { success: false, error_code: "INVALID_ROUNDING", message: "עיגול חיוב לא תקין" },
          { status: 400 }
        );
      }
      updates.push(`default_billing_rounding = $${paramIndex++}`);
      values.push(body.defaultBillingRounding);
    }
    if (body.onboarded !== undefined) {
      updates.push(`onboarded = $${paramIndex++}`);
      values.push(body.onboarded);
    }
```

- [ ] **Step 5: Verify type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add app/api/profile/route.ts
git commit -m "feat(api): profile PATCH/GET for profession + billing base + onboarded"
```

---

## Task 7: Clients POST — NULL-inherit rounding, seed currency

**Files:**
- Modify: `app/api/clients/route.ts`

> Rationale: **rounding** stays `NULL` (live-inherit the profile base, resolved at
> report time). **currency** is *seeded* from the base at creation (a client always
> needs a concrete currency for display, and shouldn't silently flip if the base
> changes later). **rate** already stores `NULL` when absent — no change; the base
> falls in at billing time (Task 12).

- [ ] **Step 1: Widen the `billingRounding` Zod enum**

In `app/api/clients/route.ts:23`, change:

```typescript
  billingRounding: z.enum(["none", "hour_up", "half_hour_up"]).nullish(),
```
to:
```typescript
  billingRounding: z.enum(["none", "tenth_hour_up", "quarter_hour_up", "half_hour_up", "hour_up"]).nullish(),
```

- [ ] **Step 2: Fetch the profile base currency before the INSERT**

In the POST handler, after `parsed.data` is destructured (around line 167) and before the INSERT, add:

```typescript
    // Seed currency from the user's base when the client didn't specify one.
    const profileRow = await query<{ default_currency: string | null }>(
      `SELECT default_currency FROM user_profiles WHERE user_id = $1`,
      [user.id]
    );
    const baseCurrency = profileRow.rows[0]?.default_currency || "ILS";
```

- [ ] **Step 3: Change the INSERT parameter values**

In the INSERT `values` array (around lines 222-224), change:

```typescript
          effectiveDefaultRate,
          currency || "ILS",
          billingRounding || "none",
```
to:
```typescript
          effectiveDefaultRate,
          currency || baseCurrency,
          billingRounding ?? null,
```

(`billingRounding ?? null` stores NULL = inherit the profile base when the client
didn't explicitly choose; an explicit `'none'` still persists as an override.)

- [ ] **Step 4: Verify type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/api/clients/route.ts
git commit -m "feat(api): new clients inherit base rounding (NULL) + seed base currency"
```

---

## Task 8: Messages (he + en)

**Files:**
- Modify: `messages/he.json`, `messages/en.json`

> A `messages-parity` test enforces he/en key parity — add the SAME keys to both.

- [ ] **Step 1: Add the new rounding-mode labels**

In `messages/he.json` `"Rounding"` block (line 130) add the two keys:

```json
  "Rounding": {
    "none": "ללא עיגול",
    "tenth_hour_up": "עיגול לעשירית שעה — 6 דק' (הסטנדרט המשפטי)",
    "quarter_hour_up": "עיגול לרבע שעה — 15 דק' (כלפי מעלה)",
    "hour_up": "עיגול לשעה מלאה (כלפי מעלה)",
    "half_hour_up": "עיגול לחצי שעה (כלפי מעלה)"
  },
```

In `messages/en.json` `"Rounding"` block (line 130):

```json
  "Rounding": {
    "none": "No rounding",
    "tenth_hour_up": "Round up to 6 min (tenth of an hour — legal standard)",
    "quarter_hour_up": "Round up to 15 min (quarter hour)",
    "hour_up": "Round up to a full hour",
    "half_hour_up": "Round up to a half hour"
  },
```

- [ ] **Step 2: Add the `Onboarding` namespace to he.json**

Add a top-level `"Onboarding"` object (place it alphabetically/near other namespaces):

```json
  "Onboarding": {
    "title": "בוא נכין את החשבון שלך",
    "subtitle": "כמה הגדרות מהירות כדי שמוניט יתאים לך מהרגע הראשון. אפשר לשנות הכל אחר כך בהגדרות.",
    "professionLabel": "מה התחום שלך?",
    "currencyLabel": "מטבע ברירת מחדל",
    "currencyHint": "זיהינו אותו לפי המיקום שלך — אפשר לשנות.",
    "rateLabel": "תעריף שעתי (ברירת מחדל)",
    "ratePlaceholder": "למשל 400",
    "roundingLabel": "עיגול חיוב",
    "appearanceLabel": "מראה",
    "save": "שמירה והתחלה",
    "skip": "דלג",
    "saveError": "השמירה נכשלה. נסה שוב.",
    "professions": {
      "lawyer": "עו\"ד",
      "accountant": "רו\"ח / יועץ מס",
      "consultant": "יועץ עסקי / מאמן",
      "developer": "מפתח תוכנה",
      "designer": "מעצב גרפי / UX",
      "photographer": "צלם / וידאו",
      "writer": "כותב תוכן / קופירייטר",
      "other": "אחר / כללי"
    }
  },
```

- [ ] **Step 3: Add the matching `Onboarding` namespace to en.json**

```json
  "Onboarding": {
    "title": "Let's set up your account",
    "subtitle": "A few quick settings so Monit fits you from day one. You can change everything later in Settings.",
    "professionLabel": "What's your field?",
    "currencyLabel": "Default currency",
    "currencyHint": "Detected from your location — change it if needed.",
    "rateLabel": "Default hourly rate",
    "ratePlaceholder": "e.g. 400",
    "roundingLabel": "Billing rounding",
    "appearanceLabel": "Appearance",
    "save": "Save & start",
    "skip": "Skip",
    "saveError": "Save failed. Please try again.",
    "professions": {
      "lawyer": "Lawyer",
      "accountant": "Accountant / Tax advisor",
      "consultant": "Consultant / Coach",
      "developer": "Software developer",
      "designer": "Graphic / UX designer",
      "photographer": "Photographer / Video",
      "writer": "Content writer / Copywriter",
      "other": "Other / General"
    }
  },
```

- [ ] **Step 4: Add EUR to the currency option labels (if a Currencies label map exists)**

Search for where currency options are labeled:

Run: `grep -n "\"USD\"\|\"ILS\"" messages/he.json messages/en.json`

If a currency-name map exists (e.g. a `Currencies`/`currencyNames` block), add `"EUR": "אירו"` (he) / `"EUR": "Euro"` (en) in both files at the same key. If currencies are rendered purely from `CURRENCY_SYMBOLS` with no label map, skip this step.

- [ ] **Step 5: Verify parity**

Run: `npm test` (or `npx tsx tests/unit/messages-parity.test.ts` if it runs standalone)
Expected: parity test PASSES (he/en have identical key sets).

- [ ] **Step 6: Commit**

```bash
git add messages/he.json messages/en.json
git commit -m "feat(i18n): onboarding copy, new rounding labels, EUR"
```

---

## Task 9: Onboarding modal component

**Files:**
- Create: `components/onboarding-modal.tsx`

> Reuses `useTheme()` for the theme picker (live preview + persist via its existing
> PATCH). The remaining base fields are saved in one PATCH on submit. Honors the 4 UX
> states: success (closes), error (inline Hebrew + retry, stays open), loading
> (disabled submit + spinner). Uses design tokens only — no hardcoded colors.

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { PROFESSIONS, getProfession } from "@/lib/professions";
import { ROUNDING_MODES } from "@/lib/rounding";
import { CURRENCY_SYMBOLS } from "@/lib/currency";
import { THEMES } from "@/lib/themes";
import { useTheme } from "@/components/theme-provider";

const CURRENCY_OPTIONS = ["ILS", "USD", "EUR", "USDT", "BTC", "ETH"];

interface OnboardingModalProps {
  /** Called after a successful save or skip so the parent can hide the modal. */
  onDone: () => void;
}

export function OnboardingModal({ onDone }: OnboardingModalProps) {
  const t = useTranslations("Onboarding");
  const tRounding = useTranslations("Rounding");
  const { theme, setTheme } = useTheme();

  const [profession, setProfession] = useState<string>("other");
  const [currency, setCurrency] = useState<string>("ILS");
  const [rate, setRate] = useState<string>("");
  const [rounding, setRounding] = useState<string>("none");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Geo-suggested currency (suggestion only).
  useEffect(() => {
    let active = true;
    fetch("/api/geo")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (active && data?.suggestedCurrency) setCurrency(data.suggestedCurrency);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Picking a profession prefills rounding (user can still change it).
  function chooseProfession(id: string) {
    setProfession(id);
    const preset = getProfession(id);
    if (preset) setRounding(preset.defaults.defaultBillingRounding);
  }

  const selectedPreset = useMemo(() => getProfession(profession), [profession]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const parsedRate = rate.trim() === "" ? null : Number(rate);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          profession,
          defaultCurrency: currency,
          defaultRate: Number.isFinite(parsedRate as number) ? parsedRate : null,
          defaultBillingRounding: rounding,
          paymentTerms: selectedPreset?.defaults.paymentTerms ?? undefined,
          preferredPdfTemplate: selectedPreset?.defaults.preferredPdfTemplate,
          onboarded: true,
        }),
      });
      if (!res.ok) throw new Error("save failed");
      onDone();
    } catch {
      setError(t("saveError"));
      setSaving(false);
    }
  }

  async function handleSkip() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ onboarded: true }),
      });
      if (!res.ok) throw new Error("save failed");
      onDone();
    } catch {
      setError(t("saveError"));
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[var(--radius-card)] border border-border bg-card p-6 space-y-6">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-foreground">{t("title")}</h2>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>

        {/* Profession */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">{t("professionLabel")}</label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {PROFESSIONS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => chooseProfession(p.id)}
                className={`rounded-[var(--radius)] border p-3 text-start text-sm transition-colors ${
                  profession === p.id
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-surface text-muted-foreground hover:border-border-strong"
                }`}
              >
                <span className="block font-medium text-foreground">{t(`professions.${p.id}`)}</span>
                {p.modelHintHe ? (
                  <span className="block text-xs text-muted-foreground">{p.modelHintHe}</span>
                ) : null}
              </button>
            ))}
          </div>
        </div>

        {/* Currency + Rate */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="ob-currency" className="text-sm font-medium text-foreground">
              {t("currencyLabel")}
            </label>
            <select
              id="ob-currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full rounded-[var(--radius)] border border-border bg-surface px-3 py-2 text-foreground"
            >
              {CURRENCY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c} {CURRENCY_SYMBOLS[c] ?? ""}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">{t("currencyHint")}</p>
          </div>
          <div className="space-y-2">
            <label htmlFor="ob-rate" className="text-sm font-medium text-foreground">
              {t("rateLabel")}
            </label>
            <input
              id="ob-rate"
              type="number"
              inputMode="decimal"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder={t("ratePlaceholder")}
              className="w-full rounded-[var(--radius)] border border-border bg-surface px-3 py-2 text-foreground"
            />
          </div>
        </div>

        {/* Rounding */}
        <div className="space-y-2">
          <label htmlFor="ob-rounding" className="text-sm font-medium text-foreground">
            {t("roundingLabel")}
          </label>
          <select
            id="ob-rounding"
            value={rounding}
            onChange={(e) => setRounding(e.target.value)}
            className="w-full rounded-[var(--radius)] border border-border bg-surface px-3 py-2 text-foreground"
          >
            {ROUNDING_MODES.map((m) => (
              <option key={m} value={m}>
                {tRounding(m)}
              </option>
            ))}
          </select>
        </div>

        {/* Appearance (theme) — live preview via useTheme */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">{t("appearanceLabel")}</label>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {THEMES.map((th) => (
              <button
                key={th.id}
                type="button"
                onClick={() => setTheme(th.id)}
                aria-label={th.labelHe}
                className={`rounded-[var(--radius)] border p-1 ${
                  theme === th.id ? "border-primary" : "border-border hover:border-border-strong"
                }`}
              >
                <span className="flex h-6 overflow-hidden rounded-[6px]">
                  {th.swatch.map((c, i) => (
                    <span key={i} className="flex-1" style={{ backgroundColor: c }} />
                  ))}
                </span>
              </button>
            ))}
          </div>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleSkip}
            disabled={saving}
            className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            {t("skip")}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-[var(--radius)] bg-primary px-5 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {saving ? "…" : t("save")}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/onboarding-modal.tsx
git commit -m "feat(onboarding): billing-base modal (profession, currency, rate, rounding, theme)"
```

---

## Task 10: Mount the modal in the dashboard

**Files:**
- Modify: `app/[locale]/dashboard/page.tsx`

- [ ] **Step 1: Add imports**

At the top of `app/[locale]/dashboard/page.tsx` (with the other component imports):

```typescript
import { OnboardingModal } from "@/components/onboarding-modal";
```

- [ ] **Step 2: Add onboarding state + fetch**

Inside the dashboard component body (near the other `useState`/`useEffect` hooks), add:

```typescript
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (active && data?.profile && data.profile.onboarded === false) {
          setShowOnboarding(true);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
```

(Confirm the GET shape: the profile GET returns `{ success, profile }` — match the
existing settings page usage `data.profile.preferredPdfTemplate`. If the key differs,
align this access to it.)

- [ ] **Step 3: Render the modal**

At the top of the returned JSX (just inside the outermost wrapper, e.g. right after the
opening `<AppLayout>` or page container), add:

```tsx
      {showOnboarding && <OnboardingModal onDone={() => setShowOnboarding(false)} />}
```

- [ ] **Step 4: Verify type-check + manual flow**

Run: `npx tsc --noEmit`
Expected: no errors.

Manual: temporarily set a dev user's `onboarded=false`
(`psql ... -c "UPDATE user_profiles SET onboarded=false WHERE user_id='<id>'"`), reload
`/dashboard` → modal appears; save → modal closes; reload → does not reappear.

- [ ] **Step 5: Commit**

```bash
git add "app/[locale]/dashboard/page.tsx"
git commit -m "feat(dashboard): show onboarding modal on first entry"
```

---

## Task 11: Settings billing tab — base fields (rate + rounding)

**Files:**
- Modify: `app/[locale]/settings/page.tsx`

> Makes the base editable after onboarding (currency already lives in settings;
> theme already lives in the Appearance tab). Add default rate + default rounding to
> the existing billing tab panel.

- [ ] **Step 1: Add state + load + save wiring**

In `app/[locale]/settings/page.tsx`, add state near the other profile states (e.g. by
`preferredPdfTemplate`, line ~127):

```typescript
  const [defaultRate, setDefaultRate] = useState<string>("");
  const [defaultBillingRounding, setDefaultBillingRounding] = useState<string>("none");
```

In the profile-load effect (near line ~202 where `setPreferredPdfTemplate(...)` runs):

```typescript
        setDefaultRate(data.profile.defaultRate != null ? String(data.profile.defaultRate) : "");
        setDefaultBillingRounding(data.profile.defaultBillingRounding || "none");
```

In the save handler payload (near line ~312 where `preferredPdfTemplate` is sent):

```typescript
          defaultRate: defaultRate.trim() === "" ? null : Number(defaultRate),
          defaultBillingRounding,
```

- [ ] **Step 2: Add the inputs to the billing tab panel**

Add the import for rounding modes at top:

```typescript
import { ROUNDING_MODES } from "@/lib/rounding";
```

Inside the billing tabpanel (the `role="tabpanel"` block reached via `billing.tabLabel`,
around line 1255/1311 — locate the billing panel), add:

```tsx
            <div className="space-y-2">
              <label htmlFor="defaultRate" className="text-sm font-medium text-foreground">
                {t("billing.defaultRateLabel")}
              </label>
              <input
                id="defaultRate"
                type="number"
                inputMode="decimal"
                value={defaultRate}
                onChange={(e) => setDefaultRate(e.target.value)}
                className="w-full rounded-[var(--radius)] border border-border bg-surface px-3 py-2 text-foreground"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="defaultBillingRounding" className="text-sm font-medium text-foreground">
                {t("billing.defaultRoundingLabel")}
              </label>
              <select
                id="defaultBillingRounding"
                value={defaultBillingRounding}
                onChange={(e) => setDefaultBillingRounding(e.target.value)}
                className="w-full rounded-[var(--radius)] border border-border bg-surface px-3 py-2 text-foreground"
              >
                {ROUNDING_MODES.map((m) => (
                  <option key={m} value={m}>
                    {tRounding(m)}
                  </option>
                ))}
              </select>
            </div>
```

(If the settings page doesn't already have `const tRounding = useTranslations("Rounding")`,
add it near the other `useTranslations` calls.)

- [ ] **Step 3: Add the billing labels to messages (he + en)**

In `messages/he.json` under the existing `"Settings"`/billing section that holds
`billing.tabLabel`, add `defaultRateLabel` and `defaultRoundingLabel`:

he: `"defaultRateLabel": "תעריף שעתי ברירת מחדל"`, `"defaultRoundingLabel": "עיגול חיוב ברירת מחדל"`
en: `"defaultRateLabel": "Default hourly rate"`, `"defaultRoundingLabel": "Default billing rounding"`

(Place them as siblings of `tabLabel` in the same `billing` object, in BOTH files.)

- [ ] **Step 4: Verify type-check + parity**

Run: `npx tsc --noEmit && npm test`
Expected: no type errors; messages parity passes.

- [ ] **Step 5: Commit**

```bash
git add "app/[locale]/settings/page.tsx" messages/he.json messages/en.json
git commit -m "feat(settings): edit billing base (default rate + rounding)"
```

---

## Task 12: Thread profile base into billing resolution (reports + charge-docs)

**Files:**
- Modify: `app/api/reports/route.ts`
- Modify: `app/api/charge-documents/route.ts`
- Modify: `app/api/charge-documents/billable/route.ts`

> Makes the cascade actually pay out: when a client/project doesn't set rounding,
> the profile base applies; when no task/client rate exists, the base rate applies.

### 12a — reports route

- [ ] **Step 1: Load the profile base once**

In `app/api/reports/route.ts`, before the row `.map(...)` (the query result is at the
`}>(queryText, queryParams);` line, ~124), add:

```typescript
    const profileBase = await query<{ default_billing_rounding: string | null; default_rate: number | null }>(
      `SELECT default_billing_rounding, default_rate FROM user_profiles WHERE user_id = $1`,
      [user.id]
    );
    const baseRounding = profileBase.rows[0]?.default_billing_rounding ?? null;
    const baseRate = profileBase.rows[0]?.default_rate ?? null;
```

(Confirm `user` is in scope in this handler — it follows the standard `getUser()` pattern.)

- [ ] **Step 2: Pass the base into resolve + rate fallback**

Change the two lines inside the map (currently ~131-133):

```typescript
      const effectiveRate = entry.rate ?? entry.hourly_rate;
      ...
      const roundingMode = resolveRounding(entry.project_rounding, entry.client_rounding);
```
to:
```typescript
      const effectiveRate = entry.rate ?? entry.hourly_rate ?? baseRate;
      ...
      const roundingMode = resolveRounding(entry.project_rounding, entry.client_rounding, baseRounding);
```

### 12b — charge-documents route

- [ ] **Step 3: Load the base + thread it**

In `app/api/charge-documents/route.ts`, before the `resolveRounding(...)` call (~77), load:

```typescript
    const cdProfile = await query<{ default_billing_rounding: string | null; default_rate: number | null }>(
      `SELECT default_billing_rounding, default_rate FROM user_profiles WHERE user_id = $1`,
      [user.id]
    );
    const cdBaseRounding = cdProfile.rows[0]?.default_billing_rounding ?? null;
    const cdBaseRate = cdProfile.rows[0]?.default_rate ?? null;
```

Update the `resolveRounding(...)` call at ~77 to pass `cdBaseRounding` as the 3rd arg.
If this route computes an effective rate with a `?? client_rate` chain, append
`?? cdBaseRate` to it (search for `.rate ??` in the file; if no such chain exists, the
rate base is already covered by reports — leave rate alone here).

### 12c — billable route

- [ ] **Step 4: Load the base + thread it**

In `app/api/charge-documents/billable/route.ts`, before the `resolveRounding(...)` at ~53:

```typescript
    const blProfile = await query<{ default_billing_rounding: string | null; default_rate: number | null }>(
      `SELECT default_billing_rounding, default_rate FROM user_profiles WHERE user_id = $1`,
      [user.id]
    );
    const blBaseRounding = blProfile.rows[0]?.default_billing_rounding ?? null;
    const blBaseRate = blProfile.rows[0]?.default_rate ?? null;
```

Update `resolveRounding(project_rounding, client_rounding)` → add `blBaseRounding` 3rd arg.
Append `?? blBaseRate` to the effective-rate chain in this file if one exists.

- [ ] **Step 5: Verify type-check + tests**

Run: `npx tsc --noEmit && npm test`
Expected: no errors; all unit tests pass.

- [ ] **Step 6: Commit**

```bash
git add app/api/reports/route.ts app/api/charge-documents/route.ts app/api/charge-documents/billable/route.ts
git commit -m "feat(billing): apply profile base (rounding + rate) in reports and charge docs"
```

---

## Task 13: Full verification + in-browser light-theme check

**Files:** none (verification only)

- [ ] **Step 1: Run the full test + lint + type suite**

Run: `npm test && npm run lint && npx tsc --noEmit`
Expected: all green, zero lint warnings (the repo enforces a zero-warning gate).

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: build succeeds; `/pricing` and `/login` remain static (no `cookies()`/`getUser()`
crept into the root layout).

- [ ] **Step 3: In-browser onboarding flow on a LIGHT theme**

Start dev (`npm run dev`). Set a dev user `onboarded=false`. Open `/dashboard`:
1. Modal appears; pick a profession → rounding prefills.
2. Switch the appearance to a **light** theme (e.g. `daylight`) — confirm **all modal text
   stays legible** (uses `text-foreground`, not `text-white`); swatches, labels, buttons
   readable. This is the explicit lesson from the Theme Set feature.
3. Enter a rate, confirm currency, Save → toast/closes; reload → no modal.
4. Create a new client without choosing rounding/currency → DB row has
   `billing_rounding IS NULL` and `currency = <base>`.
5. Generate a report for that client → rounding reflects the profile base; rate falls back
   to the base when no task/client rate.

- [ ] **Step 4: Verify the skip path**

Reset `onboarded=false`, reload, click "דלג" → `onboarded=true`, profession stays NULL,
modal gone on reload.

- [ ] **Step 5: Final commit (if any verification fixups were needed)**

```bash
git add -A
git commit -m "chore(onboarding): verification fixups"
```

> **PROD migration (separate, owner-approved step — NOT part of normal task execution):**
> After merge, apply `drizzle/0019_profession_onboarding_cascade.sql` to PROD using the
> admin connection string in `.env.local.bak.prod-shared`, only with explicit approval
> from the owner (benatia.asaf@gmail.com), per project convention.

---

## Self-Review

**Spec coverage:**
- 3-tier cascade (rounding) → Tasks 1, 7, 12. Rate base → Tasks 6, 12. Currency seed → Task 7. ✅
- Onboarding modal (profession, currency, rate, rounding, theme) → Tasks 9, 10. ✅
- New-users-only via `onboarded` backfill → Task 4. ✅
- Profession registry → Task 2. Rounding modes (6/15 min) → Task 1. EUR + geo → Tasks 3, 5. ✅
- Schema via psql admin (DEV; PROD deferred) → Task 4 + Task 13 note. ✅
- API (profile, clients, geo) → Tasks 5, 6, 7. ✅
- i18n he/en parity + design tokens + light-theme verify → Tasks 8, 11, 13. ✅
- Settings editability of the base → Task 11. ✅
- Tests (rounding, professions, geo, parity) → Tasks 1, 2, 3, 8. ✅

**Placeholder scan:** No TBD/"add validation"/"similar to". Each code step shows full code.
The only conditional steps (Task 12b/12c rate chain, Task 8 step 4 EUR label) give an exact
`grep` to locate and an explicit "if present / else skip" rule.

**Type consistency:** `RoundingMode`, `ROUNDING_MODES`, `resolveRounding(project, client, profile?)`,
`isProfessionId`, `getProfession`, `PROFESSIONS`, `currencyForCountry`, profile fields
(`profession`, `defaultRate`, `defaultBillingRounding`, `onboarded`) are named identically
across all tasks and match the spec.
