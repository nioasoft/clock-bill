# Monetization via Polar — Design Spec

**Date:** 2026-06-07
**Status:** Approved design (pending spec review → implementation plan)
**Owner:** Asaf (Asi)

## 1. Overview & Goal

Introduce paid subscriptions to Monit, billed through **Polar.sh as Merchant of Record (MoR)**. Today the app is free for everyone. We gate on **number of active clients only** — all features remain available on every tier, and there are **no usage limits** (timers/hours/exports stay unlimited; tracking is the hook and the data lock-in).

Success = a freelancer who outgrows the free tier can upgrade in-app in a few clicks, billing/VAT/invoicing is handled by Polar, and the app correctly grants/revokes capacity based on subscription state.

## 2. Pricing Model

| Tier | Active clients | Price (USD) |
|---|---|---|
| **Free** | 1 | $0 |
| **Starter** | up to 5 | **$7/mo** · **$67/yr** (save ~20%) |
| **Unlimited** | unlimited | **$14/mo** · **$134/yr** (save ~20%) |

- **Currency:** USD only (FX-proof; Polar is USD-centric; global remote-freelancer audience thinks in USD).
- **Billing periods:** monthly **and** annual. Annual is **~20% cheaper** than 12× monthly ($7→$67, $14→$134) — a clear "save 20%" message, and it's also strongly preferred for fee efficiency (the flat $0.50/transaction Polar fee is paid once/year instead of 12×; see §9).
- **Free tier** is the *absence* of a paid subscription — not modeled as a Polar product.
- **Owner account** (`benatia.asaf@gmail.com`, current admin): permanently Unlimited via a `founding`/admin flag. There are **no other existing users**, so there is no grandfather cohort to build — just ensure the owner account is never capped.

### "Active clients" definition
Active = **non-archived** clients. The app already has client archiving. Archiving a client frees a slot; un-archiving requires capacity. This gives the user a self-service way to stay within a tier without losing data.

## 3. Entitlements & Enforcement

### Source of truth for "what tier is this user on right now"
- **Local column, written by Polar webhooks** (fast, per-request, works even if Polar is down).
- Polar `customer.state_changed` webhook + `getStateExternal({ externalId: user.id })` used for reconciliation (a periodic sanity cron), never on the hot path.

### Enforcement points
1. **Server-side** in the create-client API route: count active clients vs the tier cap *before* insert. Return a structured error (`PLAN_LIMIT_REACHED`) — this is the real gate (Iron Law 5: frontend gating is not gating).
2. **UI**: show current tier; when at cap, disable "add client" with a clear reason + upgrade CTA (never a silent disable — UX states playbook).
3. **Defense in depth**: consider a DB-level check given RLS is already in place (nice-to-have, not required for v1).

### Downgrade / cancel behavior (never lose data)
- Treat the user as **paid while `status === "active"`**, even when `cancel_at_period_end === true`. Keep access until `current_period_end`.
- Downgrade to Free **only on `subscription.revoked`**.
- A user who drops below their cap (e.g. Unlimited → Free with 8 clients): **all existing clients stay visible and read-only**; they cannot add new clients until under the cap or re-upgraded. **No deletion, ever.**

## 4. Polar Integration Architecture

### Approach: `@polar-sh/better-auth` plugin (recommended)
The app already uses Better Auth. The official plugin auto-creates a Polar customer on signup with `externalId = user.id` — **no separate mapping table**. Reads/writes address the customer by our own `user.id` via the `external` endpoints.

- Packages: `@polar-sh/better-auth`, `@polar-sh/sdk` (+ `@polar-sh/nextjs` as a fallback for standalone route handlers).
- Plugin sub-modules used: `checkout`, `portal`, `webhooks` (skip `usage` — no usage-based billing).
- `createCustomerOnSignUp: true`, `authenticatedUsersOnly: true` on checkout.
- Wire `deleteUser.afterDelete` → `polar.customers.deleteExternal({ externalId })` so GDPR account deletion also removes the Polar customer (extends existing deletion flow in `app/api/account/route.ts`).

### Products in Polar
Billing interval + pricing are fixed per product, so **4 paid products** (tier × interval), each with `metadata: { tier: "starter" | "unlimited" }` so the webhook maps product → tier without hardcoding UUIDs:
- Starter Monthly ($7), Starter Annual ($67)
- Unlimited Monthly ($14), Unlimited Annual ($134)

### Schema changes (`user_profiles`, via `src/db/schema.ts`)
```
subscription_tier        text  default 'free'   -- 'free' | 'starter' | 'unlimited'
subscription_status      text                    -- mirror of Polar status
subscription_period_end  timestamptz             -- current_period_end
polar_subscription_id    text
founding                 boolean default false    -- owner/grandfather → always unlimited
```
Migration applied via the project's psql/admin path (per `drizzle-meta-drift` memory), dev branch first, then prod.

### Webhooks
- Endpoint mounted by Better Auth (point the Polar dashboard endpoint at the resolved auth handler path; verify exact path during impl).
- Signature verification is built into the plugin (`secret: POLAR_WEBHOOK_SECRET`).
- Handlers: `onSubscriptionActive` (grant tier), `onSubscriptionUpdated` (re-derive tier from product), `onSubscriptionCanceled` (keep access — scheduled end), `onSubscriptionRevoked` (downgrade to free), `onOrderPaid` (renewals), `onCustomerStateChanged` (preferred catch-all → write local columns).
- **Dedupe** by webhook event id (append-only / idempotent write), return 2xx fast (payments playbook).

### Customer portal
Polar-hosted portal for manage/cancel/upgrade/payment-method/invoices: `authClient.customer.portal()`. No portal UI to build.

### Environments
Sandbox and production are fully separated (tokens, products, webhook secrets). Maps to the existing dev/prod split. Env vars (server-only, never `NEXT_PUBLIC_*`): `POLAR_ACCESS_TOKEN` (Organization Access Token), `POLAR_WEBHOOK_SECRET`, optional `POLAR_SERVER=sandbox|production`. Set per Vercel scope (Preview = sandbox, Production = live).

## 5. Checkout & Compliance UI

A new `/pricing` page + upgrade flow. The checkout/upgrade UX must include (legal §6):
- Total price + currency (USD) + note that **Polar may add VAT/tax at checkout**.
- Billing frequency explicit ("$5/month, billed monthly") + "renews automatically until cancelled".
- How to cancel (any time, in-app, takes effect within ~3 business days, stops future charges).
- **MoR disclosure**: "Payments are processed by **Polar Software Inc. as Merchant of Record**; your purchase agreement is with Polar." + link to Polar buyer terms.
- **EU express-consent checkbox (un-ticked)**: "I request immediate access and acknowledge I lose my 14-day right of withdrawal once the service is fully performed."
- Links to Monit ToS + Privacy (already accepted at signup via the new consent checkbox).
- **Verify whether Polar's hosted checkout already collects the EU express-consent acknowledgement and provides the 19-Jun-2026 EU withdrawal button** — if not, surface them ourselves.

All new UI strings bilingual (he + en) via next-intl, following the existing `messages/{he,en}.json` + `[locale]` patterns. Dark ClickHouse theme tokens, RTL-safe.

## 6. Legal / ToS Changes

The ToS already has a `pricing` section ("free now, paid later"). Add payment clauses (bilingual), accurately reflecting the MoR structure — **do not imply Monit is the seller**:

1. **Payment via Polar as MoR**: purchase/payment contract is with Polar; Monit provides the licensed service under these Terms. Polar's terms govern payment; ours govern the license.
2. **Billing & auto-renewal**: plans, USD prices, monthly/annual, auto-renews until cancelled.
3. **Price changes**: advance notice; for IL include the **§13א standalone pre-renewal notice** + a separate notice when any promo price ends.
4. **Cancellation & effect (IL עסקה מתמשכת)**: cancel any time in-app; takes effect **within 3 business days**; **no charges after the cancellation date**; pro-rata refund of unused ongoing-service period.
5. **Refunds**: processed by Polar per its policy + card-network rules, **without prejudice to statutory rights** (IL 14-day distance-sale + EU 14-day withdrawal subject to express-consent waiver). No blanket "no refunds".
6. **Taxes**: VAT/sales tax collected & remitted by Polar as MoR; displayed prices may exclude tax.
7. **Cooling-off / withdrawal**: IL 14-day distance-sale + EU 14-day withdrawal + the express-consent waiver for immediate start.
8. **Downgrade & data retention on cancellation**: what happens to data, retention window, export availability (ties to existing GDPR export), deletion path.
9. **Free-tier terms**: scope/limits (1 client), may change, no payment obligation.
10. **Governing law / venue**: Israeli law; Polar's terms govern the payment leg; mandatory EU consumer protections preserved.

Also: **system capability to send the §13א standalone pre-renewal notice + end-of-promo notice** (email). Confirm whether Polar's renewal emails satisfy this or we send our own.

## 7. Launch Prerequisites (non-code — owner action)

These block charging real money; flagged from the legal research:
1. **Legal identity = עוסק מורשה** (the brand-only identity from the privacy work no longer suffices once money changes hands). Needed for invoicing Polar and Israeli tax. **[VERIFY WITH רו"ח]**:
   - Do I issue a חשבונית מס to **Polar** (not the end customer) for USD payouts? FX recording?
   - Does the payout qualify as **export of services / 0% VAT (§30)**?
   - עוסק פטור vs מורשה threshold (~₪120k/yr — verify current) given annual USD subs.
   - חשבוניות ישראל allocation-number applicability to foreign-currency export invoices.
2. **Polar account KYC** (Stripe Connect Express under the hood; Israel is supported). Review can take ~1–2 weeks — start early.
3. **DPA with Polar** (sub-processor) — add Polar to the privacy-policy sub-processor list (joins Vercel/Neon/Google/Resend from the 2026-06-07 legal work).
4. Decide & set up Polar products in sandbox first, then production.

## 8. Out of Scope (now) / Future

- A mid-tier between Starter and Unlimited (add later if data shows demand; YAGNI).
- Usage-based billing / seats / team accounts.
- Proration fine-tuning beyond Polar defaults.
- Crypto/multi-currency *pricing* (display stays USD; the app's crypto features are unrelated to plan pricing).

## 9. Risks & Open Caveats (verify during implementation)

1. **Better Auth client APIs under Turbopack (Next 16)** — known issue (better-auth#6845). Test `checkout`/`portal`/`customer.*` early; fallback to `@polar-sh/nextjs` standalone route handlers if broken.
2. **Fee drag, worst on monthly** — Polar (May 2026) is 5% + $0.50 + 1.5% non-US card ≈ ~14% effective on $7/mo, ~10% on $14/mo. The flat $0.50 is paid once/year on annual → annual is materially more profitable. **Surface annual prominently** (default toggle to annual on the pricing page).
3. **EU withdrawal button (19 Jun 2026)** lands at launch — confirm Polar provides it.
4. **Portal upgrade/downgrade proration math** — confirmed switching works; exact proration not documented. **Verify in sandbox.**
5. **Orphaned user** if Polar customer creation fails at signup (better-auth#2254) — handle gracefully.
6. **Webhook mount path** under Better Auth varies — confirm the resolved path and point the dashboard endpoint there.

## 10. Testing Plan

- Sandbox org + test cards (`4242…`; a non-US test card for the +1.5% path).
- Full lifecycle in sandbox: checkout → `subscription.active` (grant) → at-cap enforcement on create-client → portal cancel → `cancel_at_period_end` keeps access → `subscription.revoked` at period end → downgrade-to-free read-only behavior.
- Webhooks locally via Polar CLI or ngrok against the dev branch.
- Unit tests for the entitlement helper (tier → cap) and the create-client gate; integration test for the webhook → column write + dedupe.
