# Trial Email Lifecycle — Implementation Plan (4 of 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** A daily cron sends the trial lifecycle emails (days 3, 7, 11, expiry, win-back) — bilingual, idempotent (never twice), skipping founding/paid users — driven off `user_profiles` trial columns. (Day-0 welcome already sent by the signup hook in Plan 1.)

**Architecture:** A `trial_emails_sent` table guarantees one send per (user, email_key). A pure `pickDueEmail(daysSinceStart, sentKeys)` chooses which milestone is due. The cron (`/api/cron/trial-lifecycle`) runs daily, selects trial users via `adminQuery` (bypasses RLS — no session), resolves each user's email + locale, sends the bilingual template, and records the send atomically (`INSERT ... ON CONFLICT DO NOTHING`, send only when a row was inserted).

**Tech Stack:** Vercel Cron, Next.js route handler (CRON_SECRET Bearer auth), `adminQuery` from `@/lib/db`, Resend via `@/lib/email`, custom tsx test runner.

Plan **4 of 4**. Depends on Plan 1 (trial columns, `lib/emails/trial.ts`, `emailLayout`/`emailButton`). Source spec: §7. After this plan: the whole feature gets a final review + deploy (prod migrations 0023/0024/0025 + E2E).

## Global Constraints

- **Bilingual:** every email has he + en (subject + body); recipient locale from `user_profiles.locale` (default `he`), normalized like `app/api/cron/notifications/route.ts` (`norm()`).
- **Idempotent:** a given (user_id, email_key) is sent at most once, ever — enforced by a UNIQUE constraint + insert-before-send.
- **Skip** founding users and users with an active paid subscription (only `subscription_tier='free'`/null + a trial window qualifies).
- **Cron auth:** `CRON_SECRET` Bearer check (return 401 on mismatch), matching `notifications`/`keep-alive`. Cross-tenant reads/writes via `adminQuery` only.
- `TRIAL_DAYS = 14` from `lib/plans.ts` — never inline.
- Migrations via `psql` + `DATABASE_URL_ADMIN` (`psql "$(grep -E '^DATABASE_URL_ADMIN=' .env.local | cut -d= -f2-)" -f <file>`), dev now / prod at deploy.
- TypeScript strict, no `any`; tests `npx tsx tests/unit/<file>.test.ts`.

---

### Task 1: `trial_emails_sent` table (migration 0025) + schema

**Files:**
- Modify: `src/db/schema.ts` (add table)
- Create: `drizzle/0025_trial_emails_sent.sql`

- [ ] **Step 1: Add the Drizzle table**

In `src/db/schema.ts`, add (near the other tables; follow the file's `pgTable` style and imports — `pgTable`, `text`, `timestamp`, `uniqueIndex` or `unique`):

```typescript
/** Idempotency log for trial lifecycle emails — one row per (user, email_key). */
export const trialEmailsSent = pgTable(
  "trial_emails_sent",
  {
    id: text("id").primaryKey().default(sql`gen_random_uuid()::text`),
    userId: text("user_id").notNull(),
    emailKey: text("email_key").notNull(),
    sentAt: timestamp("sent_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("trial_emails_sent_user_key").on(table.userId, table.emailKey)]
);
```

(If `uniqueIndex`/`sql` aren't imported in the file, add them to the drizzle-orm import. Match existing patterns for id defaults — other tables use `gen_random_uuid()::text`.)

- [ ] **Step 2: Migration SQL**

Create `drizzle/0025_trial_emails_sent.sql`:

```sql
-- Idempotency log for trial lifecycle emails.
CREATE TABLE IF NOT EXISTS trial_emails_sent (
  id         text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id    text NOT NULL,
  email_key  text NOT NULL,
  sent_at    timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS trial_emails_sent_user_key
  ON trial_emails_sent (user_id, email_key);
```

(No RLS policy needed — this table is only ever touched by the cron via `adminQuery`, never by user sessions.)

- [ ] **Step 3: Apply to dev + verify**

```bash
psql "$(grep -E '^DATABASE_URL_ADMIN=' .env.local | cut -d= -f2-)" -f drizzle/0025_trial_emails_sent.sql
psql "$(grep -E '^DATABASE_URL_ADMIN=' .env.local | cut -d= -f2-)" -c "\d trial_emails_sent"
```
Expected: table with the 4 columns + the unique index.

- [ ] **Step 4: Commit**

```bash
git add src/db/schema.ts drizzle/0025_trial_emails_sent.sql
git commit -m "feat(db): trial_emails_sent idempotency table (migration 0025)"
```

> Prod note: apply at deploy via psql. Not now.

---

### Task 2: Pure `pickDueEmail` milestone selector

**Files:**
- Create: `lib/trial-emails-schedule.ts`
- Test: `tests/unit/trial-schedule.test.ts`

**Interfaces:**
- Produces: `TRIAL_EMAIL_MILESTONES` (ordered), `type TrialEmailKey`, `pickDueEmail(daysSinceStart: number, sentKeys: ReadonlySet<string>): TrialEmailKey | null`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/trial-schedule.test.ts`:

```typescript
import { pickDueEmail } from "../../lib/trial-emails-schedule";

class TestRunner {
  private tests: Array<{ name: string; fn: () => void }> = [];
  private passed = 0; private failed = 0;
  test(name: string, fn: () => void) { this.tests.push({ name, fn }); }
  async run() {
    console.log("🧪 Running trial-schedule tests...\n");
    for (const { name, fn } of this.tests) {
      try { fn(); this.passed++; console.log(`  ✅ ${name}`); }
      catch (e) { this.failed++; console.error(`  ❌ ${name}`); if (e instanceof Error) console.error(`     ${e.message}`); }
    }
    console.log(`\n${this.passed} passed, ${this.failed} failed`);
    if (this.failed > 0) process.exit(1);
  }
}
function assertEqual<T>(a: T, b: T, m?: string) { if (a !== b) throw new Error(m ?? `Expected ${b}, got ${a}`); }
const runner = new TestRunner();
const none = new Set<string>();

runner.test("day 0-2: nothing due", () => assertEqual(pickDueEmail(2, none), null));
runner.test("day 3: d3 due", () => assertEqual(pickDueEmail(3, none), "trial_d3"));
runner.test("day 7: d7 due", () => assertEqual(pickDueEmail(7, none), "trial_d7"));
runner.test("day 11: d11 due", () => assertEqual(pickDueEmail(11, none), "trial_d11"));
runner.test("day 14: ended due", () => assertEqual(pickDueEmail(14, none), "trial_ended"));
runner.test("day 17: winback due", () => assertEqual(pickDueEmail(17, none), "trial_winback"));
runner.test("already-sent highest is skipped to next unsent reached", () => {
  // reached day 8, d3 already sent -> d7 due (highest reached, unsent)
  assertEqual(pickDueEmail(8, new Set(["trial_d3"])), "trial_d7");
});
runner.test("all reached already sent -> null", () => {
  assertEqual(pickDueEmail(7, new Set(["trial_d3", "trial_d7"])), null);
});
runner.test("missed days: highest reached unsent wins (no stale spam)", () => {
  // day 12, nothing sent -> d11 (highest reached), not d3
  assertEqual(pickDueEmail(12, none), "trial_d11");
});

runner.run();
```

- [ ] **Step 2: Run it (fails), then create `lib/trial-emails-schedule.ts`**

Run: `npx tsx tests/unit/trial-schedule.test.ts` → FAIL.

```typescript
/**
 * Trial email schedule (pure). One email per cron run per user: the highest
 * milestone the user has reached that hasn't been sent yet — so a missed cron
 * day never sends stale earlier content. Day-0 welcome is handled at signup,
 * not here.
 */
export type TrialEmailKey = "trial_d3" | "trial_d7" | "trial_d11" | "trial_ended" | "trial_winback";

/** Ordered ascending by the day offset (from trial start) at which each unlocks. */
export const TRIAL_EMAIL_MILESTONES: ReadonlyArray<{ key: TrialEmailKey; day: number }> = [
  { key: "trial_d3", day: 3 },
  { key: "trial_d7", day: 7 },
  { key: "trial_d11", day: 11 },
  { key: "trial_ended", day: 14 },
  { key: "trial_winback", day: 17 },
];

/** The single email due now: highest reached milestone not already sent, else null. */
export function pickDueEmail(daysSinceStart: number, sentKeys: ReadonlySet<string>): TrialEmailKey | null {
  for (let i = TRIAL_EMAIL_MILESTONES.length - 1; i >= 0; i--) {
    const m = TRIAL_EMAIL_MILESTONES[i];
    if (daysSinceStart >= m.day && !sentKeys.has(m.key)) return m.key;
  }
  return null;
}
```

Run again → PASS (9/9).

- [ ] **Step 3: Commit**

```bash
git add lib/trial-emails-schedule.ts tests/unit/trial-schedule.test.ts
git commit -m "feat(billing): pure trial-email milestone scheduler"
```

---

### Task 3: The 5 bilingual lifecycle email templates

**Files:**
- Modify: `lib/emails/trial.ts` (add 5 template fns)
- Test: `tests/unit/trial-emails.test.ts` (extend)

**Interfaces:**
- Produces: `trialDay3Email`, `trialDay7Email`, `trialDay11Email`, `trialEndedEmail`, `trialWinbackEmail` — each `(locale: EmailLocale, opts: { appUrl: string; daysLeft?: number; lockedCount?: number }) => { subject: string; html: string }`. Plus `trialEmailFor(key, locale, opts)` dispatcher mapping a `TrialEmailKey` to its template.

- [ ] **Step 1: Extend the test**

Add to `tests/unit/trial-emails.test.ts` (keep the existing welcome tests) cases asserting each new template returns a non-empty subject, the right `dir` per locale, and includes the CTA url; and that `trialEmailFor("trial_ended","he",{appUrl,lockedCount:4})` includes "4". Follow the existing test style in that file (read it first). Run `npx tsx tests/unit/trial-emails.test.ts` → fails (fns missing).

- [ ] **Step 2: Add the templates to `lib/emails/trial.ts`**

Each uses `emailLayout({ locale, heading, bodyHtml })` + `emailButton(url, label)`, with he + en branches. Content guide (write natural bilingual copy in this spirit; subjects concise):
- **trialDay3Email** (onboarding): "Have you added your clients?" — encourage adding clients/projects; CTA → `${appUrl}/clients`.
- **trialDay7Email** (mid-trial value): "You're halfway through your trial" — remind of unlimited value; CTA → `${appUrl}/dashboard`.
- **trialDay11Email** (loss aversion, uses `daysLeft`): "{daysLeft} days left in your Unlimited trial — here's what you'll keep"; CTA → `${appUrl}/pricing`.
- **trialEndedEmail** (conversion, uses `lockedCount`): "Your trial ended — {lockedCount} clients are locked"; reassure data is safe; CTA "Unlock everything" → `${appUrl}/pricing`.
- **trialWinbackEmail** (final): "Still want your clients back?" — last nudge; CTA → `${appUrl}/pricing`.

Then add the dispatcher:

```typescript
import type { TrialEmailKey } from "@/lib/trial-emails-schedule";

export function trialEmailFor(
  key: TrialEmailKey,
  locale: EmailLocale,
  opts: { appUrl: string; daysLeft?: number; lockedCount?: number }
): { subject: string; html: string } {
  switch (key) {
    case "trial_d3": return trialDay3Email(locale, opts);
    case "trial_d7": return trialDay7Email(locale, opts);
    case "trial_d11": return trialDay11Email(locale, opts);
    case "trial_ended": return trialEndedEmail(locale, opts);
    case "trial_winback": return trialWinbackEmail(locale, opts);
  }
}
```

- [ ] **Step 3: Run the test → PASS. Verify tsc + lint.**

Run: `npx tsx tests/unit/trial-emails.test.ts` then `npx tsc --noEmit && npm run lint` → green.

- [ ] **Step 4: Commit**

```bash
git add lib/emails/trial.ts tests/unit/trial-emails.test.ts
git commit -m "feat(billing): 5 bilingual trial lifecycle email templates + dispatcher"
```

---

### Task 4: The daily cron

**Files:**
- Create: `app/api/cron/trial-lifecycle/route.ts`
- Modify: `vercel.json` (add the cron)

**Interfaces:**
- Consumes: `pickDueEmail`/`TRIAL_EMAIL_MILESTONES` (`@/lib/trial-emails-schedule`), `trialEmailFor` (`@/lib/emails/trial`), `sendEmail` (`@/lib/email`), `adminQuery` (`@/lib/db`), `TRIAL_DAYS` (`@/lib/plans`).

- [ ] **Step 1: Create the cron route**

Create `app/api/cron/trial-lifecycle/route.ts`. Structure (mirror `app/api/cron/notifications/route.ts` for auth + runtime + adminQuery):

```typescript
import { NextRequest, NextResponse } from "next/server";
import { adminQuery } from "@/lib/db";
import { sendEmail, type EmailLocale } from "@/lib/email";
import { pickDueEmail } from "@/lib/trial-emails-schedule";
import { trialEmailFor } from "@/lib/emails/trial";
import { createLogger } from "@/lib/logger";

const logger = createLogger("cron:trial-lifecycle");
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;
const norm = (l: string | null): EmailLocale => (l === "en" ? "en" : "he");

interface TrialUserRow extends Record<string, unknown> {
  user_id: string;
  email: string | null;
  locale: string | null;
  trial_started_at: string;
  trial_ends_at: string;
  sent_keys: string[]; // aggregated already-sent keys
  active_client_count: number;
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) return NextResponse.json({ ok: false }, { status: 401 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.clock-bill.com";
  const now = Date.now();
  let sent = 0;

  // Candidates: non-founding, free/null tier, trial started, with a verified email.
  // Skip anyone with an active paid subscription. Aggregate already-sent keys + active client count.
  const rows = await adminQuery<TrialUserRow>(
    `SELECT up.user_id, u.email, up.locale, up.trial_started_at, up.trial_ends_at,
            COALESCE(array_agg(tes.email_key) FILTER (WHERE tes.email_key IS NOT NULL), '{}') AS sent_keys,
            (SELECT COUNT(*)::int FROM clients c WHERE c.user_id = up.user_id AND c.is_active = TRUE) AS active_client_count
       FROM user_profiles up
       JOIN "user" u ON u.id = up.user_id
       LEFT JOIN trial_emails_sent tes ON tes.user_id = up.user_id
      WHERE up.trial_started_at IS NOT NULL
        AND COALESCE(up.founding, FALSE) = FALSE
        AND COALESCE(up.subscription_tier, 'free') = 'free'
        AND u.email IS NOT NULL
      GROUP BY up.user_id, u.email, up.locale, up.trial_started_at, up.trial_ends_at`,
    []
  );

  for (const row of rows.rows) {
    const startedMs = new Date(row.trial_started_at).getTime();
    const daysSinceStart = Math.floor((now - startedMs) / DAY_MS);
    const due = pickDueEmail(daysSinceStart, new Set(row.sent_keys));
    if (!due || !row.email) continue;

    // Reserve the send atomically: only proceed if WE inserted the row (no prior send).
    const reserve = await adminQuery(
      `INSERT INTO trial_emails_sent (user_id, email_key) VALUES ($1, $2)
       ON CONFLICT (user_id, email_key) DO NOTHING`,
      [row.user_id, due]
    );
    if (reserve.rowCount === 0) continue; // already sent by a concurrent/earlier run

    const endsMs = new Date(row.trial_ends_at).getTime();
    const daysLeft = Math.max(0, Math.ceil((endsMs - now) / DAY_MS));
    const { subject, html } = trialEmailFor(due, norm(row.locale), {
      appUrl,
      daysLeft,
      lockedCount: Math.max(0, row.active_client_count - 1),
    });
    const ok = await sendEmail({ to: row.email, subject, html });
    if (ok) sent++;
    else logger.error("trial email send failed", { userId: row.user_id, key: due });
  }

  logger.info("trial-lifecycle run complete", { candidates: rows.rows.length, sent });
  return NextResponse.json({ ok: true, candidates: rows.rows.length, sent });
}
```

Note: the reserve-before-send means a transient Resend failure won't re-send later (the row is already inserted). That's the accepted tradeoff for guaranteed no-double-send; failures are logged for manual follow-up. (If at-least-once is later preferred, delete the row on send failure.)

- [ ] **Step 2: Register the cron in `vercel.json`**

Add to the `crons` array (daily at 09:00 UTC):

```json
{ "path": "/api/cron/trial-lifecycle", "schedule": "0 9 * * *" }
```

- [ ] **Step 3: Local smoke test (no auth set in dev)**

With dev running and at least one expired-trial test user (set `trial_started_at` to 15 days ago via psql), call the endpoint and confirm it returns `{ ok: true, ... }` and inserts a `trial_emails_sent` row (email itself no-ops without RESEND_API_KEY locally — that's fine):

```bash
curl -s localhost:3000/api/cron/trial-lifecycle | head
psql "$(grep -E '^DATABASE_URL_ADMIN=' .env.local | cut -d= -f2-)" -c "SELECT user_id, email_key FROM trial_emails_sent ORDER BY sent_at DESC LIMIT 5;"
```

(If interactive setup is impractical for the implementer, SKIP this and verify via `npx tsc --noEmit && npm run lint && npm test`; note the deferral. Controller covers it in E2E.)

- [ ] **Step 4: Verify + commit**

Run: `npx tsc --noEmit && npm run lint && npm test` → green.

```bash
git add app/api/cron/trial-lifecycle/route.ts vercel.json
git commit -m "feat(billing): daily trial-lifecycle email cron (idempotent, founding/paid-skip)"
```

---

## Self-Review
- Spec §7 coverage: `trial_emails_sent` table (T1); the 5 templates days 3/7/11/14/17 (T3); cron with idempotent send + founding/paid skip + locale resolution (T4); day-0 handled in Plan 1; schedule registered (T4). ✅
- Placeholder scan: none — full code for migration, scheduler, cron, dispatcher; template copy is specified per-email (implementer writes natural bilingual strings to the given spec).
- Type consistency: `TrialEmailKey`/`pickDueEmail`/`TRIAL_EMAIL_MILESTONES` (T2) consumed by templates dispatcher (T3) + cron (T4); `trialEmailFor` signature matches the cron call site; `EmailLocale` from `lib/email.ts`.

## Deferrals (no silent caps)
- Reserve-before-send = guaranteed at-most-once; a Resend failure is logged, not retried (no DLQ in v1 — spec's webhook-grade delivery is out of scope for transactional trial mail). Acceptable at launch volume; revisit if send-failure rate is non-trivial.
- One email per user per daily run (highest unsent reached milestone). A user who never opened the app still progresses through the sequence by calendar day.
