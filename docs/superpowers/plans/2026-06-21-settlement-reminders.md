# Settlement-Date Reminders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remind a freelancer when a client's monthly settlement day arrives and there's unbilled work — via a persistent "settlements due" dashboard section plus a once-per-cycle push + email digest.

**Architecture:** "Due" is computed from existing data (a client with a `settlement_billing_day` whose day has passed this cycle AND that has unbilled billable time entries); it auto-clears when a charge document is issued. A pure `lib/settlements.ts` owns the date math. A user-scoped `GET /api/settlements/due` feeds a new customizable-dashboard section. A new block in the existing notifications cron sends the once-per-cycle push + email digest, grouped strictly per user.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Postgres (raw `pg` via `lib/db.ts`), Drizzle schema in `src/db/schema.ts`, web-push (`lib/push.ts`), Resend (`lib/email.ts`), next-intl, the custom `tsx` test runner.

## Global Constraints

- **BOLA / tenant isolation:** every authed query filters by `user.id` (+ RLS). `clients` is already ENABLE+FORCE RLS with the `tenant_isolation` policy — new columns inherit it; no new policy. The cron uses `adminQuery` (RLS-bypass, cross-tenant) and MUST group strictly by `user_id`: each push → `sendPushToUser(thatUserId)`, each email → that user's own address, each `settlement_reminded_at` UPDATE scoped `WHERE id = $ AND user_id = $`. No client's data crosses to another user.
- **Boundary validation:** `settlement_billing_day` validated server-side in the Zod `updateClientSchema` AND by a DB CHECK constraint (`IS NULL OR BETWEEN 1 AND 31`).
- **No new unauthenticated surface:** every route is `getUser`-authed or cron (`isAuthorizedCron`/CRON_SECRET). `adminQuery` stays server-only.
- API response shape `{ success: boolean, ... }`; Hebrew user-facing `message`; `error_code` present; generic 500 (no stack traces to client). Use `createLogger`; no `console.log`.
- No hardcoded design tokens in app UI (`bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`, `rounded-[var(--radius-card)]`). Mobile tap targets ≥44px.
- All user-facing strings Hebrew + English; i18n keys must exist in BOTH `messages/he.json` and `messages/en.json` (the `i18n-parity`/`messages-parity` tests enforce it).
- TypeScript strict, no `any`; immutable updates; files focused; JSDoc/comments English.
- Billing-day model: `settlement_billing_day` 1–31, NULL = off; effective day = `LEAST(day, days-in-month)` ("end of month" = store 31).
- Schema changes in `src/db/schema.ts` only; migrations applied to DEV via psql/admin, PROD as a separate explicit step (Drizzle-meta-drift note — not `db:migrate`).
- Document/feature dates are absolute (today: 2026-06-21).

---

### Task 1: Schema + migration — `clients.settlement_billing_day` + `settlement_reminded_at`

**Files:**
- Modify: `src/db/schema.ts` (the `clients` table — columns + CHECK)
- Create: `drizzle/0032_settlement_reminders.sql`

**Interfaces:**
- Produces: two columns on `clients` — `settlement_billing_day smallint` (nullable), `settlement_reminded_at date` (nullable) — and a CHECK constraint. Consumed by Tasks 3, 5, 7.

- [ ] **Step 1: Add columns + CHECK to the Drizzle schema**

In `src/db/schema.ts`, in the `clients` `pgTable` column block (after `vatMode`, before `isRetainer`), add:

```ts
    // Monthly settlement reminder: day-of-month (1-31) the freelancer settles
    // this client. NULL = reminders off. Effective day clamps to month length
    // (store 31 = "end of month"). See spec 2026-06-21-settlement-reminders.
    settlementBillingDay: integer("settlement_billing_day"),
    // Date the once-per-cycle push+email was last sent for this client (guards
    // against re-firing within the same cycle). NULL = never reminded.
    settlementRemindedAt: date("settlement_reminded_at"),
```

(`integer` and `date` are already imported in this file — confirm at the top; both are used by other tables. `smallint` is not used elsewhere, so use `integer` to match the file's conventions; the CHECK bounds the range.)

In the `clients` table's constraint array (the `(table) => [ ... ]` block), add:

```ts
    check(
      "clients_settlement_billing_day_check",
      sql`${table.settlementBillingDay} IS NULL OR (${table.settlementBillingDay} >= 1 AND ${table.settlementBillingDay} <= 31)`
    ),
```

- [ ] **Step 2: Write the SQL migration**

Create `drizzle/0032_settlement_reminders.sql`:

```sql
-- Phase B: settlement-date reminders.
ALTER TABLE clients ADD COLUMN IF NOT EXISTS settlement_billing_day integer;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS settlement_reminded_at date;

ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_settlement_billing_day_check;
ALTER TABLE clients ADD CONSTRAINT clients_settlement_billing_day_check
  CHECK (settlement_billing_day IS NULL OR (settlement_billing_day >= 1 AND settlement_billing_day <= 31));
```

- [ ] **Step 3: Apply to DEV and verify**

```bash
set -a; source .env.local; set +a
psql "$DATABASE_URL_ADMIN" -f drizzle/0032_settlement_reminders.sql
psql "$DATABASE_URL_ADMIN" -c "\d clients" | grep -E "settlement_billing_day|settlement_reminded_at|settlement_billing_day_check"
```

Expected: both columns + the CHECK constraint listed. If `DATABASE_URL_ADMIN` is absent/unreachable, report DONE_WITH_CONCERNS (the schema edit + migration file are the committed deliverable).

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/db/schema.ts drizzle/0032_settlement_reminders.sql
git commit -m "feat(settlements): schema + migration for per-client settlement billing day"
```

---

### Task 2: Settlement date logic — `lib/settlements.ts`

**Files:**
- Create: `lib/settlements.ts`
- Test: `tests/unit/settlements.test.ts`

**Interfaces:**
- Produces (consumed by Tasks 3 + 5):
  - `daysInMonth(year: number, month1to12: number): number`
  - `effectiveBillingDay(billingDay: number, year: number, month1to12: number): number` → `min(billingDay, daysInMonth)`
  - `hasReachedBillingDay(localDay: number, billingDay: number, year: number, month1to12: number): boolean` → `localDay >= effectiveBillingDay`
  - `isBillingDayToday(localDay: number, billingDay: number, year: number, month1to12: number): boolean` → `localDay === effectiveBillingDay`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/settlements.test.ts`:

```ts
/** Unit tests for lib/settlements.ts (settlement-day math). */
import {
  daysInMonth,
  effectiveBillingDay,
  hasReachedBillingDay,
  isBillingDayToday,
} from "../../lib/settlements";

class TestRunner {
  private tests: Array<{ name: string; fn: () => void }> = [];
  private passed = 0; private failed = 0;
  test(name: string, fn: () => void) { this.tests.push({ name, fn }); }
  async run() {
    console.log("🧪 Running settlements tests...\n");
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

runner.test("daysInMonth: Feb 2026 = 28, Feb 2028 (leap) = 29", () => {
  assert(daysInMonth(2026, 2) === 28, "Feb 2026");
  assert(daysInMonth(2028, 2) === 29, "Feb 2028 leap");
  assert(daysInMonth(2026, 1) === 31, "Jan");
  assert(daysInMonth(2026, 4) === 30, "Apr");
});
runner.test("effectiveBillingDay clamps to month length", () => {
  assert(effectiveBillingDay(31, 2026, 2) === 28, "31 in Feb -> 28");
  assert(effectiveBillingDay(31, 2028, 2) === 29, "31 in leap Feb -> 29");
  assert(effectiveBillingDay(15, 2026, 6) === 15, "mid-month unchanged");
  assert(effectiveBillingDay(31, 2026, 1) === 31, "31 in Jan -> 31");
});
runner.test("hasReachedBillingDay: true on/after effective day", () => {
  assert(hasReachedBillingDay(1, 1, 2026, 6) === true, "day 1, billing 1");
  assert(hasReachedBillingDay(14, 15, 2026, 6) === false, "before billing day");
  assert(hasReachedBillingDay(28, 31, 2026, 2) === true, "Feb 28 reaches clamped 31");
});
runner.test("isBillingDayToday: exact effective-day match", () => {
  assert(isBillingDayToday(15, 15, 2026, 6) === true, "exact");
  assert(isBillingDayToday(16, 15, 2026, 6) === false, "day after");
  assert(isBillingDayToday(28, 31, 2026, 2) === true, "Feb 28 == clamped 31");
});

runner.run();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx tests/unit/settlements.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the minimal implementation**

Create `lib/settlements.ts`:

```ts
/**
 * Pure settlement-day math for the reminder feature. All functions take the
 * relevant calendar values (the caller supplies the user-LOCAL "today"), so
 * there is no hidden timezone dependency. "End of month" billing is expressed
 * as storing 31 and clamping to the month's length. See spec
 * 2026-06-21-settlement-reminders.
 */

/** Number of days in a given month (month is 1-12). */
export function daysInMonth(year: number, month1to12: number): number {
  // Day 0 of the next month = last day of this month.
  return new Date(year, month1to12, 0).getDate();
}

/** The billing day clamped to the month's length (so 31 => 28/29/30 as needed). */
export function effectiveBillingDay(billingDay: number, year: number, month1to12: number): number {
  return Math.min(billingDay, daysInMonth(year, month1to12));
}

/** True once the local day-of-month has reached (>=) the effective billing day. */
export function hasReachedBillingDay(
  localDay: number,
  billingDay: number,
  year: number,
  month1to12: number
): boolean {
  return localDay >= effectiveBillingDay(billingDay, year, month1to12);
}

/** True exactly on the effective billing day (used for the once-per-cycle fire). */
export function isBillingDayToday(
  localDay: number,
  billingDay: number,
  year: number,
  month1to12: number
): boolean {
  return localDay === effectiveBillingDay(billingDay, year, month1to12);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx tests/unit/settlements.test.ts`
Expected: PASS — `4 passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add lib/settlements.ts tests/unit/settlements.test.ts
git commit -m "feat(settlements): pure settlement-day math with tests"
```

---

### Task 3: Due endpoint — `GET /api/settlements/due`

**Files:**
- Create: `app/api/settlements/due/route.ts`
- Reference: `app/api/charge-documents/billable/route.ts` (unbilled-entry query shape), `app/api/charge-documents/[id]/pay/route.ts` (route shape), `lib/settlements.ts` (Task 2), `lib/currency.ts` (`formatCurrency`).

**Interfaces:**
- Consumes: `getUser` (`@/lib/auth`), `query` (`@/lib/db`), `hasReachedBillingDay` (Task 2), `formatCurrency` (`@/lib/currency`).
- Produces: `{ success: true, data: { clients: DueClient[] } }` where `DueClient = { clientId: string; clientName: string; currency: string; unbilledTotal: number; amountLabel: string; billingDay: number; daysOverdue: number }`. Consumed by Task 6 (the dashboard card).

- [ ] **Step 1: Write the route**

Create `app/api/settlements/due/route.ts`:

```ts
import { createLogger } from "@/lib/logger";
const logger = createLogger("api:settlements:due");
import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { hasReachedBillingDay } from "@/lib/settlements";
import { formatCurrency } from "@/lib/currency";

/**
 * GET /api/settlements/due
 * The caller's clients that are due for settlement: a settlement_billing_day is
 * set, today (user-local) has reached the effective billing day, and unbilled
 * billable work exists. Used by the dashboard "settlements due" section.
 */
export async function GET(_request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ success: false, error_code: "UNAUTHORIZED", message: "לא מחובר" }, { status: 401 });
    }
    const { query } = await import("@/lib/db");

    // The user's local date (their stored timezone) — used for the billing-day
    // comparison so "today" matches the user, not the server.
    const profRes = await query<{ local_year: number; local_month: number; local_day: number; locale: string | null }>(
      `SELECT EXTRACT(YEAR  FROM (now() AT TIME ZONE COALESCE(timezone,'Asia/Jerusalem')))::int AS local_year,
              EXTRACT(MONTH FROM (now() AT TIME ZONE COALESCE(timezone,'Asia/Jerusalem')))::int AS local_month,
              EXTRACT(DAY   FROM (now() AT TIME ZONE COALESCE(timezone,'Asia/Jerusalem')))::int AS local_day,
              locale
         FROM user_profiles WHERE user_id = $1`,
      [user.id]
    );
    const today = profRes.rows[0] ?? { local_year: new Date().getUTCFullYear(), local_month: new Date().getUTCMonth() + 1, local_day: new Date().getUTCDate(), locale: "he" };
    const locale = today.locale === "en" ? "en" : "he";

    // Clients with a billing day + their unbilled billable total. Scoped by user.
    const rows = await query<{
      client_id: string; client_name: string; currency: string;
      settlement_billing_day: number; unbilled_total: number;
    }>(
      `SELECT c.id AS client_id, c.name AS client_name, COALESCE(c.currency,'ILS') AS currency,
              c.settlement_billing_day,
              COALESCE(SUM(
                CASE WHEN te.billing_kind = 'item'
                     THEN COALESCE(te.quantity, 0) * COALESCE(te.rate, 0)
                     ELSE (te.duration / 60.0) * COALESCE(te.rate, 0)
                END
              ), 0) AS unbilled_total
         FROM clients c
         JOIN projects p ON p.client_id = c.id
         JOIN time_entries te ON te.project_id = p.id
        WHERE c.user_id = $1
          AND c.settlement_billing_day IS NOT NULL
          AND c.is_active = true
          AND te.charge_document_id IS NULL
          AND te.is_billable = true
        GROUP BY c.id, c.name, c.currency, c.settlement_billing_day`,
      [user.id]
    );
    // NOTE: time_entries has no `amount` column. This SUM is an APPROXIMATE
    // unbilled total (duration is in MINUTES → /60 = hours × rate; items =
    // quantity × rate). It equals the exact charge for the common case
    // (no billing-rounding configured); with rounding it slightly under-states.
    // The INNER JOIN guarantees each returned client has ≥1 unbilled billable
    // entry, so no HAVING is needed — the amount is display-only.

    const clients = rows.rows
      .filter((r) =>
        hasReachedBillingDay(today.local_day, r.settlement_billing_day, today.local_year, today.local_month)
      )
      .map((r) => ({
        clientId: r.client_id,
        clientName: r.client_name,
        currency: r.currency,
        unbilledTotal: r.unbilled_total,
        amountLabel: formatCurrency(r.unbilled_total, r.currency, locale),
        billingDay: r.settlement_billing_day,
        daysOverdue: Math.max(0, today.local_day - Math.min(r.settlement_billing_day, today.local_day)),
      }));

    return NextResponse.json({ success: true, data: { clients } });
  } catch (error) {
    logger.error("GET /api/settlements/due failed:", error);
    return NextResponse.json({ success: false, error_code: "SERVER_ERROR", message: "שגיאה בטעינת התחשבנויות" }, { status: 500 });
  }
}
```

> The `unbilled_total` is an approximate display figure (see the NOTE in the query). The "due" signal is the existence of unbilled billable entries (guaranteed by the INNER JOIN), not the amount. `daysOverdue` uses the local day vs the stored billing day; for an end-of-month-clamped client it may read 0 ("due today") on the clamped day — acceptable.

- [ ] **Step 2: Lint + build**

Run: `npm run lint && npm run build`
Expected: clean.

- [ ] **Step 3: Manual verification (dev)**

With `npm run dev`, logged in, from devtools console:

```js
await fetch('/api/settlements/due').then(r => r.json())
```

Expected: `{ success:true, data:{ clients:[...] } }` — only the caller's clients, only those with a billing day reached + unbilled work. Unauthenticated `curl` → 401:

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/settlements/due  # expect 401
```

Set a `settlement_billing_day` on a dev client with unbilled work (`psql "$DATABASE_URL_ADMIN" -c "UPDATE clients SET settlement_billing_day=1 WHERE id='<id>'"`) to see it appear. Authed happy-path correctness is otherwise deferred to live QA. Report DONE_WITH_CONCERNS noting the deferred authed check.

- [ ] **Step 4: Commit**

```bash
git add app/api/settlements/due/route.ts
git commit -m "feat(settlements): GET /api/settlements/due (user-scoped due-clients endpoint)"
```

---

### Task 4: Reminder email template — `lib/emails/settlement-reminder.ts`

**Files:**
- Create: `lib/emails/settlement-reminder.ts`
- Test: `tests/unit/settlement-reminder-email.test.ts`
- Reference: `lib/emails/charge-document.ts` (the Phase-A bilingual template + `esc` pattern), `lib/email.ts` (`emailLayout`/`emailButton`/`EmailLocale`).

**Interfaces:**
- Produces (consumed by Task 5):
  - `interface SettlementReminderClient { name: string; amountLabel: string }`
  - `settlementReminderEmail(locale: EmailLocale, p: { clients: SettlementReminderClient[]; dashboardUrl: string }): { subject: string; html: string }`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/settlement-reminder-email.test.ts`:

```ts
/** Unit tests for lib/emails/settlement-reminder.ts (bilingual digest). */
import { settlementReminderEmail } from "../../lib/emails/settlement-reminder";

class TestRunner {
  private tests: Array<{ name: string; fn: () => void }> = [];
  private passed = 0; private failed = 0;
  test(name: string, fn: () => void) { this.tests.push({ name, fn }); }
  async run() {
    console.log("🧪 Running settlement-reminder-email tests...\n");
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

const URL = "https://www.clock-bill.com/dashboard";
const clients = [{ name: "אלפא", amountLabel: "₪1,200.00" }, { name: "בטא", amountLabel: "₪800.00" }];

runner.test("he: RTL, lists both clients + count + dashboard link", () => {
  const { subject, html } = settlementReminderEmail("he", { clients, dashboardUrl: URL });
  assert(subject.length > 0, "subject empty");
  assert(html.includes('dir="rtl"'), "expected RTL");
  assert(html.includes("אלפא") && html.includes("בטא"), "both clients listed");
  assert(html.includes("₪1,200.00"), "amount shown");
  assert(html.includes(URL), "dashboard link");
});
runner.test("en: LTR + count of 2", () => {
  const { subject, html } = settlementReminderEmail("en", { clients: [{ name: "Alpha", amountLabel: "$100" }, { name: "Beta", amountLabel: "$50" }], dashboardUrl: URL });
  assert(html.includes('dir="ltr"'), "expected LTR");
  assert(subject.includes("2"), "count in subject");
  assert(html.includes("Alpha") && html.includes("Beta"), "clients listed");
});
runner.test("escapes client names", () => {
  const { html } = settlementReminderEmail("he", { clients: [{ name: "<b>x</b>", amountLabel: "₪1" }], dashboardUrl: URL });
  assert(!html.includes("<b>x</b>"), "name must be escaped");
  assert(html.includes("&lt;b&gt;"), "escaped form present");
});

runner.run();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx tests/unit/settlement-reminder-email.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the minimal implementation**

Create `lib/emails/settlement-reminder.ts`:

```ts
/**
 * Bilingual digest emailed to the freelancer on a client's settlement day:
 * "you have N settlements ready" + the client list + a dashboard CTA. Sent by
 * the notifications cron once per cycle. See spec 2026-06-21-settlement-reminders.
 */
import { emailLayout, emailButton, type EmailLocale } from "@/lib/email";

export interface SettlementReminderClient {
  name: string;
  amountLabel: string;
}

/** Escape user-controlled text before embedding in email HTML. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function listHtml(clients: SettlementReminderClient[]): string {
  const items = clients
    .map(
      (c) =>
        `<li style="margin:0 0 6px;font-size:15px;line-height:1.6;">${esc(c.name)} — <strong>${esc(c.amountLabel)}</strong></li>`
    )
    .join("");
  return `<ul style="padding-inline-start:20px;margin:0 0 16px;">${items}</ul>`;
}

export function settlementReminderEmail(
  locale: EmailLocale,
  p: { clients: SettlementReminderClient[]; dashboardUrl: string }
): { subject: string; html: string } {
  const n = p.clients.length;
  if (locale === "en") {
    return {
      subject: `You have ${n} settlement${n === 1 ? "" : "s"} ready`,
      html: emailLayout({
        locale: "en",
        heading: `${n} settlement${n === 1 ? "" : "s"} ready`,
        bodyHtml:
          `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;">These clients have reached their settlement day and have unbilled work:</p>` +
          listHtml(p.clients) +
          emailButton(p.dashboardUrl, "Open dashboard"),
      }),
    };
  }
  return {
    subject: `יש לך ${n} התחשבנויות לביצוע`,
    html: emailLayout({
      locale: "he",
      heading: `${n} התחשבנויות לביצוע`,
      bodyHtml:
        `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;">הלקוחות הבאים הגיעו למועד ההתחשבנות ויש להם עבודה לא מחויבת:</p>` +
        listHtml(p.clients) +
        emailButton(p.dashboardUrl, "פתח את הדאשבורד"),
    }),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx tests/unit/settlement-reminder-email.test.ts`
Expected: PASS — `3 passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add lib/emails/settlement-reminder.ts tests/unit/settlement-reminder-email.test.ts
git commit -m "feat(settlements): bilingual settlement-reminder email digest + tests"
```

---

### Task 5: Cron block — settlement reminders in `app/api/cron/notifications/route.ts`

**Files:**
- Modify: `app/api/cron/notifications/route.ts`
- Reference: `lib/settlements.ts` (Task 2), `lib/emails/settlement-reminder.ts` (Task 4), `lib/email.ts` (`sendEmail`), `lib/push.ts` (`sendPushToUser`, `isPushConfigured`), `lib/currency.ts` (`formatCurrency`).

**Interfaces:**
- Consumes: `isBillingDayToday` (Task 2), `settlementReminderEmail` (Task 4), the new `clients` columns (Task 1).
- Produces: nothing imported elsewhere (a cron side-effect block).

**Critical security invariant:** this block uses `adminQuery` (RLS-bypass). Group strictly by `user_id`; push → that user only; email → that user's own address; UPDATE `settlement_reminded_at` scoped `WHERE id = $ AND user_id = $`.

- [ ] **Step 1: Restructure the push-config gate so email still sends**

The route currently early-returns when push is unconfigured (`if (!isPushConfigured()) return ...skipped`). Settlement reminders also send **email**, which must work without push. Replace the early return with a flag and gate only the push-only blocks.

Find:

```ts
  if (!isPushConfigured()) {
    return NextResponse.json({ ok: true, skipped: "push not configured" });
  }

  let reminders = 0;
  let longTimers = 0;

  try {
```

Replace with:

```ts
  const pushOn = isPushConfigured();

  let reminders = 0;
  let longTimers = 0;
  let settlements = 0;

  try {
```

Then wrap the EXISTING block 1 (daily reminders) and block 2 (long timers) so they only run when `pushOn` — put `if (pushOn) { ... }` around the two existing `const reminderRows = ...`/`for (...)` and `const longRows = ...`/`for (...)` sections (they are push-only). Leave their bodies unchanged. Finally update the success response:

Find: `return NextResponse.json({ ok: true, reminders, longTimers });`
Replace: `return NextResponse.json({ ok: true, reminders, longTimers, settlements });`

- [ ] **Step 2: Add the settlement-reminder copy + imports**

At the top imports add:

```ts
import { sendEmail } from "@/lib/email";
import { settlementReminderEmail } from "@/lib/emails/settlement-reminder";
import { isBillingDayToday } from "@/lib/settlements";
import { formatCurrency } from "@/lib/currency";
```

Add a push-copy helper next to `dailyReminderCopy`:

```ts
function settlementCopy(locale: Loc, count: number) {
  return locale === "en"
    ? { title: "Settlements ready", body: `You have ${count} client${count === 1 ? "" : "s"} ready for settlement.` }
    : { title: "התחשבנויות לביצוע", body: `יש לך ${count} לקוחות מוכנים להתחשבנות.` };
}
```

Add a row type near the other interfaces:

```ts
interface SettlementRow extends Record<string, unknown> {
  client_id: string;
  user_id: string;
  client_name: string;
  currency: string;
  settlement_billing_day: number;
  unbilled_total: number;
  locale: string | null;
  user_email: string | null;
  local_year: number;
  local_month: number;
  local_day: number;
  local_minutes: number;
  anchor_minutes: number;
}
```

- [ ] **Step 3: Add the settlement block inside `try` (after the push-only blocks, before the return)**

```ts
    // ── 3. Settlement reminders — once per cycle, on each client's billing day ──
    // Cheap SQL filters (billing day set, active, has unbilled work, not yet
    // reminded this cycle) + per-row user-local calendar components; the exact
    // effective-day match is decided in JS via isBillingDayToday (handles
    // end-of-month clamping). Grouped strictly per user.
    const settlementRows = await adminQuery<SettlementRow>(
      `SELECT c.id AS client_id, c.user_id, c.name AS client_name,
              COALESCE(c.currency,'ILS') AS currency, c.settlement_billing_day,
              COALESCE(SUM(
                CASE WHEN te.billing_kind = 'item'
                     THEN COALESCE(te.quantity, 0) * COALESCE(te.rate, 0)
                     ELSE (te.duration / 60.0) * COALESCE(te.rate, 0)
                END
              ), 0) AS unbilled_total,
              p.locale, u.email AS user_email,
              EXTRACT(YEAR  FROM (now() AT TIME ZONE COALESCE(p.timezone,'Asia/Jerusalem')))::int AS local_year,
              EXTRACT(MONTH FROM (now() AT TIME ZONE COALESCE(p.timezone,'Asia/Jerusalem')))::int AS local_month,
              EXTRACT(DAY   FROM (now() AT TIME ZONE COALESCE(p.timezone,'Asia/Jerusalem')))::int AS local_day,
              (EXTRACT(HOUR   FROM (now() AT TIME ZONE COALESCE(p.timezone,'Asia/Jerusalem'))) * 60
             + EXTRACT(MINUTE FROM (now() AT TIME ZONE COALESCE(p.timezone,'Asia/Jerusalem'))))::int AS local_minutes,
              (split_part(COALESCE(p.daily_reminder_time,'09:00'), ':', 1)::int * 60
             + split_part(COALESCE(p.daily_reminder_time,'09:00'), ':', 2)::int) AS anchor_minutes
         FROM clients c
         JOIN projects p2 ON p2.client_id = c.id
         JOIN time_entries te ON te.project_id = p2.id
         JOIN user_profiles p ON p.user_id = c.user_id
         JOIN "user" u ON u.id = c.user_id
        WHERE c.settlement_billing_day IS NOT NULL
          AND c.is_active = true
          AND te.charge_document_id IS NULL
          AND te.is_billable = true
          AND (c.settlement_reminded_at IS NULL
               OR c.settlement_reminded_at < (now() AT TIME ZONE COALESCE(p.timezone,'Asia/Jerusalem'))::date)
        GROUP BY c.id, c.user_id, c.name, c.currency, c.settlement_billing_day, p.locale, u.email, p.timezone, p.daily_reminder_time`
    );
    // unbilled_total is the same APPROXIMATE figure as the due endpoint (no
    // amount column; duration is MINUTES). The INNER JOIN guarantees ≥1 unbilled
    // billable entry per row, so no HAVING is needed.

    // Keep only rows where today (user-local) is the effective billing day AND
    // we're past the user's morning anchor.
    const fireRows = settlementRows.rows.filter(
      (r) =>
        r.local_minutes >= r.anchor_minutes &&
        isBillingDayToday(r.local_day, r.settlement_billing_day, r.local_year, r.local_month)
    );

    // Group strictly by user (tenant isolation): one push + one email per user.
    const byUser = new Map<string, SettlementRow[]>();
    for (const r of fireRows) {
      const list = byUser.get(r.user_id) ?? [];
      list.push(r);
      byUser.set(r.user_id, list);
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.clock-bill.com";
    for (const [userId, clientsForUser] of byUser) {
      const loc = norm(clientsForUser[0].locale);
      const count = clientsForUser.length;

      // Email (always attempted; no-ops without RESEND_API_KEY).
      const to = clientsForUser[0].user_email;
      if (to) {
        const dashboardUrl = `${appUrl}${loc === "en" ? "/en" : ""}/dashboard`;
        const { subject, html } = settlementReminderEmail(loc, {
          clients: clientsForUser.map((r) => ({
            name: r.client_name,
            amountLabel: formatCurrency(r.unbilled_total, r.currency, loc),
          })),
          dashboardUrl,
        });
        await sendEmail({ to, subject, html });
      }

      // Push (best-effort, only when configured).
      if (pushOn) {
        const copy = settlementCopy(loc, count);
        await sendPushToUser(userId, { ...copy, url: "/dashboard", tag: "settlement-reminder", lang: loc });
      }

      // Mark each fired client reminded for this cycle (scoped by user_id).
      for (const r of clientsForUser) {
        await adminQuery(
          `UPDATE clients SET settlement_reminded_at = (now() AT TIME ZONE COALESCE((SELECT timezone FROM user_profiles WHERE user_id = $2),'Asia/Jerusalem'))::date,
                              updated_at = NOW()
            WHERE id = $1 AND user_id = $2`,
          [r.client_id, userId]
        );
      }
      settlements += 1;
    }
```

- [ ] **Step 4: Lint + build**

Run: `npm run lint && npm run build`
Expected: clean.

- [ ] **Step 5: Manual verification (dev)**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/cron/notifications   # expect 401 when CRON_SECRET set, else 200
```

Full firing depends on a client whose effective billing day == today (user-local), past the anchor, with unbilled work, not yet reminded — verify by reading the SQL/JS logic and (optionally) temporarily setting a dev client's `settlement_billing_day` to today's day-of-month and calling the cron with the proper auth header, confirming `settlements` increments and `settlement_reminded_at` is set. Report the authed/live firing as deferred to QA. DONE_WITH_CONCERNS is expected.

- [ ] **Step 6: Commit**

```bash
git add app/api/cron/notifications/route.ts
git commit -m "feat(settlements): cron block — once-per-cycle push+email digest, per-user grouped"
```

---

### Task 6: Dashboard section — "settlements due"

**Files:**
- Modify: `lib/dashboard-widgets.ts` (catalog entry + default visible section)
- Create: `components/settlements-due-card.tsx`
- Modify: `app/[locale]/dashboard/page.tsx` (render the section)
- Modify: `messages/he.json` + `messages/en.json` (Dashboard.settlementsDue.* keys)

**Interfaces:**
- Consumes: `GET /api/settlements/due` (Task 3) → `{ success, data: { clients: DueClient[] } }`.
- Produces: a new dashboard section id `settlementsDue`.

- [ ] **Step 1: Register the widget in the catalog**

In `lib/dashboard-widgets.ts`, add to the `DASHBOARD_WIDGETS` array in the Sections group (after `recentEntries`):

```ts
  { id: "settlementsDue", labelKey: "settlementsDue.title", kind: "section" },
```

And add it to the default visible sections so never-customized users see it (in `DEFAULT_DASHBOARD_CONFIG`'s second argument):

```ts
export const DEFAULT_DASHBOARD_CONFIG: DashboardConfig = buildConfig(
  ["hoursToday", "hoursWeek", "hoursMonth", "revenueToday", "revenueMonth"],
  ["settlementsDue", "earningsChart", "projectHours", "recentEntries"]
);
```

(`normalizeDashboardConfig` will append `settlementsDue` hidden for existing users with a stored config — they enable it via the customizer.)

- [ ] **Step 2: Add i18n keys (both locales)**

Find the `Dashboard` namespace in `messages/he.json` (it contains `recentEntries.title`, `stats.*`, etc.). Add a `settlementsDue` block:

he.json (under `Dashboard`):
```json
"settlementsDue": {
  "title": "התחשבנויות לביצוע",
  "empty": "אין התחשבנויות לביצוע 🎉",
  "amountDue": "לחיוב",
  "overdueDays": "{days} ימים מאז מועד החיוב",
  "dueToday": "מועד החיוב היום",
  "createDocument": "צור התחשבנות",
  "error": "שגיאה בטעינת ההתחשבנויות"
}
```
en.json (under `Dashboard`):
```json
"settlementsDue": {
  "title": "Settlements due",
  "empty": "No settlements due 🎉",
  "amountDue": "to bill",
  "overdueDays": "{days} days since billing date",
  "dueToday": "Billing day is today",
  "createDocument": "Create charge document",
  "error": "Failed to load settlements"
}
```

- [ ] **Step 3: Create the card component**

Create `components/settlements-due-card.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/src/i18n/navigation";

interface DueClient {
  clientId: string;
  clientName: string;
  currency: string;
  unbilledTotal: number;
  amountLabel: string;
  billingDay: number;
  daysOverdue: number;
}

type State = "loading" | "ready" | "error";

/**
 * Dashboard section listing clients whose settlement day has passed and that
 * have unbilled work. Renders null when there is nothing due (the dashboard
 * section wrapper skips null nodes), so it only appears when actionable.
 */
export function SettlementsDueCard() {
  const t = useTranslations("Dashboard");
  const [state, setState] = useState<State>("loading");
  const [clients, setClients] = useState<DueClient[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/settlements/due");
        const json = await res.json();
        if (!active) return;
        if (!res.ok || !json.success) { setState("error"); return; }
        setClients(json.data.clients as DueClient[]);
        setState("ready");
      } catch {
        if (active) setState("error");
      }
    })();
    return () => { active = false; };
  }, []);

  if (state === "loading") {
    return (
      <div className="bg-card border border-border/50 rounded-[var(--radius-card)] p-6">
        <div className="h-5 w-40 bg-muted rounded animate-pulse mb-4" />
        <div className="h-12 w-full bg-muted rounded animate-pulse" />
      </div>
    );
  }
  if (state === "error") {
    return (
      <div className="bg-card border border-border/50 rounded-[var(--radius-card)] p-6">
        <h3 className="font-display text-xl font-semibold text-foreground mb-2">{t("settlementsDue.title")}</h3>
        <p className="text-sm text-muted-foreground">{t("settlementsDue.error")}</p>
      </div>
    );
  }
  if (clients.length === 0) return null; // nothing due → no clutter

  return (
    <div className="bg-card border border-border/50 rounded-[var(--radius-card)] overflow-hidden">
      <h3 className="font-display text-xl font-semibold text-foreground px-6 pt-6 pb-2">{t("settlementsDue.title")}</h3>
      <ul className="divide-y divide-border">
        {clients.map((c) => (
          <li key={c.clientId} className="px-6 py-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{c.clientName}</p>
              <p className="text-xs text-muted-foreground">
                {c.daysOverdue > 0 ? t("settlementsDue.overdueDays", { days: c.daysOverdue }) : t("settlementsDue.dueToday")}
              </p>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <span className="font-mono text-sm font-medium tabular-nums text-foreground">{c.amountLabel}</span>
              <Link
                href={{ pathname: "/reports", query: { tab: "documents", clientId: c.clientId } }}
                className="text-sm font-medium text-primary hover:underline min-h-[44px] flex items-center"
              >
                {t("settlementsDue.createDocument")}
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

> Confirm the "create charge document" destination: check how the reports/documents tab opens the charge-doc creation flow for a client (see `app/[locale]/(auth)/reports/` — `DocumentsTab`/`BillableTab`). If it accepts a `clientId` query param, use it; otherwise link to `/reports` and let the user pick the client. Do not invent a route — match what exists.

- [ ] **Step 4: Render the section in the dashboard page**

In `app/[locale]/dashboard/page.tsx`: import the card near the other section imports (after line 11):

```ts
import { SettlementsDueCard } from "@/components/settlements-due-card";
```

Add a case to the `renderSection` switch (near `case "earningsChart":`):

```tsx
      case "settlementsDue":
        return <SettlementsDueCard />;
```

(The wrapper at the section map already does `if (!node) return null;`, so an empty card collapses cleanly.)

- [ ] **Step 5: Lint + build + i18n parity**

Run: `npm run lint && npm run build && npx tsx tests/unit/messages-parity.test.ts && npx tsx tests/unit/i18n-parity.test.ts`
Expected: all pass (keys exist in both locales with matching placeholders).

- [ ] **Step 6: Manual verification (dev)**

With a dev client that is due (Task 3 setup), load `/dashboard` and confirm the "התחשבנויות לביצוע" section lists it with amount + CTA; with nothing due, the section is absent (null). Visual/interaction polish deferred to live QA. DONE_WITH_CONCERNS expected.

- [ ] **Step 7: Commit**

```bash
git add lib/dashboard-widgets.ts components/settlements-due-card.tsx app/\[locale\]/dashboard/page.tsx messages/he.json messages/en.json
git commit -m "feat(settlements): dashboard 'settlements due' section"
```

---

### Task 7: Per-client config UI — settlement day in both client edit forms

**Files:**
- Modify: `app/api/clients/[id]/route.ts` (`updateClientSchema` + the scoped `UPDATE clients`)
- Modify: `app/[locale]/clients/[id]/page.tsx` (detail edit form) and `app/[locale]/clients/page.tsx` (list-modal edit form) — BOTH PUT this endpoint
- Modify: `messages/he.json` + `messages/en.json`
- Reference: `components/ui` `SimpleSelect` usage (see `components/client-rates-editor.tsx`), the existing `documentLanguage`/`vatMode` field wiring in both forms (mirror it exactly).

**Interfaces:**
- Consumes: the `settlement_billing_day` column (Task 1).
- Produces: nothing imported elsewhere.

**Critical:** the `UPDATE clients` uses direct assignment (not COALESCE) for `document_language`/`vat_mode`, so **omitting a field nulls it** — BOTH forms must always send `settlementBillingDay` in the PUT body (the same lesson as `documentLanguage`).

- [ ] **Step 1: Extend the server schema + UPDATE**

In `app/api/clients/[id]/route.ts`, add to `updateClientSchema` (after `vatMode`):

```ts
  settlementBillingDay: z.number().int().min(1).max(31).nullable().optional(),
```

Destructure it where the other fields are read from `parsed.data`, then extend the `UPDATE clients` statement. The current statement ends `... document_language = $14, vat_mode = $15 WHERE id = $16 AND user_id = $17`. Add `settlement_billing_day` as a new assignment and renumber the WHERE params:

```ts
        `UPDATE clients
         SET name = $1, contact_name = $2, email = $3, phone = $4, address = $5, default_rate = COALESCE($6, default_rate),
             currency = $7, is_retainer = $8, retainer_hours = $9, retainer_monthly_fee = $10, overage_rate = $11,
             notes = $12, billing_rounding = COALESCE($13, billing_rounding), document_language = $14, vat_mode = $15,
             settlement_billing_day = $16
         WHERE id = $17 AND user_id = $18
         RETURNING id, name, contact_name, email, phone, address, default_rate,
                   currency, billing_rounding, document_language, vat_mode, settlement_billing_day, is_retainer, retainer_hours, retainer_monthly_fee, overage_rate,
                   notes, is_active, created_at`,
        [
          name.trim(), contactName?.trim() || null, email?.trim() || null, phone?.trim() || null, address?.trim() || null,
          effectiveDefaultRate, currency || "ILS", isRetainer ?? false, retainerHours || null, retainerMonthlyFee || null,
          overageRate || null, notes?.trim() || null, billingRounding ?? null, documentLanguage ?? null, vatMode ?? null,
          settlementBillingDay ?? null,
          clientId, user.id,
        ]
```

Also add `settlementBillingDay` to the `GET` of this route if it returns a typed client object (so the edit forms can prefill) — confirm the GET selects `c.*` or add `settlement_billing_day` to its SELECT and the returned type. If the create route (`app/api/clients/route.ts`) inserts an explicit column list, leave `settlement_billing_day` to default NULL (no need to set it on create).

- [ ] **Step 2: Add i18n keys (both locales)**

Under the client-form namespace used by both forms (find it by grepping for the `documentLanguage` label key the forms already use, e.g. `grep -n "documentLanguage" app/[locale]/clients/[id]/page.tsx`). Add parallel keys, e.g.:

he.json:
```json
"settlementDay": "יום התחשבנות",
"settlementDayNone": "ללא תזכורת",
"settlementDayEndOfMonth": "סוף החודש",
"settlementDayHint": "תזכורת חודשית להפיק התחשבנות ללקוח"
```
en.json:
```json
"settlementDay": "Settlement day",
"settlementDayNone": "No reminder",
"settlementDayEndOfMonth": "End of month",
"settlementDayHint": "Monthly reminder to settle with this client"
```

(Place them in the SAME namespace the forms read; the parity test will fail if he/en differ.)

- [ ] **Step 3: Add the field to BOTH forms**

In each of `app/[locale]/clients/[id]/page.tsx` and `app/[locale]/clients/page.tsx`, mirror the existing `documentLanguage` SimpleSelect field exactly (state variable, prefill from the loaded client, include in the PUT body). Options: "ללא תזכורת" (value maps to `null`), 1–28 (numeric), and "סוף החודש" (value maps to `31`). Use `SimpleSelect` (as in `components/client-rates-editor.tsx`). Ensure the PUT body includes `settlementBillingDay: <number | null>` in BOTH forms (omitting it nulls the column).

Concretely, in each form's submit body object (where `documentLanguage` is sent), add:

```ts
settlementBillingDay, // number (1-31) or null
```

and add the control near the documentLanguage control:

```tsx
<div>
  <label className="block text-sm font-medium text-foreground mb-1">{t("settlementDay")}</label>
  <SimpleSelect
    value={settlementBillingDay === null ? "" : String(settlementBillingDay)}
    onChange={(v) => setSettlementBillingDay(v === "" ? null : Number(v))}
    options={[
      { value: "", label: t("settlementDayNone") },
      ...Array.from({ length: 28 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) })),
      { value: "31", label: t("settlementDayEndOfMonth") },
    ]}
  />
  <p className="text-xs text-muted-foreground mt-1">{t("settlementDayHint")}</p>
</div>
```

> Match the real `SimpleSelect` prop API (value/onChange/options) by checking `components/client-rates-editor.tsx`; adapt prop names if they differ. Initialize `settlementBillingDay` state from the loaded client's `settlement_billing_day` in both forms.

- [ ] **Step 4: Lint + build + i18n parity**

Run: `npm run lint && npm run build && npx tsx tests/unit/messages-parity.test.ts && npx tsx tests/unit/i18n-parity.test.ts`
Expected: all pass.

- [ ] **Step 5: Manual verification (dev)**

Edit a client in BOTH the detail page and the list modal: set a settlement day, save, reopen — the value persists; set "ללא תזכורת" → column null. Confirm editing one form doesn't wipe the value set via the other (both send the field). Deferred parts to live QA. DONE_WITH_CONCERNS acceptable.

- [ ] **Step 6: Commit**

```bash
git add app/api/clients/\[id\]/route.ts app/\[locale\]/clients/\[id\]/page.tsx app/\[locale\]/clients/page.tsx messages/he.json messages/en.json
git commit -m "feat(settlements): per-client settlement day field in both client edit forms"
```

---

### Task 8: Final gate + production migration

**Files:** none (verification + ops)

- [ ] **Step 1: Full suite + lint + build**

Run: `npm test && npm run lint && npm run build`
Expected: all unit suites pass (incl. `settlements`, `settlement-reminder-email`, parity); lint clean; build OK.

- [ ] **Step 2: Apply migration 0032 to PRODUCTION** (controller/user does this with the prod admin string in `.env.local.bak.prod-shared`)

```bash
psql "<PROD_ADMIN_URL>" -c "\d clients" | grep settlement_billing_day || psql "<PROD_ADMIN_URL>" -f drizzle/0032_settlement_reminders.sql
psql "<PROD_ADMIN_URL>" -c "\d clients" | grep -E "settlement_billing_day|settlement_reminded_at"
```

- [ ] **Step 3: Confirm prod env** — `RESEND_API_KEY`, `EMAIL_FROM`, `NEXT_PUBLIC_APP_URL`, VAPID push keys, and `CRON_SECRET` already set on Vercel prod (all pre-existing from Phase A / web-push).

- [ ] **Step 4: Finish the branch** — use `superpowers:finishing-a-development-branch`.

---

## Self-Review

**Spec coverage:**
- Data model (2 columns + CHECK, RLS-inherited) → Task 1. ✓
- Computed due logic → Task 2 (pure) + Task 3 (endpoint) + Task 5 (cron filter). ✓
- Due dashboard section (4 states, CTA) → Task 6. ✓
- Once-per-cycle push + email digest, per-user grouped → Task 5 (incl. the `isPushConfigured` restructure so email sends regardless). ✓
- Email template → Task 4. ✓
- Per-client config in BOTH forms + server validation + CHECK → Task 1 + Task 7. ✓
- Morning anchor = `daily_reminder_time`, timezone-aware → Task 3 + Task 5 SQL. ✓
- Security invariants (BOLA, cron per-user grouping, boundary validation, no new unauth surface) → constraints + Tasks 3/5/7. ✓

**Resolved during planning (was an open item):** `time_entries` has NO `amount` column and `duration` is in MINUTES (confirmed against `lib/charge-documents.ts:buildLineFromEntry`). Tasks 3 & 5 therefore compute an APPROXIMATE `unbilled_total` in SQL (`item → quantity×rate`, `hourly → (duration/60)×rate`), which equals the exact charge when no billing-rounding is configured (the default) and slightly under-states otherwise. The "due" signal is the INNER JOIN's existence of unbilled billable entries, not the amount, so no HAVING is needed. The displayed figure is an estimate; the exact amount is computed in the real charge-doc flow the CTA opens.

**Placeholder scan:** no TBD/TODO; every code step carries full code. The `>` notes ask for codebase confirmations (SimpleSelect prop API, the create-doc destination route, the `te.amount` derivation) rather than leaving logic unwritten.

**Type consistency:** `effectiveBillingDay`/`hasReachedBillingDay`/`isBillingDayToday` (Task 2) signatures match their use in Tasks 3 & 5; `settlementReminderEmail` / `SettlementReminderClient` (Task 4) match Task 5's call; `DueClient` shape (Task 3) matches the card's interface (Task 6); the new `settlementBillingDay` schema field name matches the column `settlement_billing_day` mapping (Task 1) and both forms (Task 7).
