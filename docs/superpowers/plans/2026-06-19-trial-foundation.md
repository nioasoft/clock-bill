# Trial Foundation — Implementation Plan (1 of 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** New non-founding users start a 14-day Unlimited trial on signup; `getUserPlan` resolves the trial state; a bilingual day-0 welcome email is sent.

**Architecture:** Trial state is stored on `user_profiles` (`trial_started_at`, `trial_ends_at`, `trial_used`) and derived on read by a pure `resolvePlan(row, now)` function. The Better Auth `databaseHooks.user.create.after` seeds the trial and triggers the welcome email. Pure helpers carry the logic so the custom tsx unit runner can test without a DB.

**Tech Stack:** Next.js 16, Postgres (raw `query()` from `lib/db.ts`, `$1` placeholders), Drizzle schema (`src/db/schema.ts`), Better Auth, Resend (`lib/email.ts`), next-intl, custom tsx test runner (`tests/unit/*.test.ts`).

This is **plan 1 of 4**. Follow-ups (not in this plan): (2) Client locking + 402 write guards, (3) In-app nudges + pricing UI, (4) Email lifecycle cron. Source spec: `docs/superpowers/specs/2026-06-19-trial-conversion-engine-design.md`.

## Global Constraints

- **Bilingual:** every user-facing string exists in both `messages/he.json` and `messages/en.json`; email copy keyed per locale (`he` RTL / `en` LTR). No hardcoded user-facing text.
- **TRIAL_DAYS = 14** — single source of truth in `lib/plans.ts`; never inline the number elsewhere.
- **DB access:** raw `query()` from `@/lib/db` with `$1` placeholders; every user-data write binds RLS via `setUserContext(userId)` when there is no session (signup hook).
- **Migrations:** generate the `.sql` for review, but **apply via `psql` using `DATABASE_URL_ADMIN`** (dev now, prod at deploy) — NOT `db:migrate` (drizzle journal drift, see project memory).
- **Tests:** custom tsx runner; each test file is self-contained (inline `TestRunner` + `assertEqual`), run via `npx tsx tests/unit/<file>.test.ts`.
- **TypeScript:** strict, no `any`; explicit types on exported functions; files 200–400 lines.
- **Founding users** (`founding=true`) never get a trial; they resolve to `unlimited` directly.

---

### Task 1: Pure trial-math helpers in `lib/plans.ts`

**Files:**
- Modify: `lib/plans.ts` (append helpers)
- Test: `tests/unit/trial-plans.test.ts` (create)

**Interfaces:**
- Produces: `TRIAL_DAYS: number`, `computeTrialEnd(start: Date): Date`, `isTrialActive(endsAt: Date | null, now: Date): boolean`, `trialDaysLeft(endsAt: Date, now: Date): number`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/trial-plans.test.ts`:

```typescript
/** Unit tests for trial-math helpers in lib/plans.ts */
import { TRIAL_DAYS, computeTrialEnd, isTrialActive, trialDaysLeft } from "../../lib/plans";

class TestRunner {
  private tests: Array<{ name: string; fn: () => void }> = [];
  private passed = 0;
  private failed = 0;
  test(name: string, fn: () => void) { this.tests.push({ name, fn }); }
  async run() {
    console.log("🧪 Running trial-plans tests...\n");
    for (const { name, fn } of this.tests) {
      try { fn(); this.passed++; console.log(`  ✅ ${name}`); }
      catch (e) { this.failed++; console.error(`  ❌ ${name}`); if (e instanceof Error) console.error(`     ${e.message}`); }
    }
    console.log(`\n${this.passed} passed, ${this.failed} failed`);
    if (this.failed > 0) process.exit(1);
  }
}
function assertEqual<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) throw new Error(message ?? `Expected ${expected}, got ${actual}`);
}
const runner = new TestRunner();

runner.test("TRIAL_DAYS is 14", () => assertEqual(TRIAL_DAYS, 14));

runner.test("computeTrialEnd adds 14 days", () => {
  const start = new Date("2026-06-19T00:00:00.000Z");
  assertEqual(computeTrialEnd(start).toISOString(), "2026-07-03T00:00:00.000Z");
});

runner.test("isTrialActive: future end is active", () => {
  assertEqual(isTrialActive(new Date("2026-07-03T00:00:00Z"), new Date("2026-06-25T00:00:00Z")), true);
});
runner.test("isTrialActive: past end is inactive", () => {
  assertEqual(isTrialActive(new Date("2026-06-19T00:00:00Z"), new Date("2026-06-25T00:00:00Z")), false);
});
runner.test("isTrialActive: null end is inactive", () => {
  assertEqual(isTrialActive(null, new Date("2026-06-25T00:00:00Z")), false);
});

runner.test("trialDaysLeft: ceils partial days", () => {
  // 3.5 days left -> 4
  const now = new Date("2026-06-19T12:00:00Z");
  const end = new Date("2026-06-23T00:00:00Z");
  assertEqual(trialDaysLeft(end, now), 4);
});
runner.test("trialDaysLeft: never negative", () => {
  assertEqual(trialDaysLeft(new Date("2026-06-19T00:00:00Z"), new Date("2026-06-25T00:00:00Z")), 0);
});

runner.run();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx tests/unit/trial-plans.test.ts`
Expected: FAIL — `TRIAL_DAYS`/helpers not exported from `lib/plans.ts`.

- [ ] **Step 3: Write minimal implementation**

Append to `lib/plans.ts`:

```typescript
/** Length of the free Unlimited trial for new accounts, in days. */
export const TRIAL_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Trial end = start + TRIAL_DAYS (returns a new Date; does not mutate). */
export function computeTrialEnd(start: Date): Date {
  return new Date(start.getTime() + TRIAL_DAYS * DAY_MS);
}

/** True while the trial is still running (end in the future). */
export function isTrialActive(endsAt: Date | null, now: Date): boolean {
  return endsAt !== null && now.getTime() < endsAt.getTime();
}

/** Whole days remaining, ceil'd, never below 0. */
export function trialDaysLeft(endsAt: Date, now: Date): number {
  return Math.max(0, Math.ceil((endsAt.getTime() - now.getTime()) / DAY_MS));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx tests/unit/trial-plans.test.ts`
Expected: PASS — 8 passed, 0 failed.

- [ ] **Step 5: Commit**

```bash
git add lib/plans.ts tests/unit/trial-plans.test.ts
git commit -m "feat(billing): trial-math helpers (TRIAL_DAYS, computeTrialEnd, ...)"
```

---

### Task 2: Schema + migration for trial columns

**Files:**
- Modify: `src/db/schema.ts` (userProfiles block, ~line 174-183)
- Create: `drizzle/0023_trial.sql`

**Interfaces:**
- Produces: `user_profiles.trial_started_at`, `user_profiles.trial_ends_at` (timestamps, nullable), `user_profiles.trial_used` (boolean, default false)

- [ ] **Step 1: Add columns to Drizzle schema**

In `src/db/schema.ts`, inside the `userProfiles` table after `founding: boolean("founding").default(false),` add:

```typescript
  // ─── Trial (14-day Unlimited on signup; see lib/plans.ts TRIAL_DAYS) ──
  trialStartedAt: timestamp("trial_started_at"),
  trialEndsAt: timestamp("trial_ends_at"),
  trialUsed: boolean("trial_used").default(false),
```

- [ ] **Step 2: Write the migration SQL**

Create `drizzle/0023_trial.sql`:

```sql
-- Trial columns on user_profiles (14-day Unlimited trial on signup).
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS trial_started_at timestamp,
  ADD COLUMN IF NOT EXISTS trial_ends_at    timestamp,
  ADD COLUMN IF NOT EXISTS trial_used       boolean NOT NULL DEFAULT false;
```

- [ ] **Step 3: Apply to dev and verify columns exist**

Run (admin connection string from `.env.local` `DATABASE_URL_ADMIN`):

```bash
psql "$DATABASE_URL_ADMIN" -f drizzle/0023_trial.sql
psql "$DATABASE_URL_ADMIN" -c "\d user_profiles" | grep trial_
```

Expected: three rows — `trial_started_at`, `trial_ends_at`, `trial_used`.

- [ ] **Step 4: Commit**

```bash
git add src/db/schema.ts drizzle/0023_trial.sql
git commit -m "feat(db): add trial columns to user_profiles (migration 0023)"
```

> **Prod note (defer to deploy):** apply the same `psql -f drizzle/0023_trial.sql` against prod using the prod admin string (`.env.local.bak.prod-shared`) when this feature deploys. Do NOT run against prod during development.

---

### Task 3: `resolvePlan` pure function + trial-aware `getUserPlan`

**Files:**
- Modify: `lib/entitlements.ts`
- Test: `tests/unit/resolve-plan.test.ts` (create)

**Interfaces:**
- Consumes: `getClientLimit`, `isTrialActive`, `trialDaysLeft` from `lib/plans.ts`
- Produces: extended `UserPlan` with `trial: { active: boolean; endsAt: string | null; daysLeft: number | null } | null`; `resolvePlan(row: PlanRow | undefined, now: Date): UserPlan`; `PlanRow` interface. `getUserPlan(userId)` signature unchanged.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/resolve-plan.test.ts`:

```typescript
/** Unit tests for resolvePlan (pure plan-state resolution). */
import { resolvePlan, type PlanRow } from "../../lib/entitlements";

class TestRunner {
  private tests: Array<{ name: string; fn: () => void }> = [];
  private passed = 0; private failed = 0;
  test(name: string, fn: () => void) { this.tests.push({ name, fn }); }
  async run() {
    console.log("🧪 Running resolvePlan tests...\n");
    for (const { name, fn } of this.tests) {
      try { fn(); this.passed++; console.log(`  ✅ ${name}`); }
      catch (e) { this.failed++; console.error(`  ❌ ${name}`); if (e instanceof Error) console.error(`     ${e.message}`); }
    }
    console.log(`\n${this.passed} passed, ${this.failed} failed`);
    if (this.failed > 0) process.exit(1);
  }
}
function assertEqual<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) throw new Error(message ?? `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
const runner = new TestRunner();
const NOW = new Date("2026-06-25T00:00:00.000Z");
const base: PlanRow = { subscription_tier: "free", subscription_status: null, subscription_period_end: null, founding: false, trial_ends_at: null };

runner.test("founding -> unlimited, no trial", () => {
  const p = resolvePlan({ ...base, founding: true }, NOW);
  assertEqual(p.tier, "unlimited"); assertEqual(p.founding, true); assertEqual(p.trial, null);
});
runner.test("paid starter -> starter, no trial", () => {
  const p = resolvePlan({ ...base, subscription_tier: "starter" }, NOW);
  assertEqual(p.tier, "starter"); assertEqual(p.trial, null);
});
runner.test("active trial -> unlimited + trial.active", () => {
  const p = resolvePlan({ ...base, trial_ends_at: "2026-06-30T00:00:00.000Z" }, NOW);
  assertEqual(p.tier, "unlimited");
  assertEqual(p.trial?.active, true);
  assertEqual(p.trial?.daysLeft, 5);
});
runner.test("expired trial -> free + trial.active false", () => {
  const p = resolvePlan({ ...base, trial_ends_at: "2026-06-20T00:00:00.000Z" }, NOW);
  assertEqual(p.tier, "free");
  assertEqual(p.trial?.active, false);
  assertEqual(p.trial?.daysLeft, 0);
});
runner.test("never trialed -> free, trial null", () => {
  const p = resolvePlan(base, NOW);
  assertEqual(p.tier, "free"); assertEqual(p.trial, null);
});
runner.test("missing row -> free", () => {
  const p = resolvePlan(undefined, NOW);
  assertEqual(p.tier, "free"); assertEqual(p.founding, false);
});

runner.run();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx tests/unit/resolve-plan.test.ts`
Expected: FAIL — `resolvePlan`/`PlanRow` not exported.

- [ ] **Step 3: Implement `resolvePlan` and rewire `getUserPlan`**

In `lib/entitlements.ts`, update the import and the `UserPlan` interface, add `PlanRow` + `resolvePlan`, and make `getUserPlan` query `trial_ends_at` and delegate:

```typescript
import {
  getClientLimit,
  isPlanTier,
  isTrialActive,
  trialDaysLeft,
  type PlanTier,
} from "@/lib/plans";

export interface UserPlan {
  tier: PlanTier;
  clientLimit: number;
  status: string | null;
  periodEnd: string | null;
  founding: boolean;
  trial: { active: boolean; endsAt: string | null; daysLeft: number | null } | null;
}

/** Raw user_profiles columns needed to resolve a plan. */
export interface PlanRow {
  subscription_tier: string | null;
  subscription_status: string | null;
  subscription_period_end: string | null;
  founding: boolean | null;
  trial_ends_at: string | null;
}

/** Pure plan resolution: founding > paid > active trial > free. */
export function resolvePlan(row: PlanRow | undefined, now: Date): UserPlan {
  const status = row?.subscription_status ?? null;
  const periodEnd = row?.subscription_period_end ?? null;
  const founding = row?.founding ?? false;
  const make = (tier: PlanTier, trial: UserPlan["trial"]): UserPlan => ({
    tier, clientLimit: getClientLimit(tier), status, periodEnd, founding, trial,
  });

  if (founding) return make("unlimited", null);

  const rawTier = row?.subscription_tier ?? "free";
  if (rawTier === "starter" || rawTier === "unlimited") return make(rawTier, null);

  const endsAt = row?.trial_ends_at ? new Date(row.trial_ends_at) : null;
  if (isTrialActive(endsAt, now) && endsAt) {
    return make("unlimited", { active: true, endsAt: endsAt.toISOString(), daysLeft: trialDaysLeft(endsAt, now) });
  }
  if (endsAt) return make("free", { active: false, endsAt: endsAt.toISOString(), daysLeft: 0 });
  return make("free", null);
}

/** Resolve the effective plan for a user. Missing profile row => 'free'. */
export async function getUserPlan(userId: string): Promise<UserPlan> {
  const { query } = await import("@/lib/db");
  const result = await query<PlanRow>(
    `SELECT subscription_tier, subscription_status, subscription_period_end, founding, trial_ends_at
     FROM user_profiles WHERE user_id = $1`,
    [userId]
  );
  return resolvePlan(result.rows[0], new Date());
}
```

Note: `isPlanTier` may become unused — if so, remove it from the import to satisfy the zero-warning lint gate.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx tests/unit/resolve-plan.test.ts`
Expected: PASS — 6 passed, 0 failed.

- [ ] **Step 5: Verify the app still typechecks and lints**

Run: `npm run lint`
Expected: no errors/warnings (fix unused `isPlanTier` import if flagged).

- [ ] **Step 6: Commit**

```bash
git add lib/entitlements.ts tests/unit/resolve-plan.test.ts
git commit -m "feat(billing): trial-aware getUserPlan via pure resolvePlan"
```

---

### Task 4: Start the trial on signup

**Files:**
- Modify: `lib/auth/better-auth.ts` (databaseHooks.user.create.after, ~line 346-361)
- Create: `lib/trial.ts`
- Test: `tests/unit/trial-start.test.ts` (create)

**Interfaces:**
- Consumes: `computeTrialEnd`, `TRIAL_DAYS` from `lib/plans.ts`
- Produces: `buildTrialStart(now: Date): { startedAt: Date; endsAt: Date }` in `lib/trial.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/trial-start.test.ts`:

```typescript
/** Unit tests for buildTrialStart. */
import { buildTrialStart } from "../../lib/trial";

class TestRunner {
  private tests: Array<{ name: string; fn: () => void }> = [];
  private passed = 0; private failed = 0;
  test(name: string, fn: () => void) { this.tests.push({ name, fn }); }
  async run() {
    console.log("🧪 Running trial-start tests...\n");
    for (const { name, fn } of this.tests) {
      try { fn(); this.passed++; console.log(`  ✅ ${name}`); }
      catch (e) { this.failed++; console.error(`  ❌ ${name}`); if (e instanceof Error) console.error(`     ${e.message}`); }
    }
    console.log(`\n${this.passed} passed, ${this.failed} failed`);
    if (this.failed > 0) process.exit(1);
  }
}
function assertEqual<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) throw new Error(message ?? `Expected ${expected}, got ${actual}`);
}
const runner = new TestRunner();

runner.test("buildTrialStart: endsAt is 14 days after startedAt", () => {
  const now = new Date("2026-06-19T08:00:00.000Z");
  const { startedAt, endsAt } = buildTrialStart(now);
  assertEqual(startedAt.toISOString(), "2026-06-19T08:00:00.000Z");
  assertEqual(endsAt.toISOString(), "2026-07-03T08:00:00.000Z");
});

runner.run();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx tests/unit/trial-start.test.ts`
Expected: FAIL — `lib/trial.ts` does not exist.

- [ ] **Step 3: Create `lib/trial.ts`**

```typescript
/**
 * Trial lifecycle helpers (no I/O). The 14-day Unlimited trial begins on
 * signup for non-founding users. See lib/plans.ts for the day count.
 */
import { computeTrialEnd } from "@/lib/plans";

/** Compute the trial window for a new account starting now. */
export function buildTrialStart(now: Date): { startedAt: Date; endsAt: Date } {
  return { startedAt: now, endsAt: computeTrialEnd(now) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx tests/unit/trial-start.test.ts`
Expected: PASS — 1 passed, 0 failed.

- [ ] **Step 5: Wire the trial into the signup hook**

In `lib/auth/better-auth.ts`, replace the profile-seed INSERT inside `databaseHooks.user.create.after` so it also sets the trial columns. The current block inserts profile defaults; change it to:

```typescript
        after: async (createdUser) => {
          // Seed a profile row + start the 14-day Unlimited trial. Best-effort:
          // never fail signup because of this.
          try {
            const { buildTrialStart } = await import("@/lib/trial");
            const { startedAt, endsAt } = buildTrialStart(new Date());
            // Bind the tenant context so the INSERT satisfies RLS once enforced.
            setUserContext(createdUser.id);
            await query(
              `INSERT INTO user_profiles
                 (id, user_id, default_currency, preferred_pdf_template, theme,
                  trial_started_at, trial_ends_at, trial_used, created_at, updated_at)
               VALUES (gen_random_uuid()::text, $1, 'ILS', 'modern', 'dark',
                  $2, $3, true, NOW(), NOW())
               ON CONFLICT (user_id) DO NOTHING`,
              [createdUser.id, startedAt.toISOString(), endsAt.toISOString()]
            );
          } catch (error) {
            logger.error("Failed to seed user_profile / start trial on signup", error);
          }
        },
```

Note: founding accounts are flagged manually after creation, so this trial-start is harmless for them (founding overrides to unlimited in `resolvePlan` regardless).

- [ ] **Step 6: Manual verification (dev)**

Start dev (`npm run dev`), sign up a fresh account, then:

```bash
psql "$DATABASE_URL_ADMIN" -c "SELECT user_id, trial_started_at, trial_ends_at, trial_used FROM user_profiles ORDER BY created_at DESC LIMIT 1;"
```

Expected: `trial_ends_at` ≈ 14 days after `trial_started_at`, `trial_used = t`.

- [ ] **Step 7: Commit**

```bash
git add lib/trial.ts lib/auth/better-auth.ts tests/unit/trial-start.test.ts
git commit -m "feat(billing): start 14-day Unlimited trial on signup"
```

---

### Task 5: Bilingual day-0 welcome email

**Files:**
- Create: `lib/emails/trial.ts`
- Modify: `lib/auth/better-auth.ts` (send after the trial INSERT)
- Test: `tests/unit/trial-emails.test.ts` (create)

**Interfaces:**
- Consumes: `emailLayout`, `emailButton`, `type EmailLocale` from `lib/email.ts`; `TRIAL_DAYS` from `lib/plans.ts`
- Produces: `trialWelcomeEmail(locale: EmailLocale, appUrl: string): { subject: string; html: string }`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/trial-emails.test.ts`:

```typescript
/** Unit tests for trial email templates (bilingual). */
import { trialWelcomeEmail } from "../../lib/emails/trial";

class TestRunner {
  private tests: Array<{ name: string; fn: () => void }> = [];
  private passed = 0; private failed = 0;
  test(name: string, fn: () => void) { this.tests.push({ name, fn }); }
  async run() {
    console.log("🧪 Running trial-emails tests...\n");
    for (const { name, fn } of this.tests) {
      try { fn(); this.passed++; console.log(`  ✅ ${name}`); }
      catch (e) { this.failed++; console.error(`  ❌ ${name}`); if (e instanceof Error) console.error(`     ${e.message}`); }
    }
    console.log(`\n${this.passed} passed, ${this.failed} failed`);
    if (this.failed > 0) process.exit(1);
  }
}
function assert(cond: boolean, message: string) { if (!cond) throw new Error(message); }
const runner = new TestRunner();

runner.test("he welcome: RTL html + 14 + subject", () => {
  const { subject, html } = trialWelcomeEmail("he", "https://www.clock-bill.com");
  assert(subject.length > 0, "subject empty");
  assert(html.includes('dir="rtl"'), "expected RTL");
  assert(html.includes("14"), "expected trial days");
  assert(html.includes("https://www.clock-bill.com"), "expected CTA url");
});
runner.test("en welcome: LTR html + 14 + subject", () => {
  const { subject, html } = trialWelcomeEmail("en", "https://www.clock-bill.com");
  assert(subject.length > 0, "subject empty");
  assert(html.includes('dir="ltr"'), "expected LTR");
  assert(html.includes("14"), "expected trial days");
});

runner.run();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx tests/unit/trial-emails.test.ts`
Expected: FAIL — `lib/emails/trial.ts` does not exist.

- [ ] **Step 3: Create `lib/emails/trial.ts`**

```typescript
/**
 * Trial lifecycle email templates (bilingual he/en). Each returns the subject
 * and full HTML, built from the shared light-theme shell in lib/email.ts.
 */
import { emailLayout, emailButton, type EmailLocale } from "@/lib/email";
import { TRIAL_DAYS } from "@/lib/plans";

/** Day-0 welcome: trial has started, here's what you get. */
export function trialWelcomeEmail(locale: EmailLocale, appUrl: string): { subject: string; html: string } {
  const dashboardUrl = `${appUrl}/dashboard`;
  if (locale === "en") {
    return {
      subject: `Your ${TRIAL_DAYS}-day Unlimited trial has started`,
      html: emailLayout({
        locale,
        heading: "Welcome to ClockBill 🎉",
        bodyHtml:
          `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;">You're on the <strong>Unlimited</strong> plan for the next <strong>${TRIAL_DAYS} days</strong> — track unlimited clients, projects, and reports, no card required.</p>` +
          `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;">Add your clients now and see how much time you can bill.</p>` +
          emailButton(dashboardUrl, "Open ClockBill"),
      }),
    };
  }
  return {
    subject: `ה-${TRIAL_DAYS} ימי Unlimited שלך התחילו`,
    html: emailLayout({
      locale,
      heading: "ברוך הבא ל-ClockBill 🎉",
      bodyHtml:
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;">אתה על מסלול <strong>Unlimited</strong> ל-<strong>${TRIAL_DAYS} הימים</strong> הקרובים — לקוחות, פרויקטים ודוחות ללא הגבלה, בלי כרטיס אשראי.</p>` +
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;">הוסף את הלקוחות שלך עכשיו וראה כמה זמן אתה יכול לחייב.</p>` +
        emailButton(dashboardUrl, "פתח את ClockBill"),
    }),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx tests/unit/trial-emails.test.ts`
Expected: PASS — 2 passed, 0 failed.

- [ ] **Step 5: Send the welcome email from the signup hook**

In `lib/auth/better-auth.ts`, after the trial INSERT succeeds (still inside the `try`), add the send. Locale on a brand-new profile is unknown, so default to `"he"` (the app default); later lifecycle emails (plan 4) read `user_profiles.locale`.

```typescript
            // Day-0 welcome (best-effort; sendEmail no-ops without RESEND_API_KEY).
            const { sendEmail } = await import("@/lib/email");
            const { trialWelcomeEmail } = await import("@/lib/emails/trial");
            const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.clock-bill.com";
            const { subject, html } = trialWelcomeEmail("he", appUrl);
            if (createdUser.email) {
              await sendEmail({ to: createdUser.email, subject, html });
            }
```

- [ ] **Step 6: Verify lint + full unit suite**

Run: `npm run lint && npm test`
Expected: lint clean; all unit test files pass (including the four new trial test files).

- [ ] **Step 7: Commit**

```bash
git add lib/emails/trial.ts lib/auth/better-auth.ts tests/unit/trial-emails.test.ts
git commit -m "feat(billing): bilingual day-0 trial welcome email"
```

---

## Self-Review

**Spec coverage (foundation slice):** §2 state machine → Task 3 `resolvePlan` (founding/paid/trial/free precedence). §3 data model → Task 2 (3 columns; `plan_priority_at` belongs to plan 2, not here). §4 entitlement resolution → Task 3. §8 trial-start trigger → Task 4 (signup hook; founding-skip noted; existing-user backfill = out of scope, deferred per spec). §7 day-0 welcome email → Task 5 (the other 5 emails are plan 4). §10 i18n → Tasks 5 (email he/en); in-app strings are plans 2-3. Gaps are intentional and assigned to plans 2-4.

**Placeholder scan:** none — every step has real code/commands/expected output.

**Type consistency:** `UserPlan.trial` shape defined in Task 3 is consumed identically by later plans; `PlanRow` used by `resolvePlan` + `getUserPlan`; `buildTrialStart` return shape used in Task 4 wiring; `trialWelcomeEmail` signature matches its Task 5 call site. `TRIAL_DAYS` is the only source of the number across Tasks 1, 4, 5.

---

## What plans 2-4 will cover (roadmap, not yet written)
- **Plan 2 — Client Locking + Guards:** `clients.plan_priority_at` (migration 0024), `getClientLockState(userId)`, 402 `PLAN_LOCKED` guards on client-scoped write routes (full audit), "make this my active client" action.
- **Plan 3 — In-App Nudges + Pricing:** TrialPill, TrialDashboardCard, TrialEndingBanner, locked-row UI, UpgradeModal, usage-banner upgrade, pricing "what you'll keep"; all strings in `messages/{he,en}.json`.
- **Plan 4 — Email Lifecycle:** `trial_emails_sent` table, `app/api/cron/trial-lifecycle` (+ `vercel.json` cron), days 3/7/11/14/17 bilingual templates with idempotent send + paid/founding skip.
