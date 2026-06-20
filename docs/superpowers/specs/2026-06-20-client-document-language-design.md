# Client document language ("שפת המסמך המופק לפי הלקוח") — Design

**Date:** 2026-06-20
**Status:** Approved (design); pending implementation plan.

## Context

Today every generated document — the ad-hoc PDF report, the Excel export, and the
charge document (התחשבנות) — renders in the **freelancer's UI language**. The PDF is
produced 100% client-side: `printStyles.ts` clones the on-page `#pdf-content` React
subtree into the body and calls `window.print()`. That subtree renders via
`useTranslations`/`useLocale`, which resolve against the UI's `NextIntlClientProvider`
(locale = the `[locale]` route segment, `he` default / `en` = `/en`).

This is wrong for the real use case: an Israeli freelancer running the app in English
still bills an **Israeli** client in **Hebrew**, and a foreign client in **English**.
The deliverable's language is a property of the **client**, not of the freelancer's
interface.

**Decision (from brainstorming):** the document language is determined **per client**,
with a **per-document override at print time**. The interface language is irrelevant to
the produced document.

### What already helps us

- `printStyles.ts` already takes a `direction: "rtl" | "ltr"` parameter — RTL/LTR of the
  printed page is already decoupled from `<html dir>`.
- `formatDate` / `formatCurrency` already accept an explicit `locale` argument.
- The Excel route (`app/api/reports/excel`) already accepts a `locale` query param.
- next-intl natively supports **nesting** a second `NextIntlClientProvider`.

So the core challenge is narrow: render the `#pdf-content` subtree (and the Excel
labels) under a **document locale** that may differ from the UI locale.

## Decisions (locked)

| Topic | Decision |
|---|---|
| New-client default | **Auto** by currency: `ILS → he`, any foreign currency → `en`. Overridable. |
| Per-document override | **Yes** — a He/En toggle at print time, default = the client's resolved language. Available on **both** the ad-hoc report screen **and** the saved charge-document view. |
| Storage / existing clients | 3-way value **Auto \| he \| en** (`NULL` = Auto). **No backfill** — `NULL` resolves live from currency. |
| Excel export | Follows the document language, same as the PDF. |
| Client-facing emails | **N/A** — there are none. All emails target the freelancer (verification, trial lifecycle, contact/feedback). Out of scope. |
| Charge-document language | **Snapshotted** at issue time onto `charge_documents`, so re-printing a past settlement stays in its original language even if the client's language later changes. The print-time toggle can still override a single print without mutating the snapshot. |

## Approach (chosen)

**Nested `NextIntlClientProvider` around the print subtree (Approach A).**

Wrap *only* the `#pdf-content` subtree in a second provider configured with the
**document locale** and that locale's messages. Components inside keep using
`useTranslations` and transparently read the inner provider. `dir`,
`formatDate`/`formatCurrency` already accept explicit values, so they receive the
document locale.

Rejected alternatives:
- **B — manual `createTranslator` + thread `tDoc` as a prop:** nested PDF subcomponents
  that call `useTranslations` would not pick up `tDoc`; mixing `t`/`tDoc` is error-prone.
- **C — separate server print route under `/{docLocale}/...` in a hidden iframe:**
  duplicates the entire render layer + auth/data-fetch in an iframe; massive overkill
  versus the current client-only print.

### Loading the other locale's messages

There are exactly two locales. On the **reports route only**, eagerly load both
`messages/he.json` and `messages/en.json` client-side (the current locale via next-intl's
`useMessages()`, the other via a one-time dynamic `import()`), so the print-time toggle
switches instantly with no spinner. The cost is bounded (one extra ~JSON load, reports
screen only, lazy).

## Data model

Single source of truth for resolution:

**`lib/document-language.ts`** (pure, shared client + server, unit-tested)

```ts
export type DocumentLanguage = "he" | "en";
/** A client's stored setting; null = "auto" (resolve from currency). */
export type ClientDocLanguage = DocumentLanguage | null;

/** Resolve the concrete document locale for a client/document. */
export function resolveDocumentLocale(
  setting: ClientDocLanguage,
  currency: string
): DocumentLanguage {
  if (setting === "he" || setting === "en") return setting;
  return currency === "ILS" ? "he" : "en"; // auto
}
```

**Schema changes (Drizzle `src/db/schema.ts`; migration `0026` applied via psql +
`DATABASE_URL_ADMIN`, dev first then prod at deploy):**

- `clients.document_language text` — `NULL` = Auto. Add a CHECK constraint
  `document_language IS NULL OR document_language IN ('he','en')`.
- `charge_documents.document_language text` — `NULL` = resolve live (legacy / pre-feature
  docs). Set at issue time for new documents. Same CHECK constraint.

No backfill: existing clients keep `NULL` → Auto; existing charge documents keep `NULL` →
resolved live from their client at print time.

## Components / units

1. **`lib/document-language.ts`** — types + `resolveDocumentLocale` + the currency rule.
   The only place the He/En decision lives.

2. **Schema + migration `0026`** — the two nullable columns + CHECK constraints.

3. **Client editor** (`clients` form) — a 3-way Select: **Auto / עברית / English**, with a
   transparent preview of what Auto resolves to for the current currency
   (e.g. "Auto (עברית)"). Persists to `clients.document_language` (Auto ⇒ `NULL`).
   New strings in both `messages/he.json` and `messages/en.json`.

4. **Ad-hoc report plumbing** (`AdHocReportTab.tsx` — the only screen that prints a
   self-contained PDF report):
   - Compute `docLocale`: from the selected client (`filters.clientId` →
     `documentLanguage` + `currency` via `resolveDocumentLocale`). For a **multi-client /
     "all clients"** report there is no single client → default `docLocale` = UI locale.
   - A **He/En segmented toggle** near the export/template controls, initialized to the
     resolved client language (or UI locale for multi-client). The toggle's value is the
     effective `docLocale`.
   - Wrap `#pdf-content` in `<NextIntlClientProvider locale={docLocale}
     messages={messagesByLocale[docLocale]}>`. Extract the PDF markup into its own
     component (`PdfReportContent`) that calls `useTranslations` internally — this is also
     healthy decomposition of an already-large file.
   - Pass `docLocale` to `printPdfContent` (`dir = docLocale === "he" ? "rtl" : "ltr"`)
     and to every `formatDate`/`formatCurrency` in the print subtree.
   - Pass `docLocale` (not the UI locale) to the **Excel** export request.

5. **`ChargeDocumentView.tsx`** — same nested-provider treatment for its `#pdf-content`.
   - Effective language = `doc.document_language` (the snapshot) if present, else
     `resolveDocumentLocale(client.documentLanguage, doc.currency)`.
   - **Print-time He/En toggle** here too, initialized to that effective language, so the
     user can re-print this exact saved document in the other language **without** mutating
     the snapshot.
   - At **issue time**, write the `document_language` snapshot.

6. **Charge-document issuance** (`app/api/charge-documents/route.ts`, triggered from
   `BillableTab.tsx`) — `BillableTab` itself renders **no** PDF subtree; it selects billable
   entries and creates the document. The issue route already receives `clientId`, so it
   resolves `document_language` **server-side** via `resolveDocumentLocale(client
   .document_language, doc.currency)` and writes the snapshot. No client-side plumbing in
   `BillableTab`.

7. **AdHoc cleanup** — replace the ~2 hardcoded Hebrew strings in `AdHocReportTab.tsx`
   with message keys (present in both locale files).

8. **Excel route** (`app/api/reports/excel/route.ts`) — already accepts `locale`; no logic
   change beyond the client passing `docLocale`. Verify all server-side labels read from
   the passed locale's messages.

## Data flow

```
Client setting (Auto|he|en)  ─┐
Client currency  ────────────┼─► resolveDocumentLocale() ─► docLocale (he|en)
Charge-doc snapshot (if any) ─┘            │
                                           ├─► print-time toggle (override, default=docLocale)
                                           ▼
                          effective docLocale
                          ├─► <NextIntlClientProvider locale messages>  (PDF subtree)
                          ├─► printStyles direction (rtl|ltr)
                          ├─► formatDate / formatCurrency
                          └─► Excel export ?locale=
```

## Error handling & edge cases

- **Multi-client / "all clients" report:** no single client → `docLocale` = UI locale;
  toggle still lets the user pick.
- **Legacy charge document (no snapshot):** `document_language` is `NULL` → resolve live
  from the client at print time.
- **Client language changed after a settlement was issued:** past charge documents keep
  their snapshot (immutable); only live/auto contexts follow the change.
- **Messages load failure for the other locale:** fall back to the UI locale's messages and
  keep the export working (no silent blank PDF).
- **Currency missing/unknown on an auto client:** treated as non-ILS → `en` (matches the
  "foreign" default).

## Testing

- **Unit** (`tests/unit/`): `resolveDocumentLocale` — explicit `he`/`en` pass through;
  `null` + `ILS` → `he`; `null` + `USD`/`EUR`/`USDT`/`BTC`/`ETH` → `en`; unknown currency
  → `en`.
- **i18n parity** (`tests/unit/i18n-parity.test.ts`): stays green — every new key exists in
  both `he.json` and `en.json`.
- Manual: print a Hebrew client's report while the UI is in English (and vice-versa);
  verify direction, currency/date formatting, and the toggle override on both the ad-hoc
  report and a saved charge document.

## Scope boundary — what the language switch translates (and what it never does)

The document language controls **only the template's own chrome**: structural labels
rendered via `useTranslations` — e.g. "חשבונית"/"Invoice", "תאריך"/"Date", "סה״כ"/"Total",
column headers, "הונפק בתאריך", payment-terms boilerplate — plus the document **direction**
(RTL/LTR) and **date/number/currency formatting**.

It **never** translates **user-entered content**, which is data, not translation keys, and
prints **verbatim as typed**:

- item / rate names (`rate_label`, line `label`), line descriptions, notes
- business name, client name and the client's address/contact fields

So an English client whose items were typed as "Consulting" will, when the document is
printed in Hebrew, show a Hebrew RTL **frame** with "Consulting" still reading
"Consulting". This is correct behavior, not a bug. To change content wording, the
freelancer edits the content itself.

**Auto-translation is explicitly rejected** (would require an external translation API —
cost + latency + a new dependency — for marginal value). No content is ever machine-translated.

## Out of scope (v1)

- Auto-translation of user-entered content (see Scope boundary above).
- Client-facing emails (none exist).
- Languages beyond `he` / `en`.
- Per-line / mixed-language documents.
- Changing how PDF templates look (printed pages stay light — documented exception).
