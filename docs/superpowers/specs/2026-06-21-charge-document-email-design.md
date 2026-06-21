# Spec — Send Charge Document to Client via Email (Phase A)

**Date:** 2026-06-21
**Branch:** `feat/charge-document-email`
**Status:** Approved design, ready for implementation plan

> Format note: this spec is markdown (not the project's usual HTML docs) because it is
> a git-committed process artifact consumed by the `writing-plans` skill, and the
> global HTML-docs rule carves out files that live in a PR diff.

## Background

ClockBill produces **charge documents** ("התחשבנות") — internal, non-official settlement
documents (NOT official tax invoices/receipts). Today a freelancer issues a charge
document and can view/print it via the browser, but there is **no way to send it to the
client**. Client feedback (Shirly) asked for exactly this: "send the client an email with
the settlement, automatically, from the invoices area."

This spec is **Phase A** of a 3-phase roadmap that came out of that feedback:

- **Phase A (this spec):** email the charge document to the client via a branded link.
- **Phase B (later):** settlement-date reminders (per-client monthly billing cycle → a
  "settlements due" dashboard surface + morning push/email, auto-clearing when a charge
  document is issued).
- **Phase C (later):** payment tracking ledger (paid/partial/outstanding) + discount
  documentation on charge documents.

Phases B and C get their own spec → plan → implementation cycle. This spec covers A only.

## Goals

1. Let a freelancer send a charge document to their client by email, with one click.
2. The client receives a **link to a branded view page** (not a PDF attachment), where they
   can read the document and print / save it as PDF themselves.
3. The email is sent from `noreply@clock-bill.com` (an authenticated domain → good
   deliverability) but **replies go to the freelancer** (`reply-to`).
4. The view page carries discreet **ClockBill branding** (the viral hook — the client sees
   ClockBill and may sign up).

## Non-goals (explicitly out of scope for Phase A)

- Online payment by the client.
- Any client-side actions on the page (comments, approve, dispute).
- PDF file as an email attachment (no server-side PDF generation — see Decisions).
- Automatic send on issue (Phase A is a manual button only).
- CC / multiple recipients.
- Official tax receipts/invoices (legally out of scope for ClockBill entirely).

## Key decisions (resolved during brainstorming)

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| 1 | Delivery method | **Branded link page**, not PDF attachment | Reuses existing render code; no server PDF infra; enables viral branding + future online-pay/receipts |
| 2 | Send trigger | **Manual "Send to client" button** | Control — review before sending; pending docs shouldn't auto-send |
| 3 | Public route | `/[locale]/doc/[token]` | Short, shareable; locale chosen from the document's snapshotted language |
| 4 | Token lifetime | **No expiry, revocable** ("generate new link" invalidates the old) | Clients revisit settlements over time; revocation covers leaks |
| 5 | Branding prominence | **Discreet footer** ("הופק ב-ClockBill" + link) | Viral but not pushy / not undermining the freelancer's brand |
| 6 | Reply-to source | `user_profiles.email`, fallback to the Better Auth account email | The freelancer wants client replies, not us |

## Architecture

### Data model — `charge_documents` (one migration, no backfill)

Add three columns:

- `public_token text` — unique, nullable. Generated lazily on first send. ~24 random bytes,
  base64url-encoded. Unguessable bearer capability.
- `last_sent_at timestamp` — null until first send; updated on every send.
- `sent_to_email text` — the address the last send went to (for the "sent to …" status).

Add an audit row to the existing append-only `audit_events` table on each send
(`action = 'charge_document.sent'`, `target_type = 'charge_document'`, `target_id = doc.id`,
metadata `{ to, docNumber }`).

### Send action — `POST /api/charge-documents/[id]/send`

Mirrors the existing `pay`/`unpay` route shape.

1. `getUser()`; 401 if not authenticated.
2. Load the document `WHERE id = $1 AND user_id = $2`; 404 if not found.
3. Reject if `status = 'canceled'` → 409 `SEND_REQUIRES_ACTIVE` ("לא ניתן לשלוח מסמך מבוטל").
   (Pending and paid are both sendable.)
4. Resolve recipient = `clients.email`. If null/empty → 422 `CLIENT_HAS_NO_EMAIL`
   ("ללקוח אין כתובת מייל") so the UI can guide the user to add one.
5. Resolve reply-to = `user_profiles.email` ?? Better Auth account email.
6. Generate `public_token` if absent (and persist it).
7. Build the email in the **document's language** (the snapshotted `documentLanguage`,
   resolved via the existing `lib/document-language.ts` when null) using a new
   `lib/emails/charge-document.ts` template (bilingual, built on `emailLayout` +
   `emailButton`). Subject e.g. `התחשבנות מס' {docNumber} מאת {businessName}`. Body:
   greeting (client contact/name), business name, amount + currency, CTA button → public
   link, a line clarifying the document is from `{businessName}` via ClockBill.
8. Send via the existing `sendEmail({ to, subject, html, replyTo })`.
9. On success: update `last_sent_at = NOW()`, `sent_to_email = recipient`; write the audit
   row; return `{ success: true, sentTo, sentAt }`.
10. On `sendEmail` failure: do **not** mark sent; return 502 `EMAIL_SEND_FAILED` with a
    readable Hebrew message.

The public link is `${NEXT_PUBLIC_APP_URL}/{localePrefix}/doc/{token}` where `localePrefix`
is empty for `he` and `en` for English (matching the existing next-intl routing).

### Public view page — `app/[locale]/doc/[token]/page.tsx`

Lives **outside** the `(auth)` group (like `login`, `contact`, `privacy`).

- Server-side load via `adminQuery()` **by `public_token` only** — returns exactly one
  document + its lines + the owner's business profile (businessName, logoUrl, pdf colors,
  bank details, signatureUrl) + the client name. Never selects or exposes `user_id` or any
  other document.
- If no row, or the document is `canceled` → render a friendly "המסמך אינו זמין" / "Document
  unavailable" page (HTTP 404).
- Otherwise render the document reusing the existing `PdfChargeDocument` rendering, with the
  freelancer's branding (logo/colors). Document language = the snapshot.
- A "הדפס / שמור כ-PDF" button using the existing browser print path.
- A discreet ClockBill footer with a link (viral hook).
- `robots: noindex, nofollow` so the page is never indexed.
- Light rate-limiting on the public route (defense against token brute-force / scraping).

### UI — charge document view (reports area)

- Add a **"שלח ללקוח"** button on the charge-document detail view.
- Clicking opens a confirm dialog showing the recipient address and a note that replies go
  to the freelancer ("השב יגיע אליך").
- After a successful send, show a persistent status line: "נשלח ב-{date} ל-{email}", and a
  secondary "שלח שוב" / "צור קישור חדש" (regenerate token) action.
- **Four states (per the UX-states rule):**
  - *Loading* — spinner on the button while the request is in flight; button disabled
    (prevents double-send).
  - *Success* — toast + the persistent "נשלח ב-…" status.
  - *Error* — `CLIENT_HAS_NO_EMAIL` → inline guidance to add the client's email (link to the
    client edit form, both client edit forms — there are two that PUT the same endpoint);
    other failures → readable Hebrew message + retry.
  - *Empty* — n/a (the button only exists on an existing document).

## Security

- `public_token` is an unguessable bearer capability; treat the link as sensitive.
- The public read is strictly scoped to a single document by token; the query never returns
  `user_id` or any sibling rows; no listing/enumeration endpoint exists.
- Canceled documents are not served publicly.
- `reply-to` is always derived server-side from the authenticated owner's profile — never
  from client input.
- The public page is `noindex` and lightly rate-limited.
- Token is revocable (regenerate invalidates the old link) to handle accidental leaks.

## Testing

- **Unit:** token generation (length/charset/uniqueness shape); email composition picks the
  document language correctly; reply-to resolution (profile email, then BA email fallback).
- **Integration:** `send` route authz (only owner), validation (no client email → 422,
  canceled → 409), happy path updates `last_sent_at`/`sent_to_email` and writes the audit
  row; the public lookup returns only the matching document and 404s for canceled/unknown
  tokens.

## Affected files (orientation, not exhaustive)

- `src/db/schema.ts` + a new `drizzle/00XX_*.sql` migration (3 columns on `charge_documents`).
- `app/api/charge-documents/[id]/send/route.ts` (new) — mirrors `.../pay/route.ts`.
- `lib/emails/charge-document.ts` (new) — bilingual template on `emailLayout`/`emailButton`.
- `app/[locale]/doc/[token]/page.tsx` (new) — public branded view.
- The charge-document detail UI under `app/[locale]/(auth)/reports/…` — add the send button
  + states.
- Reuse: `lib/email.ts` (`sendEmail` with `replyTo`), `lib/db.ts` (`adminQuery`),
  `lib/document-language.ts`, `PdfChargeDocument`.

## Migration / rollout

- Dev migration first; PROD migration applied via the privileged admin connection (per the
  project's Drizzle-meta-drift note — apply via psql/admin, not `db:migrate`).
- No backfill needed (all three columns default null).
