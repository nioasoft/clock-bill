# Monetization Plan 1 — Subscription Entitlements & Client Gating

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add subscription tiers (Free 1 / Starter 5 / Unlimited ∞) and enforce the active-client cap server-side, with a usage banner in the UI. This ships working software *without* Polar — tier is read from a local column (default `free`, owner set to `founding`); Polar will later write that column (Plan 2).

**Architecture:** A pure, tested entitlement module (`lib/plans.ts`) defines tiers and caps. A thin server module (`lib/entitlements.ts`) reads the user's tier from `user_profiles` and counts active clients. The create-client and reactivate-client API routes enforce the cap. The clients page shows a usage banner + upgrade CTA.

**Tech Stack:** Next.js 16 App Router, TypeScript (strict), Drizzle schema + raw `pg` (`lib/db.ts` `query`), next-intl (he/en), custom tsx test runner (`tests/unit/*.test.ts`).

**Definitions:** "Active client" = `clients.is_active = TRUE` (archiving via DELETE sets it FALSE; PATCH restores it). Caps count active clients only.

---

### Task 1: Pure plan/entitlement module + tests

**Files:**
- Create: `lib/plans.ts`
- Test: `tests/unit/plans.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/plans.test.ts`:

```ts
/**
 * Unit tests for lib/plans.ts — tier caps and add-client gating (pure logic).
 */
import {
  PLAN_TIERS,
  getClientLimit,
  canAddClient,
  isPlanTier,
} from "../../lib/plans";

class TestRunner {
  private tests: Array<{ name: string; fn: () => void }> = [];
  private passed = 0;
  private failed = 0;
  test(name: string, fn: () => void) { this.tests.push({ name, fn }); }
  async run() {
    console.log("🧪 Running plans.ts tests...\n");
    for (const { name, fn } of this.tests) {
      try { fn(); this.passed++; console.log(`✅ ${name}`); }
      catch (e) { this.failed++; console.log(`❌ ${name}`); console.error(e); }
    }
    console.log(`\n${this.passed} passed, ${this.failed} failed`);
    process.exit(this.failed > 0 ? 1 : 0);
  }
}
function assertEqual(a: unknown, b: unknown, msg?: string) {
  if (a !== b) throw new Error(msg || `Expected ${b}, got ${a}`);
}

const r = new TestRunner();

r.test("tiers are free/starter/unlimited", () => {
  assertEqual(PLAN_TIERS.join(","), "free,starter,unlimited");
});
r.test("free cap is 1", () => assertEqual(getClientLimit("free"), 1));
r.test("starter cap is 5", () => assertEqual(getClientLimit("starter"), 5));
r.test("unlimited cap is Infinity", () => assertEqual(getClientLimit("unlimited"), Infinity));
r.test("free: 0 active can add", () => assertEqual(canAddClient("free", 0), true));
r.test("free: 1 active cannot add", () => assertEqual(canAddClient("free", 1), false));
r.test("starter: 4 active can add", () => assertEqual(canAddClient("starter", 4), true));
r.test("starter: 5 active cannot add", () => assertEqual(canAddClient("starter", 5), false));
r.test("unlimited: 9999 active can add", () => assertEqual(canAddClient("unlimited", 9999), true));
r.test("isPlanTier accepts valid", () => assertEqual(isPlanTier("starter"), true));
r.test("isPlanTier rejects junk", () => assertEqual(isPlanTier("gold"), false));

r.run();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx tests/unit/plans.test.ts`
Expected: FAIL — cannot find module `../../lib/plans`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/plans.ts`:

```ts
/**
 * Subscription tiers and the active-client cap per tier.
 * Single source of truth — imported by server gates and (future) Polar webhook.
 * Pure module: no DB, no I/O. See lib/entitlements.ts for the DB-backed reads.
 */

export const PLAN_TIERS = ["free", "starter", "unlimited"] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];

/** Max active (is_active = TRUE) clients per tier. Infinity = unlimited. */
export const CLIENT_LIMITS: Record<PlanTier, number> = {
  free: 1,
  starter: 5,
  unlimited: Infinity,
};

export function getClientLimit(tier: PlanTier): number {
  return CLIENT_LIMITS[tier] ?? CLIENT_LIMITS.free;
}

/** Can a user on `tier` with `activeCount` active clients add one more? */
export function canAddClient(tier: PlanTier, activeCount: number): boolean {
  return activeCount < getClientLimit(tier);
}

export function isPlanTier(value: string): value is PlanTier {
  return (PLAN_TIERS as readonly string[]).includes(value);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx tests/unit/plans.test.ts`
Expected: PASS — `11 passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add lib/plans.ts tests/unit/plans.test.ts
git commit -m "feat(plans): tier caps + add-client gating helper"
```

---

### Task 2: Schema columns + migration

**Files:**
- Modify: `src/db/schema.ts:144` (add columns to `userProfiles`, after the `locale` field, before the timestamps)
- Create: `drizzle/0016_subscription_columns.sql`

- [ ] **Step 1: Add columns to the Drizzle schema**

In `src/db/schema.ts`, inside the `userProfiles` table definition, after the `locale: text("locale").default("he"),` line, add:

```ts
  // ─── Subscription (Polar) ───────────────────────────────────────────
  // Tier is written by the Polar webhook (Plan 2). Until then everyone is
  // 'free' except accounts flagged `founding` (owner / pre-launch users),
  // which lib/entitlements.ts resolves to 'unlimited'.
  subscriptionTier: text("subscription_tier").default("free"),
  subscriptionStatus: text("subscription_status"),
  subscriptionPeriodEnd: timestamp("subscription_period_end"),
  polarSubscriptionId: text("polar_subscription_id"),
  founding: boolean("founding").default(false),
```

- [ ] **Step 2: Write the migration SQL**

Create `drizzle/0016_subscription_columns.sql`:

```sql
-- Subscription columns on user_profiles (Polar entitlements).
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS subscription_tier text DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS subscription_status text,
  ADD COLUMN IF NOT EXISTS subscription_period_end timestamp,
  ADD COLUMN IF NOT EXISTS polar_subscription_id text,
  ADD COLUMN IF NOT EXISTS founding boolean DEFAULT false;
```

- [ ] **Step 3: Apply to DEV with the admin connection string**

Per project convention (`drizzle-meta-drift` memory) schema changes are applied with psql via the admin URL, not `db:migrate`.

Run: `psql "$DATABASE_URL_ADMIN" -f drizzle/0016_subscription_columns.sql`
Expected: `ALTER TABLE` (no error). If `DATABASE_URL_ADMIN` is not in the shell, read it from `.env.local`.

- [ ] **Step 4: Flag the owner account as founding (DEV)**

Run:
```bash
psql "$DATABASE_URL_ADMIN" -c "UPDATE user_profiles SET founding = TRUE WHERE user_id = (SELECT id FROM \"user\" WHERE email = 'benatia.asaf@gmail.com');"
```
Expected: `UPDATE 1`.

- [ ] **Step 5: Commit**

```bash
git add src/db/schema.ts drizzle/0016_subscription_columns.sql
git commit -m "feat(db): subscription columns on user_profiles"
```

> **PROD note (do at launch, not now):** run the same SQL against the prod branch with prod `DATABASE_URL_ADMIN`, and set `founding=TRUE` for the owner on prod.

---

### Task 3: Server entitlement reads

**Files:**
- Create: `lib/entitlements.ts`

These hit the DB, so they are verified by the route behavior in Task 4 (the codebase has only pure-unit tests; no integration harness). Keep the module thin.

- [ ] **Step 1: Write the module**

Create `lib/entitlements.ts`:

```ts
/**
 * DB-backed entitlement reads. Resolves a user's effective plan from
 * user_profiles and counts their active clients. `founding` accounts are
 * always 'unlimited'. See lib/plans.ts for the pure caps.
 */
import { getClientLimit, isPlanTier, type PlanTier } from "@/lib/plans";

export interface UserPlan {
  tier: PlanTier;
  clientLimit: number;
  status: string | null;
  periodEnd: string | null;
  founding: boolean;
}

/** Resolve the effective plan for a user. Missing profile row => 'free'. */
export async function getUserPlan(userId: string): Promise<UserPlan> {
  const { query } = await import("@/lib/db");
  const result = await query<{
    subscription_tier: string | null;
    subscription_status: string | null;
    subscription_period_end: string | null;
    founding: boolean | null;
  }>(
    `SELECT subscription_tier, subscription_status, subscription_period_end, founding
     FROM user_profiles WHERE user_id = $1`,
    [userId]
  );
  const row = result.rows[0];
  const founding = row?.founding ?? false;
  const rawTier = row?.subscription_tier ?? "free";
  const tier: PlanTier = founding
    ? "unlimited"
    : isPlanTier(rawTier ?? "free")
      ? (rawTier as PlanTier)
      : "free";
  return {
    tier,
    clientLimit: getClientLimit(tier),
    status: row?.subscription_status ?? null,
    periodEnd: row?.subscription_period_end ?? null,
    founding,
  };
}

/** Count active (is_active = TRUE) clients for a user. */
export async function countActiveClients(userId: string): Promise<number> {
  const { query } = await import("@/lib/db");
  const result = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM clients WHERE user_id = $1 AND is_active = TRUE`,
    [userId]
  );
  return parseInt(result.rows[0]?.count ?? "0", 10);
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/entitlements.ts
git commit -m "feat(entitlements): getUserPlan + countActiveClients"
```

---

### Task 4: Enforce the cap on client create + reactivate

**Files:**
- Modify: `app/api/clients/route.ts` (POST handler — add gate; GET handler — add plan to response)
- Modify: `app/api/clients/[id]/route.ts` (PATCH handler — gate reactivation)

- [ ] **Step 1: Gate the POST (create) handler**

In `app/api/clients/route.ts` POST, immediately after the `if (!user) { ... }` block and before `const parsed = await parseBody(...)`, insert:

```ts
    // Enforce the active-client cap for the user's plan (Iron Law 5: server-side).
    const { getUserPlan, countActiveClients } = await import("@/lib/entitlements");
    const { canAddClient } = await import("@/lib/plans");
    const plan = await getUserPlan(user.id);
    const activeCount = await countActiveClients(user.id);
    if (!canAddClient(plan.tier, activeCount)) {
      return NextResponse.json(
        {
          success: false,
          error_code: "PLAN_LIMIT_REACHED",
          message: "הגעת למגבלת הלקוחות בתוכנית שלך. שדרגו כדי להוסיף לקוחות נוספים.",
        },
        { status: 402 }
      );
    }
```

- [ ] **Step 2: Add plan info to the GET (list) response**

In `app/api/clients/route.ts` GET, replace the existing `return NextResponse.json({ success: true, clients }, { headers: {...} });` block with:

```ts
    const { getUserPlan } = await import("@/lib/entitlements");
    const plan = await getUserPlan(user.id);
    const activeCount = clients.filter((c) => c.isActive).length;

    return NextResponse.json(
      {
        success: true,
        clients,
        plan: {
          tier: plan.tier,
          // null = unlimited (Infinity isn't JSON-serializable)
          clientLimit: Number.isFinite(plan.clientLimit) ? plan.clientLimit : null,
          activeCount,
        },
      },
      {
        headers: {
          "Cache-Control": "private, max-age=60, stale-while-revalidate=120",
        },
      }
    );
```

- [ ] **Step 3: Gate the PATCH (reactivate) handler**

In `app/api/clients/[id]/route.ts` PATCH, after the `if (!user) { ... }` block and before the `UPDATE ... SET is_active = TRUE` query, insert:

```ts
    // Reactivating a client consumes a slot — enforce the cap.
    const { getUserPlan, countActiveClients } = await import("@/lib/entitlements");
    const { canAddClient } = await import("@/lib/plans");
    const plan = await getUserPlan(user.id);
    const activeCount = await countActiveClients(user.id);
    if (!canAddClient(plan.tier, activeCount)) {
      return NextResponse.json(
        {
          success: false,
          error_code: "PLAN_LIMIT_REACHED",
          message: "הגעת למגבלת הלקוחות בתוכנית שלך. שדרגו כדי לשחזר לקוח זה.",
        },
        { status: 402 }
      );
    }
```

- [ ] **Step 4: Type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors, zero warnings.

- [ ] **Step 5: Manual verification (DEV)**

Start `npm run dev`. As a NON-founding test user (create a fresh account, or temporarily `UPDATE user_profiles SET founding=FALSE, subscription_tier='free' WHERE user_id=...`):
1. With 0 clients, create one → succeeds.
2. Create a second → fails with a toast "הגעת למגבלת הלקוחות…" (free cap = 1).
3. `UPDATE user_profiles SET subscription_tier='starter' WHERE user_id=...` → can now create up to 5.
4. Archive (delete) a client → active count drops → can add again.
Confirm the owner account (founding) has no limit.

- [ ] **Step 6: Commit**

```bash
git add app/api/clients/route.ts app/api/clients/\[id\]/route.ts
git commit -m "feat(clients): enforce plan client-cap on create + reactivate"
```

---

### Task 5: Localized limit message

**Files:**
- Modify: `messages/he.json` (`errors` namespace)
- Modify: `messages/en.json` (`errors` namespace)

The clients page already toasts `messageForError(error_code)` on a failed create. Add the mapping so the toast is clean even if the inline message changes.

- [ ] **Step 1: Add the he string**

In `messages/he.json`, in the `"errors"` object, add:

```json
    "PLAN_LIMIT_REACHED": "הגעת למגבלת הלקוחות בתוכנית שלך. שדרגו כדי להוסיף עוד.",
```

- [ ] **Step 2: Add the en string**

In `messages/en.json`, in the `"errors"` object, add:

```json
    "PLAN_LIMIT_REACHED": "You've reached your plan's client limit. Upgrade to add more.",
```

- [ ] **Step 3: Verify message parity**

Run: `npx tsx tests/unit/messages-parity.test.ts`
Expected: PASS (he/en keys match).

- [ ] **Step 4: Commit**

```bash
git add messages/he.json messages/en.json
git commit -m "feat(i18n): plan-limit-reached message"
```

---

### Task 6: Usage banner + upgrade CTA on the clients page

**Files:**
- Create: `components/plan-usage-banner.tsx`
- Modify: `app/[locale]/clients/page.tsx` (render the banner; pass plan from the existing GET)
- Modify: `messages/he.json` + `messages/en.json` (`Clients` namespace)

The clients page (`ClientsPageContent`) already fetches `/api/clients`. We surface the `plan` field it now returns. This is proactive visibility; the hard gate is already server-side (Task 4).

- [ ] **Step 1: Add banner strings (he)**

In `messages/he.json`, inside the `"Clients"` object, add:

```json
    "usage": {
      "count": "{active} מתוך {limit} לקוחות",
      "unlimited": "{active} לקוחות · ללא הגבלה",
      "atLimit": "הגעת למגבלת התוכנית.",
      "upgrade": "שדרגו"
    },
```

- [ ] **Step 2: Add banner strings (en)**

In `messages/en.json`, inside the `"Clients"` object, add:

```json
    "usage": {
      "count": "{active} of {limit} clients",
      "unlimited": "{active} clients · unlimited",
      "atLimit": "You've reached your plan limit.",
      "upgrade": "Upgrade"
    },
```

- [ ] **Step 3: Create the banner component**

Create `components/plan-usage-banner.tsx`:

```tsx
"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/src/i18n/navigation";

interface PlanUsageBannerProps {
  /** Active client count from /api/clients. */
  active: number;
  /** Plan cap; null = unlimited. */
  limit: number | null;
}

/**
 * Compact plan-usage indicator for the clients page. Shows "X of Y clients"
 * and, when at the cap, an upgrade CTA. Pure presentational — data comes from
 * the /api/clients `plan` field.
 */
export function PlanUsageBanner({ active, limit }: PlanUsageBannerProps) {
  const t = useTranslations("Clients.usage");
  const atLimit = limit !== null && active >= limit;

  return (
    <div className="flex items-center gap-3 rounded-[var(--radius)] border border-border bg-card px-3 py-2 text-sm">
      <span className={atLimit ? "text-destructive" : "text-muted-foreground"}>
        {limit === null
          ? t("unlimited", { active })
          : t("count", { active, limit })}
      </span>
      {atLimit && (
        <>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">{t("atLimit")}</span>
          <Link
            href="/settings"
            className="font-medium text-primary hover:text-primary/80"
          >
            {t("upgrade")}
          </Link>
        </>
      )}
    </div>
  );
}
```

> The `/settings` href is a placeholder destination until the `/pricing` page exists (Plan 3). Keep it pointing at a real route so the link never 404s.

- [ ] **Step 4: Wire the banner into the clients page**

In `app/[locale]/clients/page.tsx`:

(a) Add the import near the other component imports:
```tsx
import { PlanUsageBanner } from "@/components/plan-usage-banner";
```

(b) In `ClientsPageContent`, add state for the plan alongside the existing client state:
```tsx
  const [plan, setPlan] = useState<{ activeCount: number; clientLimit: number | null } | null>(null);
```

(c) In the function that fetches `/api/clients` (where the response is parsed and clients are set), after setting clients, capture the plan:
```tsx
      if (data.plan) {
        setPlan({ activeCount: data.plan.activeCount, clientLimit: data.plan.clientLimit });
      }
```

(d) Render the banner just below the `<PageHeader ... />` in the returned JSX:
```tsx
      {plan && <PlanUsageBanner active={plan.activeCount} limit={plan.clientLimit} />}
```

- [ ] **Step 5: Type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors, zero warnings.

- [ ] **Step 6: Manual verification**

`npm run dev` → clients page shows "X of Y clients"; as a free user at 1 client it shows the at-limit state + Upgrade link; founding/unlimited shows "N clients · unlimited".

- [ ] **Step 7: Commit**

```bash
git add components/plan-usage-banner.tsx app/[locale]/clients/page.tsx messages/he.json messages/en.json
git commit -m "feat(clients): plan usage banner + upgrade CTA"
```

---

### Task 7: Full test + lint gate

- [ ] **Step 1: Run the whole unit suite**

Run: `npm test`
Expected: all files pass, including `plans.test.ts` and `messages-parity.test.ts`.

- [ ] **Step 2: Type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 3: Final commit (if anything pending)**

```bash
git add -A
git commit -m "chore: monetization plan 1 — entitlements green" || echo "nothing to commit"
```

---

## Self-Review

- **Spec coverage:** Implements spec §2 (tiers/caps — minus prices, which are Polar product config in Plan 2), §3 (entitlement source-of-truth column, active=non-archived via `is_active`, server-side gate, downgrade-safe since we never delete and reactivation is gated), §4 (schema columns `subscription_tier/status/period_end/polar_subscription_id` + `founding`). Pricing UI, checkout, webhooks, ToS = Plans 2–3 (out of scope here, by design).
- **Placeholder scan:** none. The one explicit deferral (banner `/settings` link until `/pricing` exists in Plan 3) is called out and points at a real route.
- **Type consistency:** `PlanTier`, `getClientLimit`, `canAddClient`, `isPlanTier` used identically across `lib/plans.ts`, `lib/entitlements.ts`, and the routes. Column names match between `src/db/schema.ts`, the migration SQL, and `getUserPlan`'s SELECT.

## Deferred to later plans
- **Plan 2 (Polar):** `@polar-sh/better-auth` plugin, 4 products (tier × interval) at $7/$67 + $14/$134, checkout, webhooks writing `subscription_tier/status/period_end/polar_subscription_id`, customer portal, sandbox/prod env, GDPR customer delete.
- **Plan 3 (Pricing + checkout compliance + legal):** `/pricing` page (annual default), MoR disclosure + EU express-consent at checkout, ToS payment clauses (IL עסקה מתמשכת, §13א renewal notice, refunds, taxes), point the banner CTA at `/pricing`.
- **Launch prerequisites (non-code):** עוסק מורשה + רו"ח, Polar KYC, Polar DPA in privacy policy, prod migration + owner founding flag.
