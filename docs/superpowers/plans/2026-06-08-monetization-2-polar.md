# Monetization Plan 2 — Polar Integration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Wire Polar.sh (Merchant of Record) so users can subscribe to Starter/Unlimited, and the subscription state automatically drives the `user_profiles.subscription_*` columns that Plan 1's gate already reads. Build/test against the org's **test mode** (host `api.polar.sh`, 100% discount codes).

**Architecture:** Better Auth gains the official `@polar-sh/better-auth` plugin (auto-creates a Polar customer per user with `externalId = user.id` — no mapping table). Checkout + customer portal are plugin-provided. Polar webhooks write tier/status/period-end into `user_profiles` via a small entitlement writer. Tier is resolved from the product id (env-configured) — provider-agnostic, so a future second provider (e.g. an Israeli gateway) just writes the same columns. A new `billing_provider` column records which provider owns the subscription.

**Tech Stack:** `@polar-sh/sdk`, `@polar-sh/better-auth`, Better Auth 1.6, Next.js 16 App Router, Drizzle + raw `pg`, next-intl, custom tsx test runner.

**Prereqs already done:** Plan 1 merged into this branch (columns `subscription_tier/status/period_end/polar_subscription_id`, `founding`, `lib/plans.ts`, `lib/entitlements.ts getUserPlan`). The 4 Polar **test-mode** products exist; their IDs + `POLAR_API_KEY` + `POLAR_SERVER=production` are in `.env.local`:
```
POLAR_PRODUCT_STARTER_MONTHLY=ad403d18-d744-4f20-8d7c-7093f16996b6
POLAR_PRODUCT_STARTER_ANNUAL=02077670-c757-47fe-873a-dda6f34009c6
POLAR_PRODUCT_UNLIMITED_MONTHLY=cfd4b07a-f402-4769-91aa-b9edd61aba17
POLAR_PRODUCT_UNLIMITED_ANNUAL=4356a0e9-92ea-497f-afbc-71d9570e83fb
```

**Known caveat (verify early):** `@polar-sh/better-auth` client calls (`checkout`/`portal`/`customer.*`) have a reported issue under Next 16 + Turbopack (better-auth#6845). Task 5 verifies the client path early; if broken, fall back to `@polar-sh/nextjs` standalone route handlers (documented in the design spec). Exact plugin export/handler names must be confirmed against the installed package's types during Task 3 — the reference config below reflects the research but adapt symbol names if the installed version differs, keeping the documented behavior.

---

### Task 1: `billing_provider` column + migration

**Files:**
- Modify: `src/db/schema.ts` (userProfiles — add one column next to the subscription block from Plan 1)
- Create: `drizzle/0017_billing_provider.sql`

- [ ] **Step 1: Add the column to Drizzle schema**

In `src/db/schema.ts`, in the `userProfiles` "Subscription (Polar)" block (right after `polarSubscriptionId: text("polar_subscription_id"),`), add:
```ts
  // Which billing backend owns the active subscription ('polar' today; lets a
  // future provider — e.g. an Israeli gateway — write the same tier columns).
  billingProvider: text("billing_provider").default("polar"),
```

- [ ] **Step 2: Migration SQL**

Create `drizzle/0017_billing_provider.sql`:
```sql
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS billing_provider text DEFAULT 'polar';
```

- [ ] **Step 3: Apply to DEV**

Run: `psql "$DATABASE_URL_ADMIN" -f drizzle/0017_billing_provider.sql` (read `DATABASE_URL_ADMIN` from `.env.local` if not in shell). Expected: `ALTER TABLE`.

- [ ] **Step 4: tsc + commit**

`npx tsc --noEmit` → clean.
```bash
git add src/db/schema.ts drizzle/0017_billing_provider.sql
git commit -m "feat(db): billing_provider column on user_profiles"
```
> PROD note (at launch): apply the same SQL to prod.

---

### Task 2: Polar client + pure tier-from-product mapping (+ test)

**Files:**
- Create: `lib/polar.ts`
- Test: `tests/unit/polar-tier.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/polar-tier.test.ts`:
```ts
/** Unit tests for the pure product-id → tier mapping in lib/polar.ts. */
import { tierForProductId, polarEnabled } from "../../lib/polar";

class TestRunner {
  private tests: Array<{ name: string; fn: () => void }> = [];
  private passed = 0; private failed = 0;
  test(n: string, f: () => void) { this.tests.push({ name: n, fn: f }); }
  async run() {
    for (const { name, fn } of this.tests) {
      try { fn(); this.passed++; console.log("✅", name); }
      catch (e) { this.failed++; console.log("❌", name); console.error(e); }
    }
    console.log(`\n${this.passed} passed, ${this.failed} failed`);
    process.exit(this.failed > 0 ? 1 : 0);
  }
}
function assertEqual(a: unknown, b: unknown) { if (a !== b) throw new Error(`Expected ${b}, got ${a}`); }

const map = { "p_sm": "starter", "p_sa": "starter", "p_um": "unlimited", "p_ua": "unlimited" } as const;
const r = new TestRunner();
r.test("starter monthly id → starter", () => assertEqual(tierForProductId("p_sm", map), "starter"));
r.test("unlimited annual id → unlimited", () => assertEqual(tierForProductId("p_ua", map), "unlimited"));
r.test("unknown id → null", () => assertEqual(tierForProductId("nope", map), null));
r.test("null id → null", () => assertEqual(tierForProductId(null, map), null));
r.test("polarEnabled is a boolean", () => assertEqual(typeof polarEnabled, "boolean"));
r.run();
```

- [ ] **Step 2: Run → fails** (`npx tsx tests/unit/polar-tier.test.ts`): module not found.

- [ ] **Step 3: Implement `lib/polar.ts`**

> First install the SDK (Task imports it): `npm install @polar-sh/sdk @polar-sh/better-auth` and confirm they appear in `package.json`.

Create `lib/polar.ts`:
```ts
/**
 * Polar SDK client + pure product→tier mapping. The client talks to the Polar
 * API (test mode runs on the production host; "test mode" is an org state). The
 * tier map is env-configured so product ids are never hardcoded.
 */
import { Polar } from "@polar-sh/sdk";
import type { PlanTier } from "@/lib/plans";

/** True when a Polar token is configured (gate the plugin like emailEnabled). */
export const polarEnabled = Boolean(process.env.POLAR_API_KEY);

let _client: Polar | null = null;
/** Lazy singleton Polar client. Throws if called without POLAR_API_KEY. */
export function getPolar(): Polar {
  if (!_client) {
    const accessToken = process.env.POLAR_API_KEY;
    if (!accessToken) throw new Error("POLAR_API_KEY is not configured");
    const server = process.env.POLAR_SERVER === "sandbox" ? "sandbox" : "production";
    _client = new Polar({ accessToken, server });
  }
  return _client;
}

/** Build the productId→tier map from env (the 4 configured products). */
export function getProductTierMap(): Record<string, PlanTier> {
  const map: Record<string, PlanTier> = {};
  const add = (id: string | undefined, tier: PlanTier) => { if (id) map[id] = tier; };
  add(process.env.POLAR_PRODUCT_STARTER_MONTHLY, "starter");
  add(process.env.POLAR_PRODUCT_STARTER_ANNUAL, "starter");
  add(process.env.POLAR_PRODUCT_UNLIMITED_MONTHLY, "unlimited");
  add(process.env.POLAR_PRODUCT_UNLIMITED_ANNUAL, "unlimited");
  return map;
}

/** Pure: resolve a tier from a product id given a map. Unknown/null → null. */
export function tierForProductId(
  productId: string | null | undefined,
  map: Record<string, PlanTier>
): PlanTier | null {
  if (!productId) return null;
  return map[productId] ?? null;
}
```

- [ ] **Step 4: Run → passes** (`npx tsx tests/unit/polar-tier.test.ts` → `5 passed`). Then `npx tsc --noEmit` → clean.

- [ ] **Step 5: Commit**
```bash
git add lib/polar.ts tests/unit/polar-tier.test.ts package.json package-lock.json
git commit -m "feat(polar): SDK client + pure product→tier mapping"
```

---

### Task 3: Entitlement writer + Polar plugin (webhooks) wired into Better Auth

**Files:**
- Modify: `lib/entitlements.ts` (add `applyPolarEntitlement` + `revokeEntitlement`)
- Modify: `lib/auth/better-auth.ts` (add the polar plugin, gated on `polarEnabled`)
- Modify: `lib/env.ts` (document the new optional Polar env vars — match existing optional-var style; do NOT make them hard-required, so dev without Polar still boots)

- [ ] **Step 1: Add the entitlement writer to `lib/entitlements.ts`**

Append:
```ts
import type { PlanTier } from "@/lib/plans";

export interface EntitlementUpdate {
  tier: PlanTier;
  status: string | null;
  periodEnd: string | null;        // ISO timestamp or null
  polarSubscriptionId: string | null;
}

/** Upsert a user's subscription columns from a Polar event. Sets provider='polar'. */
export async function applyPolarEntitlement(userId: string, u: EntitlementUpdate): Promise<void> {
  const { query } = await import("@/lib/db");
  await query(
    `UPDATE user_profiles
       SET subscription_tier = $2,
           subscription_status = $3,
           subscription_period_end = $4,
           polar_subscription_id = $5,
           billing_provider = 'polar',
           updated_at = NOW()
     WHERE user_id = $1`,
    [userId, u.tier, u.status, u.periodEnd, u.polarSubscriptionId]
  );
}

/** Drop a user back to free (subscription revoked/ended). */
export async function revokeEntitlement(userId: string): Promise<void> {
  const { query } = await import("@/lib/db");
  await query(
    `UPDATE user_profiles
       SET subscription_tier = 'free', subscription_status = 'revoked', updated_at = NOW()
     WHERE user_id = $1`,
    [userId]
  );
}
```
> Note: these UPDATE by `user_id`. The webhook runs without a session, so the RLS tenant context isn't auto-bound. Use the same approach as the signup hook: call `setUserContext(userId)` (imported from `@/lib/db`) immediately before the query, OR run the UPDATE via the admin path. Pick `setUserContext(userId)` for consistency with `databaseHooks.user.create.after` in `better-auth.ts`. Add `import { setUserContext } from "@/lib/db"` and call it at the top of each function.

- [ ] **Step 2: Confirm the plugin API against the installed package**

Read `node_modules/@polar-sh/better-auth` types/README. Confirm the exports (`polar`, `checkout`, `portal`, `webhooks`) and the webhook handler names + payload field paths. The reference below matches the research; adapt names if the installed version differs, preserving behavior.

- [ ] **Step 3: Wire the plugin into `lib/auth/better-auth.ts`**

Add imports at top:
```ts
import { polar, checkout, portal, webhooks } from "@polar-sh/better-auth";
import { getPolar, getProductTierMap, tierForProductId, polarEnabled } from "@/lib/polar";
import { applyPolarEntitlement, revokeEntitlement } from "@/lib/entitlements";
```

Add a helper above `export const auth` that turns a Polar subscription payload into our update + writes it (keep field-path access defensive; confirm paths against types):
```ts
/** Map a Polar subscription payload → our columns and persist. */
async function syncSubscription(sub: {
  status?: string | null;
  product_id?: string | null;
  current_period_end?: string | null;
  id?: string | null;
  customer?: { external_id?: string | null } | null;
}): Promise<void> {
  const userId = sub.customer?.external_id;
  if (!userId) { logger.error("Polar webhook: subscription without customer.external_id"); return; }
  const tier = tierForProductId(sub.product_id, getProductTierMap());
  if (!tier) { logger.error("Polar webhook: unknown product_id", { productId: sub.product_id }); return; }
  await applyPolarEntitlement(userId, {
    tier,
    status: sub.status ?? null,
    periodEnd: sub.current_period_end ?? null,
    polarSubscriptionId: sub.id ?? null,
  });
}
```

Build the polar plugin (only when configured) and insert it into the `plugins` array **before** `nextCookies()`:
```ts
const polarPlugin = polarEnabled
  ? polar({
      client: getPolar(),
      createCustomerOnSignUp: true,
      use: [
        checkout({
          products: [
            { productId: process.env.POLAR_PRODUCT_STARTER_MONTHLY!, slug: "starter-monthly" },
            { productId: process.env.POLAR_PRODUCT_STARTER_ANNUAL!, slug: "starter-annual" },
            { productId: process.env.POLAR_PRODUCT_UNLIMITED_MONTHLY!, slug: "unlimited-monthly" },
            { productId: process.env.POLAR_PRODUCT_UNLIMITED_ANNUAL!, slug: "unlimited-annual" },
          ],
          successUrl: process.env.POLAR_SUCCESS_URL ?? "/dashboard?checkout=success",
          authenticatedUsersOnly: true,
        }),
        portal(),
        webhooks({
          secret: process.env.POLAR_WEBHOOK_SECRET!,
          onSubscriptionActive: async (p) => { await syncSubscription(p.data); },
          onSubscriptionUpdated: async (p) => { await syncSubscription(p.data); },
          onOrderPaid: async (p) => { if (p.data?.subscription) await syncSubscription(p.data.subscription); },
          onSubscriptionRevoked: async (p) => {
            const userId = p.data?.customer?.external_id;
            if (userId) await revokeEntitlement(userId);
          },
        }),
      ],
    })
  : null;
```
Then change `plugins: [nextCookies()]` to:
```ts
  plugins: [...(polarPlugin ? [polarPlugin] : []), nextCookies()],
```

- [ ] **Step 4: Document env vars in `lib/env.ts`**

Add the Polar vars as **optional** (the app must still boot without them, like Google/Resend). Match the file's existing optional-var pattern (read it first). Do not throw when absent.

- [ ] **Step 5: Verify build**

`npx tsc --noEmit` → clean. `npm run lint` → clean. `npm test` → all pass (incl. polar-tier test). If types from the plugin force small signature tweaks in `syncSubscription`, adapt while preserving behavior.

- [ ] **Step 6: Commit**
```bash
git add lib/entitlements.ts lib/auth/better-auth.ts lib/env.ts
git commit -m "feat(polar): better-auth plugin + webhook entitlement sync"
```

---

### Task 4: GDPR — delete the Polar customer on account deletion

**Files:**
- Modify: `app/api/account/route.ts` (DELETE)

- [ ] **Step 1: Add customer deletion**

In the DELETE handler, AFTER the `withTransaction(...)` block succeeds (so we only remove the Polar customer once local deletion committed), add a best-effort Polar cleanup (never fail the request if Polar errors):
```ts
    // Best-effort: remove the Polar customer (keyed by our user id) so no billing
    // identity lingers after a GDPR delete. Never fail the deletion on Polar error.
    try {
      const { polarEnabled, getPolar } = await import("@/lib/polar");
      if (polarEnabled) {
        await getPolar().customers.deleteExternal({ externalId: uid });
      }
    } catch (error) {
      logger.error("Failed to delete Polar customer on account deletion", error, { userId: uid });
    }
```
> Confirm the SDK method name (`customers.deleteExternal({ externalId })`) against the installed `@polar-sh/sdk` types; adapt if the method differs (e.g. `customers.deleteByExternalId`).

- [ ] **Step 2: Verify** — `npx tsc --noEmit` → clean.

- [ ] **Step 3: Commit**
```bash
git add app/api/account/route.ts
git commit -m "feat(polar): delete Polar customer on account deletion (GDPR)"
```

---

### Task 5: Client plugin (checkout/portal calls) + early Turbopack check

**Files:**
- Modify: `lib/auth/client.ts`

- [ ] **Step 1: Add the Polar client plugin**

Update `lib/auth/client.ts`:
```ts
import { polarClient } from "@polar-sh/better-auth/client";
// ...
export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<typeof auth>(), polarClient()],
});
```
> Confirm `polarClient` import path against the installed package.

- [ ] **Step 2: Smoke-test the client path under Turbopack early (the known caveat)**

Start `npm run dev`. From any client component (or a temporary test button), confirm `authClient.checkout({ slug: "starter-monthly" })` opens a Polar checkout, and `authClient.customer.portal()` resolves, without the better-auth#6845 Turbopack error in the console.
- If it works: continue (Plan 3 builds the real `/pricing` UI on this).
- If it throws the Turbopack/client error: **stop and report** — switch to `@polar-sh/nextjs` standalone `Checkout()`/`CustomerPortal()` route handlers (design-spec fallback). Note it as a concern; do not force it.

- [ ] **Step 3: tsc + commit**

`npx tsc --noEmit` → clean.
```bash
git add lib/auth/client.ts
git commit -m "feat(polar): client plugin for checkout + portal"
```

---

### Task 6: Polar webhook endpoint + end-to-end test (manual, test mode)

This task is configuration + verification; no app code beyond confirming the wiring. It needs a public URL for webhooks.

- [ ] **Step 1: Create the webhook secret/endpoint in Polar**

In the Polar dashboard (test mode) → Settings → Webhooks → add an endpoint. URL = your tunnel/deployed URL + the path the better-auth polar plugin mounts (confirm the exact path from the plugin; commonly the better-auth handler base, e.g. `/api/auth/polar/webhooks`). Select the subscription + order events. Copy the signing secret → add `POLAR_WEBHOOK_SECRET=...` to `.env.local` (and later to Vercel).

- [ ] **Step 2: Tunnel for local delivery**

Use the Polar CLI (`curl -fsSL https://polar.sh/install.sh | bash`) or `ngrok http 3000`. Point the dashboard endpoint at the tunnel URL.

- [ ] **Step 3: End-to-end test in test mode (no real money)**

With `npm run dev` + tunnel running, as a NON-founding test user on the free tier:
1. Trigger checkout (`authClient.checkout({ slug: "starter-monthly" })`), pay with a **100% discount code** (Polar test mode) / test card `4242 4242 4242 4242`.
2. Confirm `subscription.active` webhook arrives → `user_profiles.subscription_tier` becomes `starter`, `subscription_status='active'`, `polar_subscription_id` set, `billing_provider='polar'` (check via psql).
3. Confirm the client cap is now 5 (create a 2nd/3rd client — should succeed; Plan 1 gate reads the new tier).
4. In the Polar customer portal (`authClient.customer.portal()`), cancel → confirm access stays until period end (status `active`, `cancel_at_period_end`), then on `subscription.revoked` the tier returns to `free`.
5. Delete the test account → confirm the Polar customer is removed (Task 4).

- [ ] **Step 4: Document findings**

Record (in the PR description or a short note) the exact webhook mount path, the events selected, and whether the Turbopack client path worked or the `@polar-sh/nextjs` fallback was used.

> No commit unless Step 1-3 surfaced a code change; if so, commit it with a clear message.

---

### Task 7: Full gate

- [ ] **Step 1:** `npm test` → all pass (incl. `polar-tier.test.ts`).
- [ ] **Step 2:** `npx tsc --noEmit && npm run lint` → clean.
- [ ] **Step 3:** Commit anything pending.

---

## Self-Review

- **Spec coverage (design spec §4):** plugin with `createCustomerOnSignUp` (Task 3) ✓; 4 products via env (Task 2/3) ✓; Free = no subscription (gate defaults to free — Plan 1) ✓; webhook → local columns (Task 3) ✓; customer portal (Task 5) ✓; sandbox/test-mode env (Tasks 2/6) ✓; GDPR customer delete (Task 4) ✓; `billing_provider` future-proofing (Task 1) ✓. Checkout *UI* (`/pricing`, consent, MoR disclosure) + ToS payment clauses = **Plan 3** (out of scope here).
- **Placeholder scan:** none. The two "confirm against installed package" notes (plugin export/handler names in Task 3; SDK method name in Task 4; client import in Task 5) are real-world verification steps for a third-party API with version variance — the behavior contract is fully specified; only exact symbol names are confirmed at execution. The webhook mount path (Task 6) is discovered from the plugin, not invented.
- **Type consistency:** `PlanTier` reused from `lib/plans.ts`; `EntitlementUpdate`/`applyPolarEntitlement`/`revokeEntitlement` consistent between `lib/entitlements.ts` and `better-auth.ts`; env var names match `.env.local` exactly.

## Deferred to Plan 3
`/pricing` page (annual default toggle), checkout MoR disclosure + EU express-consent checkbox + IL עסקה-מתמשכת cancellation copy, ToS payment clauses, point the Plan-1 banner CTA at `/pricing`. Plus launch prereqs: עוסק מורשה + רו"ח, Polar "Go Live" + live-mode products/token/webhook on Vercel, prod migrations (0016 + 0017), DPA in privacy policy.
