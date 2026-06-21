# Send Charge Document to Client via Email — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a freelancer email a charge document to their client as a branded, no-login link page (with replies routed back to the freelancer), with one manual "Send to client" button.

**Architecture:** A new unguessable `public_token` on `charge_documents` backs a public page at `/[locale]/doc/[token]` that loads the document via the privileged `adminQuery()` (RLS-bypass, token-scoped) and re-uses the existing `PdfChargeDocument` renderer. A `POST .../send` route generates the token lazily, composes a bilingual email via the existing `sendEmail({…, replyTo})`/`emailLayout`, and records `last_sent_at` + an audit row. The freelancer triggers it from a "Send to client" button in `ChargeDocumentView`.

**Tech Stack:** Next.js 16 App Router, TypeScript (strict), Postgres (raw `pg` via `lib/db.ts`), Drizzle schema in `src/db/schema.ts`, Resend (`lib/email.ts`), next-intl, the custom `tsx` test runner (`tests/unit/*.test.ts`).

## Global Constraints

- All user-facing strings are Hebrew (and English where bilingual); JSDoc/console in English.
- API response shape: `{ success: boolean, ... }`; user-facing `message` in Hebrew; include `error_code`.
- Every authed DB query filters by `user.id`. `adminQuery()` bypasses RLS — use it ONLY for the token-scoped public read, never with unsanitised input as a tenant filter.
- No hardcoded design values in app UI — use the design tokens (`bg-card`, `text-foreground`, `border-border`, `rounded-[var(--radius)]`, etc.). PDF/print templates are the only light-theme exception.
- Schema changes go in `src/db/schema.ts` only (the `lib/db.ts` raw SQL is legacy). Apply migrations to DEV via psql/admin; PROD migration is a separate explicit step (per the project's Drizzle-meta-drift note — do NOT rely on `db:migrate`).
- Tests use the in-file `TestRunner` pattern (see `tests/unit/trial-emails.test.ts`); `npm test` runs all of `tests/unit/*.test.ts`.
- next-intl message keys must exist in BOTH `he` and `en` (the `i18n-parity` / `messages-parity` tests fail otherwise).
- Document language is a property of the CLIENT/document, resolved via `resolveDocumentLocale(setting, currency)` from `@/lib/document-language` — NOT the freelancer's UI locale.

---

### Task 1: Schema + migration — `public_token`, `last_sent_at`, `sent_to_email`

**Files:**
- Modify: `src/db/schema.ts` (the `chargeDocuments` table)
- Create: `drizzle/0031_charge_document_send.sql`

**Interfaces:**
- Produces: three new columns on `charge_documents` — `public_token text` (unique, nullable), `last_sent_at timestamp` (nullable), `sent_to_email text` (nullable). Consumed by Tasks 4, 5, 6.

- [ ] **Step 1: Add the columns to the Drizzle schema**

In `src/db/schema.ts`, inside the `chargeDocuments` `pgTable` column block (after `summaryMode`, before `issuedAt`), add:

```ts
    // Public share: unguessable token backing the no-login client view at
    // /[locale]/doc/[token]. NULL until the document is first sent; regenerated
    // to revoke an old link. See spec 2026-06-21-charge-document-email.
    publicToken: text("public_token"),
    // Last time this document was emailed to the client + the address used.
    lastSentAt: timestamp("last_sent_at"),
    sentToEmail: text("sent_to_email"),
```

Then, in the same table's index/constraint array (the `(table) => [ ... ]` block), add a unique index on the token:

```ts
    uniqueIndex("uq_charge_documents_public_token")
      .on(table.publicToken)
      .where(sql`${table.publicToken} IS NOT NULL`),
```

(`uniqueIndex` and `sql` are already imported in this file — confirm at the top; they are used by other tables.)

- [ ] **Step 2: Write the SQL migration**

Create `drizzle/0031_charge_document_send.sql`:

```sql
-- Phase A: send charge documents to clients via a branded link.
ALTER TABLE charge_documents ADD COLUMN IF NOT EXISTS public_token text;
ALTER TABLE charge_documents ADD COLUMN IF NOT EXISTS last_sent_at timestamp;
ALTER TABLE charge_documents ADD COLUMN IF NOT EXISTS sent_to_email text;

-- One token per document; partial unique so existing NULLs don't collide.
CREATE UNIQUE INDEX IF NOT EXISTS uq_charge_documents_public_token
  ON charge_documents (public_token)
  WHERE public_token IS NOT NULL;
```

- [ ] **Step 3: Apply to DEV and verify the columns exist**

Run (uses the admin connection string; the app role can't ALTER):

```bash
psql "$DATABASE_URL_ADMIN" -f drizzle/0031_charge_document_send.sql
psql "$DATABASE_URL_ADMIN" -c "\d charge_documents" | grep -E "public_token|last_sent_at|sent_to_email|uq_charge_documents_public_token"
```

Expected: the three columns and the unique index are listed.

- [ ] **Step 4: Verify the project still type-checks**

Run: `npm run lint`
Expected: no errors introduced by the schema edit.

- [ ] **Step 5: Commit**

```bash
git add src/db/schema.ts drizzle/0031_charge_document_send.sql
git commit -m "feat(charge-docs): schema + migration for public share token and send tracking"
```

---

### Task 2: Public token generator — `lib/public-token.ts`

**Files:**
- Create: `lib/public-token.ts`
- Test: `tests/unit/public-token.test.ts`

**Interfaces:**
- Produces: `generatePublicToken(): string` — a URL-safe random token (24 chars, base64url). Consumed by Task 4.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/public-token.test.ts`:

```ts
/** Unit tests for lib/public-token.ts */
import { generatePublicToken } from "../../lib/public-token";

class TestRunner {
  private tests: Array<{ name: string; fn: () => void }> = [];
  private passed = 0; private failed = 0;
  test(name: string, fn: () => void) { this.tests.push({ name, fn }); }
  async run() {
    console.log("🧪 Running public-token tests...\n");
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

runner.test("token is 24 url-safe chars", () => {
  const t = generatePublicToken();
  assert(/^[A-Za-z0-9_-]{24}$/.test(t), `unexpected token shape: ${t}`);
});
runner.test("tokens are unique across many calls", () => {
  const set = new Set<string>();
  for (let i = 0; i < 1000; i++) set.add(generatePublicToken());
  assert(set.size === 1000, `expected 1000 unique, got ${set.size}`);
});

runner.run();
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx tsx tests/unit/public-token.test.ts`
Expected: FAIL — `Cannot find module '../../lib/public-token'`.

- [ ] **Step 3: Write the minimal implementation**

Create `lib/public-token.ts`:

```ts
/**
 * Unguessable, URL-safe token for the public charge-document view.
 * 18 random bytes → 24 base64url chars (~143 bits of entropy). Treat the
 * resulting link as a bearer capability; regenerate to revoke.
 */
import { randomBytes } from "crypto";

export function generatePublicToken(): string {
  return randomBytes(18).toString("base64url");
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx tsx tests/unit/public-token.test.ts`
Expected: PASS — `2 passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add lib/public-token.ts tests/unit/public-token.test.ts
git commit -m "feat(charge-docs): add public-token generator with tests"
```

---

### Task 3: Email template + reply-to resolver — `lib/emails/charge-document.ts`

**Files:**
- Create: `lib/emails/charge-document.ts`
- Test: `tests/unit/charge-document-email.test.ts`

**Interfaces:**
- Consumes: `emailLayout`, `emailButton`, `EmailLocale` from `@/lib/email`.
- Produces (consumed by Task 4):
  - `chargeDocumentEmail(locale: EmailLocale, p: ChargeDocumentEmailParams): { subject: string; html: string }`
  - `resolveReplyTo(profileEmail: string | null | undefined, accountEmail: string): string`
  - `interface ChargeDocumentEmailParams { businessName: string; clientName: string; docNumber: number; amountLabel: string; url: string }`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/charge-document-email.test.ts`:

```ts
/** Unit tests for lib/emails/charge-document.ts (bilingual + reply-to). */
import { chargeDocumentEmail, resolveReplyTo } from "../../lib/emails/charge-document";

class TestRunner {
  private tests: Array<{ name: string; fn: () => void }> = [];
  private passed = 0; private failed = 0;
  test(name: string, fn: () => void) { this.tests.push({ name, fn }); }
  async run() {
    console.log("🧪 Running charge-document-email tests...\n");
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

const URL = "https://www.clock-bill.com/doc/abc123";
const P = { businessName: "סטודיו רן", clientName: "חברת אלפא", docNumber: 7, amountLabel: "₪1,170.00", url: URL };

runner.test("he: RTL, subject has doc number + business, body has amount + link", () => {
  const { subject, html } = chargeDocumentEmail("he", P);
  assert(subject.includes("7") && subject.includes("סטודיו רן"), "subject missing number/business");
  assert(html.includes('dir="rtl"'), "expected RTL");
  assert(html.includes("₪1,170.00"), "expected amount");
  assert(html.includes(URL), "expected CTA url");
});
runner.test("en: LTR, subject + amount + link", () => {
  const { subject, html } = chargeDocumentEmail("en", { ...P, businessName: "Ran Studio", clientName: "Alpha Ltd" });
  assert(subject.includes("7") && subject.includes("Ran Studio"), "subject missing number/business");
  assert(html.includes('dir="ltr"'), "expected LTR");
  assert(html.includes("₪1,170.00") && html.includes(URL), "expected amount + url");
});
runner.test("html-escapes interpolated names (no raw angle brackets)", () => {
  const { html } = chargeDocumentEmail("he", { ...P, clientName: "<script>x</script>" });
  assert(!html.includes("<script>x</script>"), "client name must be escaped");
  assert(html.includes("&lt;script&gt;"), "expected escaped form");
});
runner.test("resolveReplyTo prefers profile email, falls back to account", () => {
  assert(resolveReplyTo("biz@x.com", "acct@x.com") === "biz@x.com", "should use profile");
  assert(resolveReplyTo("  ", "acct@x.com") === "acct@x.com", "blank profile → account");
  assert(resolveReplyTo(null, "acct@x.com") === "acct@x.com", "null profile → account");
});

runner.run();
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx tsx tests/unit/charge-document-email.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the minimal implementation**

Create `lib/emails/charge-document.ts`:

```ts
/**
 * Bilingual email sent to a freelancer's client linking to the branded
 * charge-document view. Sent from the verified clock-bill.com sender; replies
 * are routed to the freelancer via reply-to (resolveReplyTo). See spec
 * 2026-06-21-charge-document-email.
 */
import { emailLayout, emailButton, type EmailLocale } from "@/lib/email";

export interface ChargeDocumentEmailParams {
  businessName: string;
  clientName: string;
  docNumber: number;
  /** Pre-formatted gross amount, e.g. "₪1,170.00" (built by the caller). */
  amountLabel: string;
  url: string;
}

/** Escape user-controlled text before embedding it in email HTML. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function chargeDocumentEmail(
  locale: EmailLocale,
  p: ChargeDocumentEmailParams
): { subject: string; html: string } {
  const business = esc(p.businessName);
  const client = esc(p.clientName);
  const amount = esc(p.amountLabel);

  if (locale === "en") {
    return {
      subject: `Statement #${p.docNumber} from ${p.businessName}`,
      html: emailLayout({
        locale: "en",
        heading: `Statement #${p.docNumber}`,
        bodyHtml:
          `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;">Hi ${client},</p>` +
          `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;">${business} has sent you a statement for ${amount}.</p>` +
          `<p style="margin:0 0 4px;font-size:15px;line-height:1.6;">You can view and print it here:</p>` +
          emailButton(p.url, "View statement") +
          `<p style="margin:12px 0 0;font-size:13px;color:#71717a;">Reply to this email to reach ${business} directly.</p>`,
      }),
    };
  }

  return {
    subject: `התחשבנות מס' ${p.docNumber} מאת ${p.businessName}`,
    html: emailLayout({
      locale: "he",
      heading: `התחשבנות מס' ${p.docNumber}`,
      bodyHtml:
        `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;">שלום ${client},</p>` +
        `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;">${business} שלח/ה לך התחשבנות על סך ${amount}.</p>` +
        `<p style="margin:0 0 4px;font-size:15px;line-height:1.6;">ניתן לצפות ולהדפיס כאן:</p>` +
        emailButton(p.url, "צפייה בהתחשבנות") +
        `<p style="margin:12px 0 0;font-size:13px;color:#71717a;">ניתן להשיב למייל זה כדי ליצור קשר ישירות עם ${business}.</p>`,
    }),
  };
}

/** Reply-to = the freelancer's business email, falling back to their account email. */
export function resolveReplyTo(
  profileEmail: string | null | undefined,
  accountEmail: string
): string {
  const p = profileEmail?.trim();
  return p && p.length > 0 ? p : accountEmail;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx tsx tests/unit/charge-document-email.test.ts`
Expected: PASS — `4 passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add lib/emails/charge-document.ts tests/unit/charge-document-email.test.ts
git commit -m "feat(charge-docs): bilingual send email template + reply-to resolver"
```

---

### Task 4: Send API route — `POST /api/charge-documents/[id]/send`

**Files:**
- Create: `app/api/charge-documents/[id]/send/route.ts`
- Reference (do not modify): `app/api/charge-documents/[id]/pay/route.ts` (route shape), `lib/email.ts`, `lib/emails/charge-document.ts`, `lib/public-token.ts`, `lib/currency.ts`, `lib/document-language.ts`.

**Interfaces:**
- Consumes: `generatePublicToken` (Task 2); `chargeDocumentEmail`, `resolveReplyTo` (Task 3); `public_token`/`last_sent_at`/`sent_to_email` columns (Task 1); `sendEmail` (`@/lib/email`); `formatCurrency` (`@/lib/currency`); `resolveDocumentLocale` (`@/lib/document-language`); `getUser` (`@/lib/auth`); `query`/`adminQuery` (`@/lib/db`).
- Produces: `{ success: true, sentTo: string, sentAt: string, token: string }` on success; consumed by Task 6.

- [ ] **Step 1: Write the route**

Create `app/api/charge-documents/[id]/send/route.ts`:

```ts
import { createLogger } from "@/lib/logger";
const logger = createLogger("api:charge-documents:id:send");
import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { chargeDocumentEmail, resolveReplyTo } from "@/lib/emails/charge-document";
import { generatePublicToken } from "@/lib/public-token";
import { formatCurrency } from "@/lib/currency";
import { resolveDocumentLocale } from "@/lib/document-language";

type Ctx = { params: Promise<{ id: string }> };

/** POST — email this charge document to its client as a branded link. */
export async function POST(_request: NextRequest, ctx: Ctx) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ success: false, error_code: "UNAUTHORIZED", message: "לא מחובר" }, { status: 401 });
    }
    const { id } = await ctx.params;
    const { query } = await import("@/lib/db");

    // Load the document + client email + the document/client language settings.
    const docRes = await query(
      `SELECT d.id, d.doc_number, d.status, d.currency, d.total, d.vat_rate_snapshot,
              d.public_token, d.document_language,
              c.name AS client_name, c.email AS client_email, c.document_language AS client_doc_language
         FROM charge_documents d
         JOIN clients c ON d.client_id = c.id
        WHERE d.id = $1 AND d.user_id = $2`,
      [id, user.id]
    );
    if (docRes.rowCount === 0) {
      return NextResponse.json({ success: false, error_code: "DOCUMENT_NOT_FOUND", message: "תעודה לא נמצאה" }, { status: 404 });
    }
    const doc = docRes.rows[0] as {
      id: string; doc_number: number; status: string; currency: string; total: number | null;
      vat_rate_snapshot: number | null; public_token: string | null; document_language: string | null;
      client_name: string; client_email: string | null; client_doc_language: string | null;
    };

    if (doc.status === "canceled") {
      return NextResponse.json({ success: false, error_code: "SEND_REQUIRES_ACTIVE", message: "לא ניתן לשלוח מסמך מבוטל" }, { status: 409 });
    }
    const to = doc.client_email?.trim();
    if (!to) {
      return NextResponse.json({ success: false, error_code: "CLIENT_HAS_NO_EMAIL", message: "ללקוח אין כתובת מייל — הוסף כתובת בפרטי הלקוח" }, { status: 422 });
    }

    // Freelancer's business profile (reply-to source + business name).
    const profRes = await query(
      `SELECT business_name, email FROM user_profiles WHERE user_id = $1`,
      [user.id]
    );
    const businessName: string = profRes.rows[0]?.business_name || user.email;
    const replyTo = resolveReplyTo(profRes.rows[0]?.email, user.email);

    // Resolve the document's language (snapshot → else client setting → else by currency).
    const docLocale = resolveDocumentLocale(
      (doc.document_language as "he" | "en" | null) ?? (doc.client_doc_language as "he" | "en" | null),
      doc.currency
    );

    // Gross amount the client owes (net + VAT). `total` is the NET subtotal.
    const net = doc.total ?? 0;
    const gross = doc.vat_rate_snapshot ? net * (1 + doc.vat_rate_snapshot / 100) : net;
    const amountLabel = formatCurrency(gross, doc.currency, docLocale);

    // Lazily mint the public token.
    const token = doc.public_token ?? generatePublicToken();
    if (!doc.public_token) {
      await query(`UPDATE charge_documents SET public_token = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3`, [token, id, user.id]);
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.clock-bill.com";
    const localePrefix = docLocale === "en" ? "/en" : "";
    const url = `${appUrl}${localePrefix}/doc/${token}`;

    const { subject, html } = chargeDocumentEmail(docLocale, {
      businessName,
      clientName: doc.client_name,
      docNumber: doc.doc_number,
      amountLabel,
      url,
    });

    const ok = await sendEmail({ to, subject, html, replyTo });
    if (!ok) {
      return NextResponse.json({ success: false, error_code: "EMAIL_SEND_FAILED", message: "שליחת המייל נכשלה — נסה שוב" }, { status: 502 });
    }

    const sentAt = new Date().toISOString();
    await query(`UPDATE charge_documents SET last_sent_at = NOW(), sent_to_email = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3`, [to, id, user.id]);

    // Append-only audit row (privileged path — the tenant role cannot write audit_events).
    const { adminQuery } = await import("@/lib/db");
    await adminQuery(
      `INSERT INTO audit_events (id, actor_id, action, target_type, target_id, metadata)
       VALUES (gen_random_uuid()::text, $1, 'charge_document.sent', 'charge_document', $2, $3)`,
      [user.id, id, JSON.stringify({ to, docNumber: doc.doc_number })]
    );

    return NextResponse.json({ success: true, sentTo: to, sentAt, token });
  } catch (error) {
    logger.error("POST send failed:", error);
    return NextResponse.json({ success: false, error_code: "SERVER_ERROR", message: "שגיאה בשליחת המסמך" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Type-check + lint**

Run: `npm run lint`
Expected: no errors. (If `formatCurrency` / `resolveDocumentLocale` imports resolve and types match, the route compiles.)

- [ ] **Step 3: Manual verification in dev**

The repo has no API integration harness, so verify against the dev server (DB on the Neon dev branch, `RESEND_API_KEY` may be absent → `sendEmail` returns false and logs the link; that is the expected "not configured" path).

```bash
npm run dev
```

Then, logged in as a user that owns a pending charge document with a client that HAS an email, from the browser devtools console on the app:

```js
await fetch(`/api/charge-documents/<DOC_ID>/send`, { method: "POST" }).then(r => r.json())
```

Expected, in order:
- With a client that has no email → `{ success:false, error_code:"CLIENT_HAS_NO_EMAIL" }` (422).
- With a canceled doc → `{ success:false, error_code:"SEND_REQUIRES_ACTIVE" }` (409).
- Happy path → `{ success:true, sentTo, sentAt, token }`; the server log shows either a Resend send or "RESEND_API_KEY missing — skipping email".
- Verify persistence:

```bash
psql "$DATABASE_URL_ADMIN" -c "SELECT public_token, last_sent_at, sent_to_email FROM charge_documents WHERE id='<DOC_ID>';"
psql "$DATABASE_URL_ADMIN" -c "SELECT action,target_id,metadata FROM audit_events WHERE target_id='<DOC_ID>' ORDER BY created_at DESC LIMIT 1;"
```

Expected: token + last_sent_at + sent_to_email populated; one `charge_document.sent` audit row.

- [ ] **Step 4: Commit**

```bash
git add app/api/charge-documents/\[id\]/send/route.ts
git commit -m "feat(charge-docs): POST send route — emails branded link, records send + audit"
```

---

### Task 5: Public view page — `/[locale]/doc/[token]`

**Files:**
- Create: `app/[locale]/doc/[token]/page.tsx` (server component — token lookup + metadata)
- Create: `app/[locale]/doc/[token]/PublicChargeDocument.tsx` (client component — visible render + print)
- Reference: `app/[locale]/(auth)/reports/PdfChargeDocument.tsx` (types + renderer), `app/[locale]/(auth)/reports/printStyles.ts` (`templateRules`, `buildPrintStyles`, `printPdfContent`, `PdfTemplate`, `OnColorText`), `app/[locale]/(auth)/reports/ChargeDocumentView.tsx:373-389` (the exact `handleExportPdf` args), `app/[locale]/(auth)/reports/pdf-styles.css` (`.print-only` hides `#pdf-content` on screen).

**Interfaces:**
- Consumes: `public_token` column (Task 1); `adminQuery` (`@/lib/db`); the `PdfChargeDocumentProps` shape (`{ doc, lines, profile }`) from `PdfChargeDocument.tsx`.
- Produces: a public page; no exports consumed elsewhere.

**Note on rendering:** `PdfChargeDocument` is normally hidden on screen (`.print-only`) and only shown when `printPdfContent` clones `#pdf-content` to `<body>` under injected print CSS. The public page must show it ON screen too. We do that by injecting an on-screen `<style>` built from the SAME `templateRules(...)` helper plus an un-hide + table-display block, and wiring the Print button to `printPdfContent(...)` (identical to `ChargeDocumentView.handleExportPdf`). Colors/template come from the owner's profile (`pdf_template`, `pdf_primary_color`, `pdf_accent_color`, `pdf_primary_text`), defaulting to the same values `ChargeDocumentView` uses (`#A8622D` / `#347B52` / `"light"`).

- [ ] **Step 1: Write the server component (token lookup + data shaping)**

Create `app/[locale]/doc/[token]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { adminQuery } from "@/lib/db";
import PublicChargeDocument from "./PublicChargeDocument";
import type {
  PdfChargeDocument as PdfDoc,
  PdfDocumentLine,
  PdfBusinessProfile,
} from "@/app/[locale]/(auth)/reports/PdfChargeDocument";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type Params = { params: Promise<{ locale: string; token: string }> };

interface LoadResult {
  doc: PdfDoc;
  lines: PdfDocumentLine[];
  profile: PdfBusinessProfile;
  template: string | null;
  primaryColor: string;
  accentColor: string;
  primaryText: "light" | "dark";
  locale: "he" | "en";
}

/** Token-scoped public read via the privileged connection (RLS bypass). */
async function loadByToken(token: string): Promise<LoadResult | null> {
  const docRes = await adminQuery(
    `SELECT d.doc_number, d.status, d.currency, d.total, d.notes, d.issued_at,
            d.vat_rate_snapshot, d.summary_mode, d.pdf_template, d.document_language,
            c.name AS client_name, c.document_language AS client_doc_language,
            d.user_id
       FROM charge_documents d
       JOIN clients c ON d.client_id = c.id
      WHERE d.public_token = $1`,
    [token]
  );
  if (docRes.rowCount === 0) return null;
  const d = docRes.rows[0] as Record<string, unknown>;
  if (d.status === "canceled") return null;

  const userId = d.user_id as string;
  const linesRes = await adminQuery(
    `SELECT id, source_type, time_entry_id, period_month, label, description, notes,
            item_ref, billing_kind, quantity, unit, rate, amount, project_name
       FROM charge_document_lines WHERE document_id =
       (SELECT id FROM charge_documents WHERE public_token = $1)
      ORDER BY created_at`,
    [token]
  );
  const profRes = await adminQuery(
    `SELECT business_name, logo_url, signature_url, tax_id, address, phone, email,
            website, show_website_on_doc, bank_name, bank_branch, bank_account_number,
            bank_swift, pdf_primary_color, pdf_accent_color, pdf_primary_text
       FROM user_profiles WHERE user_id = $1`,
    [userId]
  );
  const p = (profRes.rows[0] ?? {}) as Record<string, unknown>;

  const doc: PdfDoc = {
    doc_number: d.doc_number as number,
    status: d.status as string,
    currency: d.currency as string,
    total: (d.total as number) ?? 0,
    notes: (d.notes as string | null) ?? null,
    issued_at: (d.issued_at ? new Date(d.issued_at as string).toISOString() : ""),
    client_name: d.client_name as string,
    vat_rate_snapshot: (d.vat_rate_snapshot as number | null) ?? null,
    summary_mode: (d.summary_mode as string | null) ?? null,
  };

  const profile: PdfBusinessProfile = {
    businessName: (p.business_name as string | null) ?? null,
    logoUrl: (p.logo_url as string | null) ?? null,
    signatureUrl: (p.signature_url as string | null) ?? null,
    taxId: (p.tax_id as string | null) ?? null,
    address: (p.address as string | null) ?? null,
    phone: (p.phone as string | null) ?? null,
    email: (p.email as string | null) ?? null,
    website: (p.website as string | null) ?? null,
    showWebsiteOnDoc: (p.show_website_on_doc as boolean | null) ?? null,
    bankName: (p.bank_name as string | null) ?? null,
    bankBranch: (p.bank_branch as string | null) ?? null,
    bankAccountNumber: (p.bank_account_number as string | null) ?? null,
    bankSwift: (p.bank_swift as string | null) ?? null,
  };

  const setting = (d.document_language as "he" | "en" | null) ?? (d.client_doc_language as "he" | "en" | null);
  const locale: "he" | "en" = setting ?? (doc.currency === "ILS" ? "he" : "en");

  return {
    doc,
    lines: linesRes.rows as unknown as PdfDocumentLine[],
    profile,
    template: (d.pdf_template as string | null) ?? null,
    primaryColor: (p.pdf_primary_color as string) || "#A8622D",
    accentColor: (p.pdf_accent_color as string) || "#347B52",
    primaryText: p.pdf_primary_text === "dark" ? "dark" : "light",
    locale,
  };
}

export default async function PublicDocPage({ params }: Params) {
  const { token } = await params;
  const data = await loadByToken(token);
  if (!data) notFound();

  return <PublicChargeDocument {...data} />;
}
```

- [ ] **Step 2: Write the client component (visible render + print)**

Create `app/[locale]/doc/[token]/PublicChargeDocument.tsx`:

```tsx
"use client";

import { NextIntlClientProvider, useMessages } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  PdfChargeDocument,
  type PdfChargeDocument as PdfDoc,
  type PdfDocumentLine,
  type PdfBusinessProfile,
} from "@/app/[locale]/(auth)/reports/PdfChargeDocument";
import {
  templateRules,
  printPdfContent,
  type PdfTemplate,
  type OnColorText,
} from "@/app/[locale]/(auth)/reports/printStyles";
import "@/app/[locale]/(auth)/reports/pdf-styles.css";
import "@/app/[locale]/(auth)/reports/pdf-templates.css";

const VALID_TEMPLATES = ["classic", "modern", "minimal", "elegant", "compact", "bold"] as const;
function asTemplate(v: string | null): PdfTemplate {
  return (VALID_TEMPLATES as readonly string[]).includes(v ?? "")
    ? (v as PdfTemplate)
    : "classic";
}

interface Props {
  doc: PdfDoc;
  lines: PdfDocumentLine[];
  profile: PdfBusinessProfile;
  template: string | null;
  primaryColor: string;
  accentColor: string;
  primaryText: "light" | "dark";
  locale: "he" | "en";
}

export default function PublicChargeDocument(props: Props) {
  const { doc, lines, profile, primaryColor, accentColor, locale } = props;
  const messages = useMessages();
  const template = asTemplate(props.template);
  const primaryText: OnColorText = props.primaryText;
  const dir = locale === "he" ? "rtl" : "ltr";

  // On-screen styling: un-hide #pdf-content, restore table display, apply the
  // SAME template color rules the print routine uses. Print itself reuses
  // printPdfContent (identical to ChargeDocumentView.handleExportPdf).
  const screenCss = `
    #pdf-content.print-only { display: block !important; }
    #pdf-content table { display: table !important; }
    #pdf-content thead { display: table-header-group !important; }
    #pdf-content tbody { display: table-row-group !important; }
    #pdf-content tr { display: table-row !important; }
    #pdf-content th, #pdf-content td { display: table-cell !important; }
    ${templateRules(template, primaryColor, accentColor, "#pdf-content", primaryText)}
  `;

  function handlePrint() {
    const filename = `statement_${doc.doc_number}_${doc.client_name}`.replace(/[/\s]+/g, "_").trim();
    printPdfContent(template, primaryColor, accentColor, filename, dir, primaryText);
  }

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <style dangerouslySetInnerHTML={{ __html: screenCss }} />
      <div dir={dir} style={{ minHeight: "100vh", background: "#f4f4f5", padding: "24px 12px" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            <Button onClick={handlePrint} className="min-h-[44px]">
              {locale === "he" ? "הדפס / שמור כ-PDF" : "Print / Save as PDF"}
            </Button>
          </div>
          <div style={{ background: "white", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
            <PdfChargeDocument doc={doc} lines={lines} profile={profile} />
          </div>
          <p style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: "#71717a" }}>
            {locale === "he" ? "הופק ב-" : "Generated with "}
            <a href="https://www.clock-bill.com" style={{ color: "#0a0a0a", fontWeight: 600 }}>ClockBill</a>
          </p>
        </div>
      </div>
    </NextIntlClientProvider>
  );
}
```

> Implementation note: confirm the literal template ids against `PDF_TEMPLATES` in `printStyles.ts` (line 31) and update `VALID_TEMPLATES` to match exactly. If, on visual check, `#pdf-content` renders structurally but without the banner colors, the `templateRules(...)` selector or the un-hide block needs adjusting — iterate here; this is the one task that needs a visual pass.

- [ ] **Step 3: Type-check + lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 4: Manual visual verification**

With `npm run dev` running and a sent document's token (from Task 4's verification), open:
- `http://localhost:3000/doc/<TOKEN>` (Hebrew) and `http://localhost:3000/en/doc/<TOKEN>` (English).

Expected:
- The document renders **visibly** with the freelancer's logo/colors, line items, total, VAT (if any), notes, bank details.
- "הדפס / שמור כ-PDF" opens the browser print dialog showing the same document.
- A canceled doc's token and any unknown token → the app's 404 page.
- View source / network: the page is `noindex` and never exposes `user_id` or other documents.

- [ ] **Step 5: Commit**

```bash
git add app/\[locale\]/doc/
git commit -m "feat(charge-docs): public branded view page at /doc/[token] (noindex, token-scoped)"
```

---

### Task 6: "Send to client" button + states in `ChargeDocumentView`

**Files:**
- Modify: `app/[locale]/(auth)/reports/ChargeDocumentView.tsx`
- Modify: the next-intl message catalogs for the `Reports` namespace (both `he` and `en`).

**Interfaces:**
- Consumes: `POST /api/charge-documents/[id]/send` (Task 4) returning `{ success, sentTo, sentAt, token, error_code?, message? }`; the `doc.last_sent_at` / `doc.sent_to_email` fields now returned by the existing `GET /api/charge-documents/[id]` (it does `SELECT d.*`, so the new columns are already included).

- [ ] **Step 1: Add the message keys (both locales)**

Find the catalog files that hold the `Reports.doc.*` keys:

```bash
grep -rl "pdfPromptConfirm" messages/ src/ app/ 2>/dev/null
```

In the Hebrew catalog, under `Reports.doc`, add:

```json
"sendToClient": "שלח ללקוח",
"sendConfirmTitle": "שליחת התחשבנות ללקוח",
"sendConfirmBody": "המסמך יישלח אל {email}. תשובות הלקוח יגיעו אליך.",
"sendConfirmAction": "שלח",
"sentStatus": "נשלח ב-{date} אל {email}",
"resend": "שלח שוב",
"sendNoEmail": "ללקוח אין כתובת מייל. הוסף כתובת בפרטי הלקוח כדי לשלוח.",
"sendError": "שליחת המסמך נכשלה. נסה שוב.",
"sendSuccess": "המסמך נשלח ללקוח"
```

In the English catalog, under `Reports.doc`, add the parallel keys:

```json
"sendToClient": "Send to client",
"sendConfirmTitle": "Send statement to client",
"sendConfirmBody": "The document will be sent to {email}. The client's replies will reach you.",
"sendConfirmAction": "Send",
"sentStatus": "Sent on {date} to {email}",
"resend": "Send again",
"sendNoEmail": "This client has no email address. Add one in the client details to send.",
"sendError": "Sending the document failed. Please try again.",
"sendSuccess": "The document was sent to the client"
```

- [ ] **Step 2: Add send state + handler in `ChargeDocumentView`**

Near the other `useState` hooks (around `ChargeDocumentView.tsx:173`, where `actionBusy` is declared), add:

```ts
  const [sending, setSending] = useState(false);
  const [sendConfirmOpen, setSendConfirmOpen] = useState(false);
```

Add the handler near the other action handlers (e.g. after the pay/cancel `runAction` around line 318). It re-fetches on success so `last_sent_at`/`sent_to_email` refresh:

```ts
  const handleSend = useCallback(async () => {
    setSending(true);
    try {
      const res = await fetch(`/api/charge-documents/${documentId}/send`, { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        if (json.error_code === "CLIENT_HAS_NO_EMAIL") {
          toast.error(t("doc.sendNoEmail"));
        } else {
          toast.error(json.message || t("doc.sendError"));
        }
        return;
      }
      toast.success(t("doc.sendSuccess"));
      setSendConfirmOpen(false);
      refetch();
    } catch {
      toast.error(t("doc.sendError"));
    } finally {
      setSending(false);
    }
  }, [documentId, t, refetch]);
```

> Use the toast util already imported in this file (match the existing `toast.*` calls — search the file for `toast`). If the file doesn't already import a toast, use the same notification mechanism the pay/cancel handlers use for success/error feedback.

- [ ] **Step 3: Render the button + sent-status + confirm dialog**

In the document header action area (near the existing pay/cancel buttons; the status badge is rendered around line 449 and `onClose` button around line 474 — place the Send button alongside the other actions), add, shown only when not canceled:

```tsx
  {!isCanceled && (
    <Button
      variant="outline"
      className="min-h-[44px]"
      disabled={sending}
      onClick={() => setSendConfirmOpen(true)}
    >
      {sending ? "…" : doc.last_sent_at ? t("doc.resend") : t("doc.sendToClient")}
    </Button>
  )}
```

Below the header (near the notes/summary area), show the persistent sent status when present:

```tsx
  {doc.last_sent_at && (
    <p className="text-xs text-muted-foreground">
      {t("doc.sentStatus", {
        date: new Date(doc.last_sent_at).toLocaleDateString(locale === "he" ? "he-IL" : "en-US"),
        email: doc.sent_to_email ?? "",
      })}
    </p>
  )}
```

Add the confirm dialog (reuse the existing `Dialog` component already imported for the PDF prompt around line 894):

```tsx
  <Dialog open={sendConfirmOpen} onOpenChange={setSendConfirmOpen}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{t("doc.sendConfirmTitle")}</DialogTitle>
      </DialogHeader>
      <p className="text-sm text-foreground">
        {t("doc.sendConfirmBody", { email: doc.client_email ?? doc.sent_to_email ?? "" })}
      </p>
      <DialogFooter>
        <Button variant="ghost" className="min-h-[44px]" onClick={() => setSendConfirmOpen(false)}>
          {t("common.cancel")}
        </Button>
        <Button className="min-h-[44px]" disabled={sending} onClick={() => void handleSend()}>
          {sending ? "…" : t("doc.sendConfirmAction")}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
```

> The confirm body needs the client's email. If the loaded `doc` object doesn't already carry `client_email`, extend the `GET /api/charge-documents/[id]` SELECT to add `c.email AS client_email` (one column) and the `ChargeDocument` type in this file to include `client_email: string | null`. Mirror the existing `client_name` handling. (`common.cancel` is an existing shared key — confirm it resolves; otherwise reuse the cancel label used by the PDF-prompt dialog.)

- [ ] **Step 4: Type-check + lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 5: Verify i18n parity**

Run: `npx tsx tests/unit/messages-parity.test.ts && npx tsx tests/unit/i18n-parity.test.ts`
Expected: PASS (the new keys exist in both locales).

- [ ] **Step 6: Manual verification in dev**

With `npm run dev`, open a pending charge document whose client has an email:
- The "שלח ללקוח" button appears (and becomes "שלח שוב" after a send).
- Clicking opens the confirm dialog naming the recipient and "תשובות הלקוח יגיעו אליך".
- Confirming shows a spinner (`…`), then a success toast and a persistent "נשלח ב-… אל …" line.
- Open a document whose client has NO email → confirm/send surfaces the inline `sendNoEmail` guidance.
- A canceled document shows no Send button.

- [ ] **Step 7: Commit**

```bash
git add app/\[locale\]/\(auth\)/reports/ChargeDocumentView.tsx messages/ src/ app/ 2>/dev/null
git commit -m "feat(charge-docs): Send to client button with confirm + sent status + states"
```

---

### Task 7: Final gate + production migration

**Files:** none (verification + ops)

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: all `tests/unit/*.test.ts` pass (including the three new test files and the parity tests).

- [ ] **Step 2: Lint + production build**

Run: `npm run lint && npm run build`
Expected: clean lint, successful build.

- [ ] **Step 3: Apply the migration to PRODUCTION**

> Use the PROD admin connection string (in `.env.local.bak.prod-shared`, per the project memory). Confirm the columns don't already exist first.

```bash
psql "<PROD_ADMIN_URL>" -c "\d charge_documents" | grep -E "public_token" || \
psql "<PROD_ADMIN_URL>" -f drizzle/0031_charge_document_send.sql
psql "<PROD_ADMIN_URL>" -c "\d charge_documents" | grep -E "public_token|last_sent_at|sent_to_email"
```

Expected: the three columns + unique index present on prod.

- [ ] **Step 4: Confirm required prod env**

The branded email and link depend on prod env already set in earlier work — verify:
- `RESEND_API_KEY` + `EMAIL_FROM` (sending), `NEXT_PUBLIC_APP_URL` (link base). If `RESEND_API_KEY` is missing in prod, sending silently no-ops (link logged only) — set it before announcing.

- [ ] **Step 5: Finish the branch**

Use the `superpowers:finishing-a-development-branch` skill to open the PR / merge per the user's preference.

---

## Self-Review

**Spec coverage:**
- Data model (3 columns + audit) → Task 1 + Task 4 (audit insert). ✓
- Send action (authz, canceled→409, no-email→422, token mint, reply-to, doc-language email, send, record) → Task 4. ✓
- Public page (token-scoped `adminQuery`, reuse `PdfChargeDocument`, print, ClockBill footer, noindex, canceled→404) → Task 5. ✓
- UI (button, confirm dialog, 4 states, sent status) → Task 6. ✓
- Security (unguessable token, scoped read, no `user_id` leak, canceled not served, reply-to server-derived, noindex) → Tasks 4/5. ✓
- Rate-limiting: the spec lists "light rate-limiting" on the public route. **Deferred** — the public read is gated by a 143-bit unguessable token + `noindex`, and `enforceRateLimit` no-ops without Upstash (not configured). If Upstash is enabled later, wrap the `loadByToken` path with `enforceRateLimit({ name: "public-doc", identifier: ip, limit: 60, windowSec: 60 })`. Logged here so the omission is explicit, not silent.
- Testing: pure units (token, email, reply-to) are TDD'd; route/page/UI use manual dev verification — consistent with the repo, which has no API/integration harness. ✓
- Token revocation ("generate new link"): the schema + route support regeneration (route mints when `public_token` is null), but a UI "regenerate" control is **not** in v1 — the "Send again" button reuses the existing token. Revocation-by-regeneration is a one-line follow-up (null the token then send); noted as out-of-v1-scope rather than built.

**Placeholder scan:** No "TBD"/"implement later"; every code step carries full code. Two `>` implementation notes ask the engineer to confirm an existing value against the codebase (template id list; toast import) rather than leaving logic unwritten.

**Type consistency:** `chargeDocumentEmail`/`resolveReplyTo`/`ChargeDocumentEmailParams` (Task 3) match their use in Task 4; `generatePublicToken` (Task 2) matches Task 4; `PdfChargeDocumentProps` field names (snake_case doc/lines, camelCase profile) in Task 5 match `PdfChargeDocument.tsx`; `printPdfContent`/`templateRules` arg order matches `printStyles.ts` and `ChargeDocumentView.handleExportPdf`.
