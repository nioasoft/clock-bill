# Spec — Settlement-Date Reminders (Phase B)

**Date:** 2026-06-21
**Branch:** `feat/settlement-reminders` (to be created)
**Status:** Approved design, ready for implementation plan

> Format note: markdown (git-committed process artifact for the `writing-plans` skill; the global HTML-docs rule carves out PR-diff files).

## Background

ClockBill freelancers settle ("התחשבנות") with clients on a recurring cycle (typically monthly). Today nothing reminds them when a client's billing date arrives, so settlements slip. Client feedback (Shirly): "add reminders per the settlement date; the system pops it up in the morning until the freelancer does the settlement and the invoice reaches the client."

This is **Phase B** of the 3-phase roadmap from that feedback. Phase A (email charge documents via a branded link) shipped 2026-06-21. Phase C (payment-tracking ledger + discount documentation) is later, its own spec.

## Goals

1. Each client has an optional **monthly settlement day**.
2. A client becomes "due for settlement" when its billing day has passed this cycle AND it has **unbilled billable work** — and clears automatically when a charge document is issued.
3. A persistent **"settlements due" dashboard section** lists due clients (amount + days overdue) with a "create charge document" CTA.
4. Once per cycle, on the billing day, the freelancer gets a **push + email digest** of that day's due clients.

## Non-goals (Phase B)

- Per-cycle snooze / "skip this cycle" (the per-client on/off toggle + auto-clear-on-issue cover the cases; easy follow-up).
- Custom reminder frequency, follow-up reminders, SMS.
- A dedicated `/settlements` page (the dashboard section is the surface).
- Auto-issuing charge documents (the freelancer always creates them manually — Phase A).

## Key decisions (resolved during brainstorming)

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| 1 | "Due" definition | **Only when unbilled billable work exists** | No nagging when there's nothing to bill |
| 2 | Architecture | **Computed from existing data** (no new "reminders" table) | YAGNI; reuses the unbilled-entries query; auto-clears for free when a charge doc is issued |
| 3 | Push cadence | **Once per cycle, on the billing day** | The dashboard list is the persistence; push isn't naggy |
| 4 | Channel | **Push + email** (digest to the freelancer) | Covers users without push; one digest, not per-client spam |
| 5 | Surface | **Dashboard section** (in the customizable dashboard) | Where Shirly pictured the morning prompt; fits the existing section system |
| 6 | Billing-day model | **smallint 1–31, NULL = off**; effective day = `LEAST(day, days-in-month)` ("end of month" = store 31) | One column; clamp handles Feb/short months |
| 7 | Morning anchor | Reuse the user's existing `user_profiles.daily_reminder_time` + `timezone` | No new config; respects their morning preference |

## Architecture

### Data model — `clients` (one migration, 0032, no backfill)

Two nullable columns:
- `settlement_billing_day smallint` — 1–31; **NULL = settlement reminders off for this client**. The effective day for a given month is `LEAST(settlement_billing_day, days_in_that_month)`.
- `settlement_reminded_at date` — the date the push+email was last sent for this client (prevents re-firing within the same cycle).

Add a CHECK constraint mirroring the existing `clients` pattern (`billing_rounding`, `vat_mode`):
`settlement_billing_day IS NULL OR (settlement_billing_day BETWEEN 1 AND 31)`.

**RLS:** `clients` is already `ENABLE + FORCE ROW LEVEL SECURITY` with the `tenant_isolation` policy (drizzle/rls-policies.sql line 32). New columns inherit it automatically — **no new policy**. App-level `WHERE user_id = $` stays as belt-and-suspenders.

### "Due" logic — `lib/settlements.ts` (pure, unit-tested)

Pure helpers, no DB:
- `effectiveBillingDay(billingDay: number, year: number, month1to12: number): number` → `min(billingDay, daysInMonth)`.
- `hasReachedBillingDay(today: Date, billingDay: number): boolean` → true when today's day-of-month ≥ the effective billing day for today's month.
- `isBillingDayToday(today: Date, billingDay: number): boolean` → today's day-of-month === the effective billing day (for the once-per-cycle fire).

All operate on calendar values passed in; the caller supplies the user-local "today".

### Due endpoint — `GET /api/settlements/due`

- `getUser()` → 401 if not authenticated.
- Returns the caller's clients that are due: `settlement_billing_day IS NOT NULL`, today (user-local) has reached the effective billing day, and there EXISTS unbilled billable work (`time_entries.charge_document_id IS NULL AND is_billable = true`, joined client→project→entry). Each row: `{ clientId, clientName, currency, unbilledTotal, billingDay, daysOverdue }`.
- Every query scoped by `user.id` (+ RLS-bound `query()`). Read-only, user-scoped → no rate-limit needed (consistent with other dashboard endpoints).
- `createLogger`; generic Hebrew 500 + `error_code` on failure.

### Cron block — inside `app/api/cron/notifications/route.ts`

A third block alongside the daily-reminder and long-timer blocks. The route is already `isAuthorizedCron`-gated (CRON_SECRET) and uses `adminQuery` (cross-tenant, RLS-bypass) — the sanctioned pattern for these blocks.

- Find every `(user, client)` where: `settlement_billing_day IS NOT NULL`, **today (user-local, via `user_profiles.timezone`) is the effective billing day**, it's past the user's `daily_reminder_time` (morning anchor), unbilled billable work exists, and `settlement_reminded_at` is null or before this cycle's billing date.
- **Group strictly by `user_id`.** Per user: send ONE push + ONE email digest ("N settlements ready" + client list), in the user's `locale`. Then set `settlement_reminded_at = today` for each fired client (`UPDATE ... WHERE client_id = $ AND user_id = $`).
- Push via `sendPushToUser(userId, …)`; email via `sendEmail({ to: <that user's email>, … })` (no reply-to — it's a reminder to self).
- `createLogger`; never throw (degrade per the existing blocks).

### Email template — `lib/emails/settlement-reminder.ts` (bilingual, unit-tested)

`settlementReminderEmail(locale, { clients: {name, amountLabel}[], dashboardUrl }): { subject, html }` built on `emailLayout`/`emailButton`. Digest list + CTA to the dashboard. Escape interpolated client names (HTML body).

### Dashboard section — "Settlements due"

- A new section type registered in the customizable-dashboard config (the existing `dashboard_config` jsonb + customizer; toggleable + reorderable).
- `SettlementsDueCard` fetches `GET /api/settlements/due`; lists client + unbilled amount + days overdue + a **"צור התחשבנות"** CTA linking to the charge-doc creation flow for that client.
- **Four states:** loading (skeleton), success (list), error (readable Hebrew + retry), empty (tidy "no settlements due" — or the section simply renders nothing when empty, per the customizer's behavior for empty sections; match existing sections).
- Design tokens only (no hardcoded colors).

### Per-client config UI

- A "settlement day" control in the client edit form: select 1–28 + "סוף החודש" (= 31) + "ללא תזכורת" (= NULL). Stored via the existing `PUT /api/clients/[id]`.
- Server validation: add `settlementBillingDay: z.number().int().min(1).max(31).nullable()` to the inline `updateClientSchema` in `app/api/clients/[id]/route.ts`; include the column in the scoped `UPDATE clients … WHERE id = $ AND user_id = $`.
- ⚠️ **There are TWO client edit forms** (lesson from the client-document-language feature) that both PUT this endpoint — both need the new UI field. The server endpoint/schema is the single validation point.

## Security requirements (must hold; verified against the iron laws + playbooks)

1. **BOLA:** the due endpoint and every client write are scoped by `user.id` (+ RLS). No new write surface — billing-day goes through the existing user-scoped client PUT. No IDOR.
2. **Cron cross-tenant isolation (the one critical invariant):** the `adminQuery` cron block groups strictly by `user_id`; each push → the owning user, each email → the owning user's address, each `settlement_reminded_at` UPDATE scoped by `client_id AND user_id`. No client's data crosses to another user. (Flag for the reviewer.)
3. **Boundary validation:** `settlement_billing_day` validated server-side in the Zod schema AND by a DB CHECK constraint.
4. **No new unauthenticated surface:** every path is authed (`getUser`) or cron (`CRON_SECRET`). `adminQuery` stays server-only.
5. **Observability / no leaks:** `createLogger` everywhere; generic Hebrew 500 + `error_code` (no stack traces to client); no `console.log` of secrets.
6. **RLS preserved:** new columns inherit the existing FORCE-d `tenant_isolation` policy on `clients`; app-level `WHERE user_id` kept.

## Testing

- **Unit:** `lib/settlements.ts` (effective-day clamp incl. Feb/short months and day=31; `hasReachedBillingDay`; `isBillingDayToday`); `settlementReminderEmail` (he/en subject, digest list, escaping).
- **Manual/automated for routes/cron/UI:** lint + build + i18n parity; the cron fire and dashboard interaction verified by live QA (no API/integration harness in this repo).

## Affected files (orientation)

- `src/db/schema.ts` + `drizzle/0032_settlement_reminders.sql` (2 columns + CHECK on `clients`).
- `lib/settlements.ts` (new, pure) + `tests/unit/settlements.test.ts`.
- `app/api/settlements/due/route.ts` (new).
- `app/api/cron/notifications/route.ts` (add the settlement block).
- `lib/emails/settlement-reminder.ts` (new) + `tests/unit/settlement-reminder-email.test.ts`.
- The customizable-dashboard config + a new `SettlementsDueCard` component (under the dashboard feature).
- `app/api/clients/[id]/route.ts` (extend `updateClientSchema` + the scoped UPDATE) and the TWO client edit forms (UI field).
- next-intl message catalogs (he + en) for the new strings.

## Migration / rollout

- DEV migration first (psql/admin); PROD migration 0032 applied at deploy (additive: 2 nullable columns + CHECK; no backfill).
- Reminders are opt-in per client (NULL day = off), so nothing fires until a freelancer sets a billing day.
