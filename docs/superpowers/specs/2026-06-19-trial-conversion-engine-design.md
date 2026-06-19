# Trial & Conversion Engine — Design Spec

**Date:** 2026-06-19
**Status:** Approved (brainstorming) → ready for implementation plan
**Author:** Asaf + Claude

---

## 1. Goal & Context

ClockBill's monetization paywall is **active-client count only** (`free=1`, `starter=5`, `unlimited=∞`; see `lib/plans.ts`). Every feature is available on every tier. Today the *only* conversion driver is a single banner on the clients page when a user hits the cap (`components/plan-usage-banner.tsx`), and a "view plans" link in settings. A freelancer with one client therefore never sees a reason to pay.

This spec designs a **conversion engine** around that same simple paywall — no new feature gating. The engine rests on three psychological anchors:

1. **Taste the full value from day one** — every new user starts on a 14-day Unlimited trial.
2. **Make the loss tangible** — when the trial ends, the clients added during it become visibly *locked* (read-only), not deleted.
3. **Zero friction to convert** — one click from any nudge to Polar checkout.

**Hard requirement:** everything user-facing is **bilingual (Hebrew + English)** via the existing `next-intl` setup (`messages/he.json`, `messages/en.json`; `he` is prefix-less default, `en` = `/en`). This includes in-app nudges **and** all lifecycle emails.

**Decisions locked in brainstorming:**
- Paywall stays = active-client count (no feature gating).
- Conversion model = **14-day app-managed Unlimited trial, no credit card**.
- Trial length = **14 days**.
- Post-trial: extra clients **locked read-only**; the **most-recently-active** client stays usable.
- Email lifecycle = **in scope** (6 emails, bilingual).

---

## 2. The State Machine

Every user resolves to exactly one billing state. State is derived on read (no stored "state" column) from `user_profiles` + `now`.

| State | Condition | Effective tier | What the user feels |
|---|---|---|---|
| **Trialing** | `trial_ends_at IS NOT NULL AND now < trial_ends_at` AND no paid sub | `unlimited` | Full freedom, add unlimited clients |
| **Trial-ending** | Trialing AND `trial_ends_at - now ≤ 3 days` | `unlimited` | "I'm about to lose this" |
| **Free (locked)** | Trial expired (or none), no paid sub | `free` (1) | Sees locked clients = tangible loss |
| **Paid** | Active Polar subscription | `starter` / `unlimited` | No nudges, only "manage" |
| **Founding** | `founding = true` | `unlimited` | Exempt — owner / pre-launch; **skips trial entirely** |

Precedence on read: `founding` → paid subscription → active trial → free. Founding and paid both override trial.

---

## 3. Data Model

Add three columns to `user_profiles` (Drizzle `src/db/schema.ts`, then SQL migration `0023_trial`):

```ts
// user_profiles additions
trialStartedAt:  timestamp("trial_started_at"),   // when the trial began
trialEndsAt:     timestamp("trial_ends_at"),       // start + 14d
trialUsed:       boolean("trial_used").default(false), // prevents a second trial
```

Add one nullable column to `clients` for the switchable "kept active" pointer (see §5):

```ts
planPriorityAt: timestamp("plan_priority_at"), // explicit "keep this one active" bump; NULL => fall back to activity rank
```

**Migration note:** per `[[drizzle-meta-drift]]`, the drizzle journal is out of sync in prod. Generate the migration file for review, but **apply to dev + prod via `psql` using `DATABASE_URL_ADMIN`**, not `db:migrate`. Add RLS coverage: the new `clients.plan_priority_at` is on an already-RLS'd table, so no new policy needed; `user_profiles` columns likewise covered.

`TRIAL_DAYS = 14` lives as a constant in `lib/plans.ts` (single source of truth, imported by signup hook + cron + UI copy).

---

## 4. Entitlement Resolution Changes

`lib/entitlements.ts → getUserPlan()` becomes trial-aware. Extend the `UserPlan` interface and the resolution:

```ts
export interface UserPlan {
  tier: PlanTier;            // effective tier
  clientLimit: number;
  status: string | null;
  periodEnd: string | null;
  founding: boolean;
  trial: {                   // NEW
    active: boolean;
    endsAt: string | null;
    daysLeft: number | null; // ceil((endsAt - now)/day), >=0
  } | null;
}
```

Resolution order in `getUserPlan`:
1. `founding` → `unlimited`, `trial: null`.
2. Paid sub (`subscription_tier` in {starter, unlimited} AND status active) → that tier, `trial: null`.
3. `trial_ends_at` present AND `now < trial_ends_at` → `unlimited`, `trial: { active: true, ... }`.
4. Else → stored `subscription_tier` or `free`; `trial` reflects an expired trial (`active:false`) so the UI can show "trial ended" copy.

This keeps all gating server-authoritative and derived from one function — every caller (`/api/clients`, pricing, dashboard, write guards) reads the same truth.

---

## 5. Client Locking (the trickiest piece)

When effective tier drops to `free` (limit 1) but the user has more than one `is_active` client, the extras become **plan-locked**: visible, data intact, but **read-only**.

**Which client stays unlocked** (deterministic, switchable):
- Rank `is_active` clients by `COALESCE(plan_priority_at, last_time_entry_at, created_at)` **descending**.
- Top `clientLimit` (=1 for free) stay **usable**; the rest are **plan-locked**.
- An explicit **"Make this my active client"** action on a locked client sets its `plan_priority_at = NOW()` (free, instant), bumping it to the top → it unlocks and the previous one locks. This is how the user "switches which one is active."

**A new helper** `lib/entitlements.ts → getClientLockState(userId)` returns the set of locked client IDs (one query joining clients ↔ latest time entry). The clients API and any per-client write path use it.

**Server-side enforcement (iron law — not UI-only):** every mutating route scoped to a client must reject writes to a plan-locked client with `402 Payment Required` + Hebrew/English message `{ success:false, code:"PLAN_LOCKED", message }`. Affected routes (audit during planning): start/stop timer, create/edit/delete time entry, edit client, edit project under a locked client, generate charge docs for a locked client. Reads stay allowed.

**Data safety (UX guardrail):** every locked surface states explicitly "your data is safe / הנתונים שלך שמורים." Never delete, never imply deletion.

---

## 6. In-App Nudge System

Bilingual, intensity rising over the lifecycle. Principle: **never interrupt active work** (don't block a running timer), everything dismissible **except** the conversion modal's primary action (which still offers "later"). New copy lives under a `Billing`/`Trial` namespace in `messages/{he,en}.json`.

| # | Touchpoint | Shown when | Intensity | Component |
|---|---|---|---|---|
| 1 | **Nav trial pill** — "Unlimited · 11 days left" | Trialing | Subtle; turns `warning` in last 3 days | new `TrialPill` in app header |
| 2 | **Dashboard trial card** — value recap + "Lock in your plan" CTA | Trialing; intensifies in last 3 days | Medium | new `TrialDashboardCard` |
| 3 | **Trial-ending banner** — "Trial ends in 3 days — keep your N clients" | Trial-ending (≤3 d) | Strong, dismissible (re-shows daily) | new `TrialEndingBanner` |
| 4 | **Locked client rows** — 🔒 badge + "Upgrade to unlock" + "Make active" | Free with locked clients | Constant, passive (loss made visible) | extend clients list row |
| 5 | **Conversion modal** — the central moment; fires on: add 2nd client, unlock a locked client, or "Lock in your plan" | On action | Strong, blocking, with "Maybe later" | new `UpgradeModal` (reuses `authClient.checkout`) |
| 6 | **Usage banner (existing)** — upgraded copy + trial awareness | Clients page | Subtle | extend `plan-usage-banner.tsx` |

All CTAs route to `/pricing` or call `authClient.checkout({ slug })` directly (the modal). `daysLeft` comes from `getUserPlan().trial`.

---

## 7. Email Lifecycle

Six transactional emails via the existing `lib/email.ts` (Resend) wrapper, all **bilingual** — recipient locale resolved best-effort (reuse the locale resolution already used by `app/api/cron/notifications` rows; default `he`). Templates built with the existing email HTML builder in `lib/email.ts` (or `react-email` skill if richer layout is wanted); subject + body strings keyed per locale.

| Day | Email | Purpose | Trigger |
|---|---|---|---|
| 0 | Welcome — "You've got 14 days of Unlimited" | Activation | Signup hook (immediate) |
| 3 | "Added your clients yet?" | Onboarding | Cron |
| 7 | Mid-trial — "Here's what you've tracked" | Value reinforcement | Cron |
| 11 | "3 days left — here's what you'll lose" (lists their clients) | Loss aversion | Cron |
| 14 | "Trial ended — N clients are locked. Unlock for $X" | Conversion | Cron (on expiry) |
| 17 | Final win-back nudge | Last touch | Cron |

**Delivery mechanism:** a new daily cron `app/api/cron/trial-lifecycle` (add to `vercel.json` crons, e.g. `0 9 * * *`). It selects users by trial-day offset, sends the due email, and records what was sent to guarantee **idempotency / no double-send** — add a small `trial_emails_sent` tracking table (`user_id`, `email_key`, `sent_at`, unique on `user_id+email_key`) **or** a `jsonb` array on `user_profiles`. Recommend the table (clean, queryable). Day-0 welcome fires from the signup hook, not the cron.

**Anti-spam:** each email sends at most once (idempotency table); all respect a future unsubscribe; frequency capped by the schedule itself.

---

## 8. Trial Start Trigger

New non-founding users start the trial **on signup**. Hook into the existing Better Auth signup flow (`lib/auth/better-auth.ts` — same place `createCustomerOnSignUp` / profile creation happens) or the onboarding completion. On first profile creation for a non-founding user:
- set `trial_started_at = NOW()`, `trial_ends_at = NOW() + INTERVAL '14 days'`, `trial_used = true`;
- send the Day-0 welcome email.

**Founding users:** never get a trial (already unlimited). **Existing users** (pre-feature signups): a one-time backfill decision during planning — recommend **not** retroactively trialing existing free users (they already chose free); only new signups get the trial. Flag in plan.

---

## 9. Pricing Page Tweaks (`pricing-client.tsx`)

- Keep annual default + Unlimited highlight (already done). ✅
- Add **"what you'll keep"** context: when the viewer is free-with-locked or trialing, show "You have N clients — Free supports 1" using `getUserPlan` data already fetched on the page.
- Optional **founding/early-bird urgency** copy if a limited price applies (confirm during planning; out of scope if no such offer exists).
- Social proof — explicitly **out of scope** until there are real users.

---

## 10. i18n Requirements (cross-cutting)

- All new strings added to **both** `messages/he.json` and `messages/en.json` under a new `Billing` (or `Trial`) namespace; no hardcoded user-facing text.
- RTL respected (logical properties) for all new components — pill, card, banner, modal, locked rows.
- Email templates rendered per recipient locale (`he` RTL / `en` LTR) via `lib/email.ts`'s existing `locale` support.
- Server-context copy (cron emails) mirrors strings inline per locale, following the existing pattern in `app/api/cron/notifications/route.ts` (next-intl request scope isn't available in cron).

---

## 11. Edge Cases

- **Trial → paid mid-trial:** paid sub overrides trial immediately; stop trial nudges/emails. Polar webhook (`syncSubscription`) already sets tier; ensure cron skips users with an active sub.
- **Re-trial prevention:** `trial_used = true` blocks a second trial even if columns are cleared.
- **Downgrade from paid → free:** existing `revokeEntitlement` path; locked-client logic applies the same way (no re-trial).
- **Clock skew / timezone:** trial math in UTC; `daysLeft` uses `ceil`. Day-N email windows use a date range to tolerate the daily cron cadence (don't miss a day).
- **Email unconfigured (local dev):** `lib/email.ts` already no-ops without `RESEND_API_KEY` — safe.
- **User on free who never trialed (legacy):** sees free behavior, no trial nudges (their `trial_ends_at` is NULL and `trial_used` false → treat as free, no auto-start).

---

## 12. Testing Plan

- **Unit** (`tests/unit`, existing tsx runner): `getUserPlan` state resolution across all 5 states + founding/paid precedence; `getClientLockState` ranking incl. `plan_priority_at` override; `daysLeft` math + clock edges.
- **Integration:** plan-locked write returns 402 on each affected route; "make active" bumps priority and flips lock; trial-start hook sets columns + day-0 email; cron sends correct day-N email once (idempotency).
- **i18n:** every new key exists in both `he.json` and `en.json` (add a key-parity test).
- **Manual E2E:** fresh signup → trial pill → add clients → fast-forward `trial_ends_at` → locked rows → "make active" switch → upgrade modal → Polar checkout → unlock. Use the **99%-off coupon** (see §14) for one real minimal charge end-to-end.

---

## 13. Anti-Patterns to Avoid (UX guardrails)

- No data-hostage framing — always "your data is safe."
- Never block/interrupt a **running timer** to show a nudge.
- No email spam — one send per email_key, ever.
- Locked ≠ hidden — keep locked clients visible so the loss is honest, not punitive.
- The conversion modal always has a "Maybe later" exit.

---

## 14. Test Coupon (separate, parallel task)

Create a **99% percentage discount** via the Polar **API** (using `POLAR_API_KEY`, production), restricted to **1 redemption** + short expiry. Apply it during the manual E2E to the **annual Unlimited ($134 → $1.34)** plan so the charge clears Stripe's ~$0.50 minimum and exercises the real money path + webhook. (99% on monthly $7 = $0.07 would be rejected.) This is test infrastructure, not part of the feature; can be created independently of this plan.

---

## 15. Out of Scope (YAGNI)

- Feature-based gating (explicitly rejected — paywall stays client-count).
- Card-required trial / Polar-native trial (rejected — app-managed, no card).
- Social proof, A/B testing framework, referral system.
- Retroactive trials for existing free users.
- In-app unsubscribe management UI (a simple link/flag is enough for v1).

---

## Open items for the implementation plan to resolve
1. Exact signup hook location for trial-start (Better Auth profile creation vs onboarding completion).
2. `trial_emails_sent` table vs `jsonb` column — recommend table.
3. Full audit list of client-scoped write routes needing the 402 guard.
4. Recipient-locale source for emails (push_subscriptions.locale vs a profile column vs default).
5. Whether any founding/early-bird limited price exists for the urgency copy.
