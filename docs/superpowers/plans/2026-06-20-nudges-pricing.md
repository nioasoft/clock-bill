# In-App Nudges + Pricing — Implementation Plan (3 of 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Surface the trial + locked-client state in the UI — a nav trial pill, a dashboard trial card, locked-client rows with a "make active" switch, an upgrade modal, and a pricing "what you'll keep" line — all bilingual (he+en).

**Architecture:** `/api/account/plan` exposes `trial` + `activeClientCount`. A `usePlan()` TanStack-Query hook feeds a pure `getTrialPillView()` view-model into the pill/card. The clients page reads `lockedClientIds` (already returned by the API) to badge locked rows and offer make-active. An `UpgradeModal` (Radix Dialog) routes to Polar checkout via the existing `authClient.checkout`.

**Tech Stack:** Next.js 16 client components, next-intl, TanStack Query v5, Tailwind v4 ClickHouse-dark tokens, Radix Dialog/Toast (`components/ui/*`), custom tsx test runner.

Plan **3 of 4**. Depends on Plans 1-2 (trial in `getUserPlan`; `lockedClientIds` + make-active endpoint). Source spec: `docs/superpowers/specs/2026-06-19-trial-conversion-engine-design.md` §6, §9, §10.

## Global Constraints

- **Bilingual:** every string in BOTH `messages/he.json` and `messages/en.json`. New top-level `Trial` namespace; extend `Pricing` and `Clients.usage`. No hardcoded user-facing text.
- **Design tokens only** (no raw hex / `bg-gray-*` / `text-white`): neutral pill `bg-card border border-border text-muted-foreground`; trial value `bg-primary/[0.06] border-primary/25 text-primary`; trial-ending `bg-warning/15 text-warning border-warning/30`; on yellow use `text-primary-foreground`. Radius `rounded-[var(--radius)]` / `rounded-[var(--radius-card)]`. RTL via logical props (`ps-`, `me-`, etc.).
- **Never interrupt active work** — no nudge blocks a running timer. The UpgradeModal always has a "Maybe later" close.
- **Trial-ending threshold:** `daysLeft <= 3`.
- TypeScript strict, no `any`; tests via `npx tsx tests/unit/<file>.test.ts`.

---

### Task 1: Expose trial + count in plan API; i18n strings + parity test; pill view-model

**Files:**
- Modify: `app/api/account/plan/route.ts`
- Modify: `messages/he.json`, `messages/en.json`
- Create: `lib/trial-view.ts`
- Test: `tests/unit/trial-view.test.ts`, `tests/unit/i18n-parity.test.ts`

**Interfaces:**
- Produces: plan API returns `{ ...plan, trial, activeClientCount }`; `getTrialPillView(trial, now?) → { show: boolean; daysLeft: number; ending: boolean } | null`

- [ ] **Step 1: Add `trial` + `activeClientCount` to the plan route**

In `app/api/account/plan/route.ts`, the handler already calls `getUserPlan(user.id)`. Add the active-client count and pass `trial` through. After the `getUserPlan` call add:

```typescript
    const { query } = await import("@/lib/db");
    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*)::int AS count FROM clients WHERE user_id = $1 AND is_active = TRUE`,
      [user.id]
    );
    const activeClientCount = Number(countResult.rows[0]?.count ?? 0);
```

and extend the returned `plan` object literal to include `trial: plan.trial` and add `activeClientCount` as a sibling of `plan` in the JSON:

```typescript
    return NextResponse.json({
      success: true,
      plan: { tier: plan.tier, status: plan.status, periodEnd: plan.periodEnd, founding: plan.founding, trial: plan.trial },
      activeClientCount,
    });
```

- [ ] **Step 2: Write the pill view-model test**

Create `tests/unit/trial-view.test.ts`:

```typescript
import { getTrialPillView } from "../../lib/trial-view";

class TestRunner {
  private tests: Array<{ name: string; fn: () => void }> = [];
  private passed = 0; private failed = 0;
  test(name: string, fn: () => void) { this.tests.push({ name, fn }); }
  async run() {
    console.log("🧪 Running trial-view tests...\n");
    for (const { name, fn } of this.tests) {
      try { fn(); this.passed++; console.log(`  ✅ ${name}`); }
      catch (e) { this.failed++; console.error(`  ❌ ${name}`); if (e instanceof Error) console.error(`     ${e.message}`); }
    }
    console.log(`\n${this.passed} passed, ${this.failed} failed`);
    if (this.failed > 0) process.exit(1);
  }
}
function assertEqual<T>(a: T, b: T, m?: string) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(m ?? `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }
const runner = new TestRunner();

runner.test("null trial -> null", () => assertEqual(getTrialPillView(null), null));
runner.test("inactive trial -> null", () => assertEqual(getTrialPillView({ active: false, daysLeft: 0, endsAt: null }), null));
runner.test("active trial 11 days -> show, not ending", () => assertEqual(getTrialPillView({ active: true, daysLeft: 11, endsAt: "x" }), { show: true, daysLeft: 11, ending: false }));
runner.test("active trial 3 days -> ending", () => assertEqual(getTrialPillView({ active: true, daysLeft: 3, endsAt: "x" }), { show: true, daysLeft: 3, ending: true }));
runner.test("active trial 1 day -> ending", () => assertEqual(getTrialPillView({ active: true, daysLeft: 1, endsAt: "x" }), { show: true, daysLeft: 1, ending: true }));

runner.run();
```

- [ ] **Step 3: Run it (fails), then create `lib/trial-view.ts`**

Run: `npx tsx tests/unit/trial-view.test.ts` → FAIL (missing).

```typescript
/** Pure view-model for the trial pill/card. No I/O, no React. */
export interface TrialInfo { active: boolean; daysLeft: number | null; endsAt: string | null; }
export interface TrialPillView { show: boolean; daysLeft: number; ending: boolean; }

/** Trial UI is shown only while active; "ending" within 3 days. */
export function getTrialPillView(trial: TrialInfo | null): TrialPillView | null {
  if (!trial || !trial.active) return null;
  const daysLeft = trial.daysLeft ?? 0;
  return { show: true, daysLeft, ending: daysLeft <= 3 };
}
```

Run again → PASS (5/5).

- [ ] **Step 4: Add i18n strings (both locales)**

Add a new top-level `"Trial"` namespace to BOTH `messages/he.json` and `messages/en.json`. English values:

```json
"Trial": {
  "pillActive": "Unlimited trial · {days} days left",
  "pillEnding": "Trial ends in {days} days",
  "cardHeading": "You're on Unlimited",
  "cardBody": "Track unlimited clients and projects. {days} days left in your trial.",
  "cardCta": "Lock in your plan",
  "endedHeading": "Your trial has ended",
  "endedBody": "You're on the Free plan ({limit} active client). Upgrade to unlock all your clients.",
  "upgradeTitle": "Upgrade to keep everything",
  "upgradeBody": "Your Free plan supports {limit} active client. You have {count}. Upgrade to unlock them all.",
  "upgradeCta": "See plans",
  "maybeLater": "Maybe later"
}
```

Hebrew values:

```json
"Trial": {
  "pillActive": "ניסיון Unlimited · נותרו {days} ימים",
  "pillEnding": "הניסיון מסתיים בעוד {days} ימים",
  "cardHeading": "אתה על Unlimited",
  "cardBody": "עקוב אחר לקוחות ופרויקטים ללא הגבלה. נותרו {days} ימים בניסיון.",
  "cardCta": "נעל את המסלול",
  "endedHeading": "הניסיון הסתיים",
  "endedBody": "אתה על המסלול החינמי ({limit} לקוח פעיל). שדרג כדי לפתוח את כל הלקוחות.",
  "upgradeTitle": "שדרג כדי לשמור על הכל",
  "upgradeBody": "המסלול החינמי תומך ב-{limit} לקוח פעיל. יש לך {count}. שדרג כדי לפתוח את כולם.",
  "upgradeCta": "צפה במסלולים",
  "maybeLater": "אולי מאוחר יותר"
}
```

Also extend `"Clients.usage"` in BOTH files with: `"locked"` (en: "Locked", he: "נעול"), `"makeActive"` (en: "Make active", he: "הפוך לפעיל"), `"upgradeToUnlock"` (en: "Upgrade to unlock", he: "שדרג כדי לפתוח"), `"dataSafe"` (en: "Your data is safe", he: "הנתונים שלך שמורים").

- [ ] **Step 5: Add an i18n key-parity test**

Create `tests/unit/i18n-parity.test.ts` — recursively collects all key paths in both files and asserts they're identical (catches a string added to one locale but not the other):

```typescript
import he from "../../messages/he.json";
import en from "../../messages/en.json";

function keyPaths(obj: unknown, prefix = ""): string[] {
  if (typeof obj !== "object" || obj === null) return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    keyPaths(v, prefix ? `${prefix}.${k}` : k)
  );
}

class TestRunner {
  private tests: Array<{ name: string; fn: () => void }> = [];
  private passed = 0; private failed = 0;
  test(name: string, fn: () => void) { this.tests.push({ name, fn }); }
  async run() {
    console.log("🧪 Running i18n-parity tests...\n");
    for (const { name, fn } of this.tests) {
      try { fn(); this.passed++; console.log(`  ✅ ${name}`); }
      catch (e) { this.failed++; console.error(`  ❌ ${name}`); if (e instanceof Error) console.error(`     ${e.message}`); }
    }
    console.log(`\n${this.passed} passed, ${this.failed} failed`);
    if (this.failed > 0) process.exit(1);
  }
}
const runner = new TestRunner();
runner.test("he and en have identical key sets", () => {
  const h = new Set(keyPaths(he));
  const e = new Set(keyPaths(en));
  const onlyHe = [...h].filter((k) => !e.has(k));
  const onlyEn = [...e].filter((k) => !h.has(k));
  if (onlyHe.length || onlyEn.length) {
    throw new Error(`Key mismatch.\n  only in he: ${onlyHe.join(", ") || "—"}\n  only in en: ${onlyEn.join(", ") || "—"}`);
  }
});
runner.run();
```

Note: this test imports JSON — ensure `tsconfig.json` has `resolveJsonModule: true` (it does, since the app imports messages). Run: `npx tsx tests/unit/i18n-parity.test.ts` → PASS.

- [ ] **Step 6: Verify + commit**

Run: `npx tsc --noEmit && npm run lint && npm test` → all green.

```bash
git add app/api/account/plan/route.ts messages/he.json messages/en.json lib/trial-view.ts tests/unit/trial-view.test.ts tests/unit/i18n-parity.test.ts
git commit -m "feat(billing): plan API trial+count, Trial i18n namespace, pill view-model"
```

---

### Task 2: `usePlan` hook + nav trial pill + dashboard trial card

**Files:**
- Create: `hooks/use-plan.ts`
- Create: `components/trial-pill.tsx`, `components/trial-card.tsx`
- Modify: `components/sidebar.tsx` (mount pill in user-info block), `app/[locale]/dashboard/page.tsx` (mount card after PageHeader)

**Interfaces:**
- Consumes: `getTrialPillView` from `@/lib/trial-view`; `/api/account/plan`
- Produces: `usePlan()` → TanStack query of the plan response; `<TrialPill />`, `<TrialCard onUpgrade={...} />`

- [ ] **Step 1: Create `hooks/use-plan.ts`**

Follow the project's existing TanStack Query hook style (see other `hooks/use-*.ts`). It fetches `/api/account/plan` and returns `{ data, isLoading }` where data is `{ plan: { tier, status, periodEnd, founding, trial }, activeClientCount }`. Use a stable `queryKey: ["account-plan"]` and a typed response interface. (Read an existing hook like `hooks/use-profile.ts` first to match conventions: queryClient, staleTime, fetch+json error handling.)

- [ ] **Step 2: Create `<TrialPill />`**

A client component using `usePlan()` + `getTrialPillView(data.plan.trial)`. Returns `null` when the view is null (no active trial). Renders a small rounded-full pill with `useTranslations("Trial")`:
- ending: `bg-warning/15 text-warning border border-warning/30` + `t("pillEnding", { days })`
- active: `bg-primary/[0.06] text-primary border border-primary/25` + `t("pillActive", { days })`
Classes: `inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold`. RTL-safe (no left/right literals).

- [ ] **Step 3: Mount the pill in the sidebar**

In `components/sidebar.tsx`, in the user-info block (between the avatar link and the logout button), render `{!isCollapsed && <TrialPill />}`. Import the component. Do not change other sidebar behavior.

- [ ] **Step 4: Create `<TrialCard onUpgrade>` and mount on dashboard**

`components/trial-card.tsx`: client component using `usePlan()`. Shows only when there's an active trial (`getTrialPillView` non-null) OR when the trial has just ended with locked clients (trial present but `active:false`). Active state: heading `t("cardHeading")`, body `t("cardBody", { days })`, CTA button `t("cardCta")` → calls `onUpgrade`. Ended state: `t("endedHeading")` + `t("endedBody", { limit: 1 })` + CTA. Card style: `rounded-[var(--radius-card)] border p-5 sm:p-6` with `bg-primary/[0.06] border-primary/25` (active) or `bg-warning/10 border-warning/30` (ending/ended). In `app/[locale]/dashboard/page.tsx`, mount `<TrialCard onUpgrade={() => router.push("/pricing")} />` right after `<PageHeader>` (~line 360), before the first-time checklist. (Wire the real upgrade modal in Task 4; for now navigate to `/pricing`.)

- [ ] **Step 5: Verify + commit**

Run: `npx tsc --noEmit && npm run lint` → clean. (UI render verified manually/E2E.)

```bash
git add hooks/use-plan.ts components/trial-pill.tsx components/trial-card.tsx components/sidebar.tsx app/[locale]/dashboard/page.tsx
git commit -m "feat(billing): usePlan hook, nav trial pill, dashboard trial card"
```

---

### Task 3: Clients page — locked rows, make-active, upgraded usage banner

**Files:**
- Modify: `app/[locale]/clients/page.tsx` (read `lockedClientIds`; badge + actions in desktop table + mobile cards)
- Modify: `components/plan-usage-banner.tsx` (already has at-limit upgrade; add trial-ended awareness if desired — minimal)

**Interfaces:**
- Consumes: `/api/clients` `lockedClientIds`; `POST /api/clients/[id]/make-active`

- [ ] **Step 1: Read `lockedClientIds` into state**

In `app/[locale]/clients/page.tsx` where the fetch reads `data.plan` (~line 205), also read `data.lockedClientIds` into a `Set<string>` state `lockedIds`. Default to empty set.

- [ ] **Step 2: Add a `handleMakeActive(clientId)` function**

POSTs to `/api/clients/[id]/make-active`, on success refetches the clients list (re-runs the existing fetch) and shows `showSuccessToast(t(...))`; on failure `showErrorToast`. Use the existing `lib/toast.ts` helpers and the existing refetch mechanism in the page.

- [ ] **Step 3: Render lock state in BOTH the desktop table row and the mobile card**

For each client where `lockedIds.has(client.id)`: add a small badge `t("Clients.usage.locked")` styled `bg-muted text-muted-foreground` with a lock icon (lucide `Lock`), and an inline action group: a "Make active" button (`t("Clients.usage.makeActive")` → `handleMakeActive(client.id)`) and an "Upgrade to unlock" link (`t("Clients.usage.upgradeToUnlock")` → `/pricing`). Add the same in both the desktop `clients.map` (table row) and the mobile `clients.map` (card). Keep the existing status/edit controls. Include the reassuring `t("Clients.usage.dataSafe")` as muted helper text near the locked badge.

- [ ] **Step 4: Verify + commit**

Run: `npx tsc --noEmit && npm run lint` → clean.

```bash
git add app/[locale]/clients/page.tsx components/plan-usage-banner.tsx
git commit -m "feat(billing): locked-client rows + make-active switch on clients page"
```

---

### Task 4: UpgradeModal + pricing "what you'll keep"

**Files:**
- Create: `components/upgrade-modal.tsx`
- Modify: `app/[locale]/dashboard/page.tsx` (use the modal for the TrialCard CTA), `app/[locale]/pricing/pricing-client.tsx` (add the count line)

**Interfaces:**
- Consumes: `usePlan()`, Radix `Dialog` from `@/components/ui/dialog`, `authClient.checkout` from `@/lib/auth/client`

- [ ] **Step 1: Create `<UpgradeModal open onOpenChange>`**

Client component using `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`/`DialogDescription`/`DialogFooter`. Title `t("Trial.upgradeTitle")`, body `t("Trial.upgradeBody", { limit: 1, count })` (count from `usePlan().activeClientCount`), a primary "See plans" button (`t("Trial.upgradeCta")`) that navigates to `/pricing` (or calls `authClient.checkout({ slug: "unlimited-annual" })` directly), and a secondary `t("Trial.maybeLater")` that closes. Always closable (the "maybe later" guardrail).

- [ ] **Step 2: Wire the modal into the dashboard TrialCard CTA**

In `app/[locale]/dashboard/page.tsx`, replace the `onUpgrade={() => router.push("/pricing")}` placeholder with state controlling `<UpgradeModal open={upgradeOpen} onOpenChange={setUpgradeOpen} />`, and `onUpgrade={() => setUpgradeOpen(true)}`.

- [ ] **Step 3: Add "what you'll keep" line to the pricing page**

In `app/[locale]/pricing/pricing-client.tsx`, fetch now returns `activeClientCount` (the page already fetches `/api/account/plan`). When `currentTier === "free"` and `activeClientCount > 1`, render a muted line under the header: `t("Trial.upgradeBody", { limit: 1, count: activeClientCount })`. (Read `activeClientCount` from the same `/api/account/plan` response the page already consumes.)

- [ ] **Step 4: Verify + commit**

Run: `npx tsc --noEmit && npm run lint && npm test` → all green.

```bash
git add components/upgrade-modal.tsx app/[locale]/dashboard/page.tsx app/[locale]/pricing/pricing-client.tsx
git commit -m "feat(billing): upgrade modal + pricing 'what you'll keep' line"
```

---

## Self-Review
- Spec coverage: §6 touchpoints — pill (T2), dashboard card (T2), locked rows + make-active (T3), upgrade modal (T4), usage banner (T3); trial-ending intensity via `ending` flag (T1/T2). §9 pricing "what you'll keep" (T4). §10 i18n — all strings in he+en + parity test (T1). Trial-ending banner (#3 in spec table) is folded into the dashboard card's "ending" state to avoid banner overload (documented divergence).
- Placeholder scan: none — full code for API change, helper, tests, i18n; component specs cite exact mount points + tokens + i18n keys.
- Type consistency: `getTrialPillView`/`TrialInfo`/`TrialPillView` (T1) consumed by pill+card (T2); `usePlan` response shape used by T2-T4; `lockedClientIds` + make-active (T3) match Plan 2's API.

## Deferred / divergences (no silent caps)
- The standalone "trial-ending banner" (spec §6 row 3) is merged into the dashboard TrialCard's ending state — one strong surface instead of two, less nudge fatigue.
- UI components are verified by tsc+lint + manual/E2E (the tsx unit runner has no React DOM); the testable logic (view-model, i18n parity) is unit-tested.
