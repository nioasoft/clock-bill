# Client Document Language Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every generated document (PDF report, charge document, Excel export) render in the **client's** document language — independent of the freelancer's UI language — with a per-document language override at print time.

**Architecture:** A pure resolver (`resolveDocumentLocale`) maps a client's 3-way setting (`Auto | he | en`, NULL=Auto) + currency to a concrete locale. The PDF print subtree is extracted into its own component and wrapped in a **nested** `NextIntlClientProvider` set to the document locale, so its `useTranslations`/`useLocale` resolve to the document language while the surrounding UI stays in the interface language. Charge documents snapshot their language at issue time; the snapshot is the default but a print-time toggle can override a single print without mutating it.

**Tech Stack:** Next.js 16 App Router, next-intl (`he` default / `en` = `/en`), Drizzle ORM + raw `pg`, PostgreSQL (Neon prod / Docker dev), custom `tsx` test runner.

## Global Constraints

- **Bilingual parity:** every user-facing string must exist in BOTH `messages/he.json` and `messages/en.json` (enforced by `tests/unit/i18n-parity.test.ts`).
- **Design tokens only** in app UI — no `bg-white`/`text-black`/`bg-gray-*`/hex. PDF templates under `*pdf*` are the documented light-mode exception.
- **RTL logical properties** (`ps-*`/`me-*`, not `pl-*`/`mr-*`).
- **TypeScript strict, no `any`.** Files 200–400 lines (800 max), functions < 50 lines.
- **Every query touching user data filters by `user_id`** (RLS is also live; keep the app-level filter).
- **Migrations applied via `psql` + `DATABASE_URL_ADMIN`** (NOT `db:migrate` — Drizzle journal has known drift). Dev first; prod at deploy time. Last migration number: **0025** → this feature is **0026**.
- **Document language values:** only `'he'` | `'en'`; client/doc column NULL = Auto/resolve-live.
- **Currency→Auto rule:** `currency === 'ILS' ? 'he' : 'en'`.
- **Test runner:** `npx tsx tests/unit/<file>.test.ts` (custom `TestRunner` class, not Jest/Vitest).

---

### Task 1: Pure resolver `lib/document-language.ts`

**Files:**
- Create: `lib/document-language.ts`
- Test: `tests/unit/document-language.test.ts`

**Interfaces:**
- Produces:
  - `type DocumentLanguage = "he" | "en"`
  - `type ClientDocLanguage = DocumentLanguage | null` (null = Auto)
  - `function resolveDocumentLocale(setting: ClientDocLanguage, currency: string): DocumentLanguage`
  - `const DOCUMENT_LANGUAGES: readonly DocumentLanguage[]` (`["he","en"]`)

- [ ] **Step 1: Write the failing test**

Create `tests/unit/document-language.test.ts` (copy the `TestRunner` harness pattern from `tests/unit/rounding.test.ts` — same `class TestRunner`, `test()`, `run()`, and an `assertEqual` helper):

```ts
import { resolveDocumentLocale } from "../../lib/document-language";

// ... TestRunner boilerplate copied from tests/unit/rounding.test.ts ...

const r = new TestRunner();

r.test("explicit he passes through regardless of currency", () => {
  assertEqual(resolveDocumentLocale("he", "USD"), "he");
});
r.test("explicit en passes through regardless of currency", () => {
  assertEqual(resolveDocumentLocale("en", "ILS"), "en");
});
r.test("auto + ILS resolves to he", () => {
  assertEqual(resolveDocumentLocale(null, "ILS"), "he");
});
r.test("auto + USD resolves to en", () => {
  assertEqual(resolveDocumentLocale(null, "USD"), "en");
});
r.test("auto + EUR/USDT/BTC/ETH resolve to en", () => {
  for (const c of ["EUR", "USDT", "BTC", "ETH"]) assertEqual(resolveDocumentLocale(null, c), "en");
});
r.test("auto + unknown/empty currency resolves to en (treated as foreign)", () => {
  assertEqual(resolveDocumentLocale(null, ""), "en");
});

r.run();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx tests/unit/document-language.test.ts`
Expected: FAIL — `Cannot find module '../../lib/document-language'`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/document-language.ts`:

```ts
/**
 * Resolves the language a generated document (PDF / charge doc / Excel) renders
 * in. The document language is a property of the CLIENT, not the freelancer's UI
 * locale. NULL setting = "Auto": inferred from the client's currency.
 */

export type DocumentLanguage = "he" | "en";

/** A client's stored document-language setting; null = "auto". */
export type ClientDocLanguage = DocumentLanguage | null;

export const DOCUMENT_LANGUAGES: readonly DocumentLanguage[] = ["he", "en"];

/**
 * @param setting client/document setting: "he" | "en" | null(=auto)
 * @param currency the client/document currency (e.g. "ILS", "USD")
 * @returns the concrete document locale
 */
export function resolveDocumentLocale(
  setting: ClientDocLanguage,
  currency: string
): DocumentLanguage {
  if (setting === "he" || setting === "en") return setting;
  return currency === "ILS" ? "he" : "en";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx tests/unit/document-language.test.ts`
Expected: PASS (all assertions).

- [ ] **Step 5: Commit**

```bash
git add lib/document-language.ts tests/unit/document-language.test.ts
git commit -m "feat(reports): add document-language resolver (currency-based Auto)"
```

---

### Task 2: Schema + migration 0026 (two nullable columns)

**Files:**
- Create: `drizzle/0026_client_document_language.sql`
- Modify: `src/db/schema.ts` (add `documentLanguage` to `clients` ~line 215 and to `chargeDocuments` ~line 488)

**Interfaces:**
- Produces: `clients.document_language` and `charge_documents.document_language` columns (text, nullable, CHECK in (`he`,`en`)).

- [ ] **Step 1: Write the migration SQL**

Create `drizzle/0026_client_document_language.sql`:

```sql
-- Per-client document language ("שפת המסמך המופק").
-- NULL = Auto (resolved from currency at render time). No backfill.
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS document_language text;
ALTER TABLE clients
  ADD CONSTRAINT clients_document_language_check
  CHECK (document_language IS NULL OR document_language IN ('he', 'en'));

-- Snapshot of the language a charge document was issued in. NULL on legacy /
-- pre-feature docs (resolved live from the client at print time).
ALTER TABLE charge_documents
  ADD COLUMN IF NOT EXISTS document_language text;
ALTER TABLE charge_documents
  ADD CONSTRAINT charge_documents_document_language_check
  CHECK (document_language IS NULL OR document_language IN ('he', 'en'));
```

- [ ] **Step 2: Apply to the dev database**

Run (uses the admin role; the connection string is in `.env.local` as `DATABASE_URL_ADMIN`):

```bash
psql "$(grep '^DATABASE_URL_ADMIN=' .env.local | cut -d= -f2- | tr -d '"')" -f drizzle/0026_client_document_language.sql
```

Expected: `ALTER TABLE` × 4, no errors. (Re-running is safe: `ADD COLUMN IF NOT EXISTS`; if the CHECK already exists, drop-and-recreate or ignore the duplicate-object error.)

- [ ] **Step 3: Mirror the columns in the Drizzle schema**

In `src/db/schema.ts`, inside `clients` (after the `billingRounding` column, before `isRetainer`):

```ts
    // Document language for generated PDFs/Excel/charge docs. NULL = Auto
    // (resolved from currency via lib/document-language.ts). See spec
    // 2026-06-20-client-document-language.
    documentLanguage: text("document_language"),
```

And add to the `clients` table's constraint array (alongside `clients_billing_rounding_check`):

```ts
    check(
      "clients_document_language_check",
      sql`${table.documentLanguage} IS NULL OR ${table.documentLanguage} IN ('he', 'en')`
    ),
```

In `chargeDocuments` (after `pdfTemplate`):

```ts
    // Language snapshot at issue time. NULL = resolve live from the client.
    documentLanguage: text("document_language"),
```

And to its constraint array:

```ts
    check(
      "charge_documents_document_language_check",
      sql`${table.documentLanguage} IS NULL OR ${table.documentLanguage} IN ('he', 'en')`
    ),
```

- [ ] **Step 4: Verify schema typechecks**

Run: `npx tsc --noEmit`
Expected: no new errors from `src/db/schema.ts`.

- [ ] **Step 5: Commit**

```bash
git add drizzle/0026_client_document_language.sql src/db/schema.ts
git commit -m "feat(db): add document_language to clients and charge_documents (0026)"
```

---

### Task 3: Clients API — accept, persist, and return `documentLanguage`

**Files:**
- Modify: `app/api/clients/route.ts` (POST create-schema ~line 25; INSERT ~line 226; GET list mapping ~line 102; create response mapping ~line 291)
- Modify: `app/api/clients/[id]/route.ts` (PUT update-schema ~line 22; UPDATE statement; GET-by-id SELECT/mapping)

**Interfaces:**
- Consumes: nothing new.
- Produces: clients API now round-trips `documentLanguage: "he" | "en" | null`. The client-list and client-detail JSON include `documentLanguage`.

- [ ] **Step 1: Extend the Zod schemas**

In BOTH `app/api/clients/route.ts` (create schema, after the `billingRounding` line ~26) and `app/api/clients/[id]/route.ts` (update schema, after ~line 23), add:

```ts
  documentLanguage: z.enum(["he", "en"]).nullish(),
```

- [ ] **Step 2: Persist on create (POST)**

In `app/api/clients/route.ts`:
- Add `documentLanguage` to the destructure at ~line 174.
- Add `document_language` to the INSERT column list (~line 226) and `RETURNING` list (~line 228), and append `documentLanguage ?? null` to the values array (~line 238 area, matching positional `$N`).
- Add to the GET list `SELECT` (~line 73) and `GROUP BY` (~line 88): `c.document_language`.
- Map it in BOTH the GET list response (~line 102) and the create response (~line 291):

```ts
      documentLanguage: client.document_language ?? null,
```

(Also add `document_language: string | null;` to the row type literals at ~line 60 and ~line 215.)

- [ ] **Step 3: Persist on update + return on detail (PUT/GET by id)**

In `app/api/clients/[id]/route.ts`:
- Add `documentLanguage` to the PUT destructure.
- Add `document_language = $N` to the UPDATE `SET` clause (use `documentLanguage ?? null`).
- Add `document_language` to the GET-by-id `SELECT` (~line 75) and row type (~line 64), and map `documentLanguage: client.document_language ?? null` in the response.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

Manual smoke (dev server running): `PUT /api/clients/<id>` with body `{"documentLanguage":"en", ...existing required fields}` → 200; `GET /api/clients/<id>` returns `"documentLanguage":"en"`. Setting it to `null` clears to Auto.

- [ ] **Step 5: Commit**

```bash
git add app/api/clients/route.ts app/api/clients/[id]/route.ts
git commit -m "feat(api): round-trip client document_language"
```

---

### Task 4: Client edit form — 3-way language Select + i18n strings

**Files:**
- Modify: `app/[locale]/clients/[id]/page.tsx` (Client type ~line 35; `clientToFormData` ~line 55; `formData` initial state ~line 93; PUT body ~line 194; the Billing fieldset near the currency Select ~line 382)
- Modify: `messages/he.json` (`Clients` namespace ~line 466)
- Modify: `messages/en.json` (`Clients` namespace, same keys)

**Interfaces:**
- Consumes: Task 1 `resolveDocumentLocale`, Task 3 API field.
- Produces: a user-editable document-language setting on the client edit form.

- [ ] **Step 1: Add the message keys (both files)**

In `messages/he.json` `"Clients"` object add:

```json
    "documentLanguageLabel": "שפת המסמך המופק",
    "documentLanguageHint": "השפה שבה יופקו דוחות, מסמכי חיוב ו-Excel ללקוח זה",
    "documentLanguageAuto": "אוטומטי",
    "documentLanguageAutoResolved": "אוטומטי ({lang})",
    "documentLanguageHe": "עברית",
    "documentLanguageEn": "אנגלית",
```

In `messages/en.json` `"Clients"` object add the same keys:

```json
    "documentLanguageLabel": "Document language",
    "documentLanguageHint": "The language reports, charge documents and Excel are generated in for this client",
    "documentLanguageAuto": "Automatic",
    "documentLanguageAutoResolved": "Automatic ({lang})",
    "documentLanguageHe": "Hebrew",
    "documentLanguageEn": "English",
```

- [ ] **Step 2: Thread the field through form state**

In `app/[locale]/clients/[id]/page.tsx`:
- `Client` type (~line 35): add `documentLanguage: string | null;`.
- `clientToFormData` (~line 55): add `documentLanguage: (client.documentLanguage ?? "") as "" | "he" | "en",` (empty string = Auto in the form).
- `formData` initial state (~line 93): add `documentLanguage: "" as "" | "he" | "en",`.
- PUT body (~line 194): add `documentLanguage: formData.documentLanguage === "" ? null : formData.documentLanguage,`.

- [ ] **Step 3: Render the Select (next to the currency field, ~line 382)**

Add a field in the Billing fieldset, mirroring the existing currency `SimpleSelect` markup/classes. The Auto option label shows what Auto resolves to for the current currency:

```tsx
<div>
  <label htmlFor="documentLanguage" className="mb-1.5 block text-sm font-medium text-foreground">
    {t("documentLanguageLabel")}
  </label>
  <SimpleSelect
    value={formData.documentLanguage}
    onValueChange={(v) =>
      setFormData({ ...formData, documentLanguage: v as "" | "he" | "en" })
    }
    options={[
      {
        value: "",
        label: t("documentLanguageAutoResolved", {
          lang:
            resolveDocumentLocale(null, formData.currency) === "he"
              ? t("documentLanguageHe")
              : t("documentLanguageEn"),
        }),
      },
      { value: "he", label: t("documentLanguageHe") },
      { value: "en", label: t("documentLanguageEn") },
    ]}
  />
  <p className="mt-1 text-xs text-muted-foreground">{t("documentLanguageHint")}</p>
</div>
```

Add the import: `import { resolveDocumentLocale } from "@/lib/document-language";`. Verify `SimpleSelect`'s prop names against `components/ui/simple-select.tsx` (it is already imported at ~line 17 and used for currency — match that exact usage: prop names, `options` shape).

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npm run lint && npx tsx tests/unit/i18n-parity.test.ts`
Expected: clean; parity PASS.

Manual: edit a client, set language to English, save, reload → English selected. Switch back to Auto → the option reads "אוטומטי (עברית)" for an ILS client, "Automatic (English)" / "אוטומטי (אנגלית)" for a USD client.

- [ ] **Step 5: Commit**

```bash
git add "app/[locale]/clients/[id]/page.tsx" messages/he.json messages/en.json
git commit -m "feat(clients): document-language selector on the client form"
```

---

### Task 5: Charge-document issuance snapshot + expose on detail

**Files:**
- Modify: `app/api/charge-documents/route.ts` (POST: client SELECT ~line 62; INSERT ~line 131)
- Modify: `app/api/charge-documents/[id]/route.ts` (GET-by-id SELECT ~line 19)

**Interfaces:**
- Consumes: Task 1 `resolveDocumentLocale`, Task 2 column.
- Produces: new charge docs store `document_language`; the detail endpoint returns `document_language` (snapshot) and `client_document_language` (for the legacy fallback).

- [ ] **Step 1: Resolve + snapshot on issue (POST)**

In `app/api/charge-documents/route.ts`, add the import at the top:

```ts
import { resolveDocumentLocale } from "@/lib/document-language";
```

Change the client lookup (~line 62) to also fetch the setting:

```ts
      const clientRow = await client.query(
        `SELECT currency, document_language FROM clients WHERE id = $1 AND user_id = $2`,
        [clientId, user.id]
      );
      if (clientRow.rowCount === 0) throw new Error("CLIENT_NOT_FOUND");
      const currency: string = clientRow.rows[0].currency ?? "ILS";
      const documentLanguage = resolveDocumentLocale(
        (clientRow.rows[0].document_language ?? null) as "he" | "en" | null,
        currency
      );
```

Add `document_language` to the INSERT (~line 131) — column list, one extra `$N`, and the value `documentLanguage`:

```ts
      const doc = await client.query(
        `INSERT INTO charge_documents
           (id, user_id, client_id, doc_number, status, currency, total, notes, pdf_template, document_language, issued_at)
         VALUES (gen_random_uuid()::text, $1, $2, $3, 'pending', $4, $5, $6, $7, $8, NOW())
         RETURNING id, doc_number`,
        [user.id, clientId, docNumber, currency, total, notes ?? null, pdfTemplate, documentLanguage]
      );
```

- [ ] **Step 2: Expose snapshot + client setting on the detail GET**

In `app/api/charge-documents/[id]/route.ts`, the GET-by-id already selects `d.*` (so `document_language` is included). Add the client's current setting for the legacy fallback (~line 19):

```ts
      `SELECT d.*, c.name AS client_name, c.document_language AS client_document_language
         FROM charge_documents d
         JOIN clients c ON d.client_id = c.id
        WHERE d.id = $1 AND d.user_id = $2`,
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

Manual: issue a charge document for a USD client whose language is Auto → DB row has `document_language = 'en'`; `GET /api/charge-documents/<id>` returns `document_language:"en"`.

- [ ] **Step 4: Commit**

```bash
git add app/api/charge-documents/route.ts "app/api/charge-documents/[id]/route.ts"
git commit -m "feat(charge-docs): snapshot document language at issue time"
```

---

### Task 6: Client-side document-messages loader hook

**Files:**
- Create: `lib/document-messages.ts`

**Interfaces:**
- Consumes: Task 1 `DocumentLanguage`.
- Produces: `useDocumentMessages(locale: DocumentLanguage): AbstractIntlMessages | null` — returns that locale's full messages bundle (cached), or `null` until loaded.

- [ ] **Step 1: Implement the hook**

Create `lib/document-messages.ts`:

```ts
"use client";

import { useEffect, useState } from "react";
import type { AbstractIntlMessages } from "next-intl";
import type { DocumentLanguage } from "@/lib/document-language";

// Module-level cache: a locale's messages bundle is loaded once per session.
const cache = new Map<DocumentLanguage, AbstractIntlMessages>();

async function loadMessages(locale: DocumentLanguage): Promise<AbstractIntlMessages> {
  const cached = cache.get(locale);
  if (cached) return cached;
  // Explicit branches (not a template import) so the bundler code-splits each
  // locale cleanly. Only two locales exist.
  const mod =
    locale === "he"
      ? await import("@/messages/he.json")
      : await import("@/messages/en.json");
  const messages = mod.default as AbstractIntlMessages;
  cache.set(locale, messages);
  return messages;
}

/**
 * Returns the messages bundle for `locale` (the document language), or null
 * until it has loaded. Used to render the print subtree under a nested
 * NextIntlClientProvider in a language different from the UI.
 */
export function useDocumentMessages(locale: DocumentLanguage): AbstractIntlMessages | null {
  const [messages, setMessages] = useState<AbstractIntlMessages | null>(
    () => cache.get(locale) ?? null
  );
  useEffect(() => {
    let active = true;
    void loadMessages(locale).then((m) => {
      if (active) setMessages(m);
    });
    return () => {
      active = false;
    };
  }, [locale]);
  return messages;
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: clean. (If `AbstractIntlMessages` is not exported from `next-intl` in this version, fall back to `Record<string, unknown>` for the type and cast at the provider boundary.)

- [ ] **Step 3: Commit**

```bash
git add lib/document-messages.ts
git commit -m "feat(reports): client-side document-messages loader hook"
```

---

### Task 7: Ad-hoc report — extract PDF subtree, doc-locale + toggle, wire print/Excel/cleanup

**Files:**
- Create: `app/[locale]/(auth)/reports/PdfReportContent.tsx`
- Modify: `app/[locale]/(auth)/reports/AdHocReportTab.tsx` (clients type; docLocale + override state; export handlers ~417/442; export-controls ~671; replace inline `#pdf-content` block ~704–~1430 with the wrapped component; remove 2 hardcoded Hebrew strings)
- Modify: `messages/he.json` + `messages/en.json` (`Reports` namespace: toggle labels + the 2 cleaned strings)

**Interfaces:**
- Consumes: Task 1 `resolveDocumentLocale`/`DocumentLanguage`, Task 6 `useDocumentMessages`, existing `printPdfContent` (`printStyles.ts`).
- Produces: `PdfReportContent` — a component that renders the printable report markup using its OWN `useTranslations("Reports")` + `useLocale()`, receiving report data via props.

> **Why a separate component (critical):** the inline `#pdf-content` JSX currently uses the `t`/`locale` captured from `AdHocReportTab`'s `useTranslations`/`useLocale`. A nested provider does NOT re-bind that closure — only hooks called by components *rendered inside* the provider see the new locale. So the markup MUST move into a component that calls its own hooks.

- [ ] **Step 1: Add the `Reports` message keys (both files)**

`messages/he.json` `"Reports"`:

```json
    "documentLanguageToggle": "שפת המסמך",
    "documentLanguageHe": "עברית",
    "documentLanguageEn": "אנגלית",
```

`messages/en.json` `"Reports"`:

```json
    "documentLanguageToggle": "Document language",
    "documentLanguageHe": "Hebrew",
    "documentLanguageEn": "English",
```

For the 2 hardcoded Hebrew strings: grep them and add a key per string in BOTH files (find them with `grep -nP '[\\x{0590}-\\x{05FF}]' "app/[locale]/(auth)/reports/AdHocReportTab.tsx"`). Name keys descriptively under `Reports` (e.g. `"pdfAllClients"`), Hebrew value in `he.json`, English translation in `en.json`.

- [ ] **Step 2: Extract `PdfReportContent.tsx`**

Create `app/[locale]/(auth)/reports/PdfReportContent.tsx`. Move the **entire `#pdf-content` JSX block verbatim** (currently `AdHocReportTab.tsx` ~line 704 through its matching close just before the component's final `</div>`/`)` at ~1430) into this component's return. Then:
- The component calls its own hooks at the top: `const t = useTranslations("Reports");` and `const locale = useLocale();`.
- Every identifier the moved JSX references that was state/prop/local of `AdHocReportTab` (e.g. `report`, `userProfile`, `filters`, `clients`, and any local formatting helpers) becomes a **prop**. Define a `PdfReportContentProps` interface listing them with explicit types (reuse the existing types from `AdHocReportTab`; export shared types if needed).
- Keep `dir={locale === "he" ? "rtl" : "ltr"}` on the `#pdf-content` div — now `locale` is the document locale from the nested provider.
- Replace any usage of the cleaned hardcoded strings with `t("<key>")`.

```tsx
"use client";

import { useTranslations, useLocale } from "next-intl";
// ...import the shared types/helpers used by the markup...

interface PdfReportContentProps {
  // List every value the moved markup references, with explicit types.
  // e.g.: report: ReportData; userProfile: UserProfile | null; filters: ReportFilters;
  //       clients: ClientOption[];
}

export function PdfReportContent(props: PdfReportContentProps) {
  const t = useTranslations("Reports");
  const locale = useLocale();
  // ...destructure props...
  return (
    <div id="pdf-content" className="print-only" dir={locale === "he" ? "rtl" : "ltr"}>
      {/* moved markup, using t(...) and locale */}
    </div>
  );
}
```

- [ ] **Step 3: Compute the document locale + override in `AdHocReportTab`**

Add imports:

```ts
import { NextIntlClientProvider } from "next-intl";
import { resolveDocumentLocale, type DocumentLanguage } from "@/lib/document-language";
import { useDocumentMessages } from "@/lib/document-messages";
import { PdfReportContent } from "./PdfReportContent";
```

Ensure the `clients` prop/type carries `documentLanguage: string | null` and `currency: string` (it already has currency). Add the resolution near the other derived state (after `locale` ~line 176):

```ts
const selectedClient = filters.clientId
  ? clients.find((c) => c.id === filters.clientId)
  : undefined;
const clientDocLocale: DocumentLanguage = selectedClient
  ? resolveDocumentLocale(
      (selectedClient.documentLanguage ?? null) as DocumentLanguage | null,
      selectedClient.currency || "ILS"
    )
  : locale === "en" ? "en" : "he"; // multi-client / "all clients" → UI locale

const [docLangOverride, setDocLangOverride] = useState<DocumentLanguage | null>(null);
// Reset the manual override whenever the selected client changes.
useEffect(() => {
  setDocLangOverride(null);
}, [filters.clientId]);

const docLocale: DocumentLanguage = docLangOverride ?? clientDocLocale;
const docMessages = useDocumentMessages(docLocale);
```

- [ ] **Step 4: Pass `docLocale` to print + Excel**

- In `confirmExportPdf` (~line 422), replace `locale === "he" ? "rtl" : "ltr"` with `docLocale === "he" ? "rtl" : "ltr"`.
- In `handleExportExcel` (~line 442), replace `params.append("locale", locale);` with `params.append("locale", docLocale);`.

- [ ] **Step 5: Add the language toggle to the export controls (~line 671)**

Render a He/En segmented control near the Export buttons (match the app's existing segmented-toggle styling — reuse the same component/classes already used elsewhere in reports; tokens only):

```tsx
<div className="flex items-center gap-2">
  <span className="text-sm text-muted-foreground">{t("documentLanguageToggle")}</span>
  {/* segmented He/En; selected = docLocale */}
  <button
    type="button"
    onClick={() => setDocLangOverride("he")}
    aria-pressed={docLocale === "he"}
    className={/* selected → bg-primary text-primary-foreground; else surface */ ""}
  >
    {t("documentLanguageHe")}
  </button>
  <button
    type="button"
    onClick={() => setDocLangOverride("en")}
    aria-pressed={docLocale === "en"}
    className={/* same pattern */ ""}
  >
    {t("documentLanguageEn")}
  </button>
</div>
```

- [ ] **Step 6: Replace the inline subtree with the wrapped component**

Where the `#pdf-content` block used to be (~line 704), render:

```tsx
{docMessages && (
  <NextIntlClientProvider locale={docLocale} messages={docMessages}>
    <PdfReportContent
      // pass exactly the props PdfReportContentProps declares
    />
  </NextIntlClientProvider>
)}
```

If `AdHocReportTab`'s outer `NextIntlClientProvider` sets `timeZone`/`now`, pass the same values here to avoid next-intl env warnings.

- [ ] **Step 7: Verify**

Run: `npx tsc --noEmit && npm run lint && npx tsx tests/unit/i18n-parity.test.ts`
Expected: clean; parity PASS.

Manual (dev server, UI in English at `/en`): pick a Hebrew (ILS) client → toggle shows עברית selected → export PDF prints **RTL Hebrew** chrome; export Excel has Hebrew headers. Flip toggle to English → same report prints LTR English chrome. Pick "all clients" → defaults to the UI language. User-typed item names stay verbatim in both.

- [ ] **Step 8: Commit**

```bash
git add "app/[locale]/(auth)/reports/PdfReportContent.tsx" "app/[locale]/(auth)/reports/AdHocReportTab.tsx" messages/he.json messages/en.json
git commit -m "feat(reports): ad-hoc PDF/Excel render in client document language + toggle"
```

---

### Task 8: Charge document view — extract PDF subtree, snapshot-based locale + toggle

**Files:**
- Create: `app/[locale]/(auth)/reports/PdfChargeDocument.tsx`
- Modify: `app/[locale]/(auth)/reports/ChargeDocumentView.tsx` (doc type adds `document_language` + `client_document_language`; docLocale/override/messages; print handler ~339; toggle; replace inline `#pdf-content` ~713–~880)

**Interfaces:**
- Consumes: Task 1, Task 6, the detail API fields from Task 5.
- Produces: `PdfChargeDocument` — printable charge-doc markup using its own `useTranslations("Reports")`/`useLocale()`.

- [ ] **Step 1: Extract `PdfChargeDocument.tsx`**

Same mechanical extraction as Task 7 Step 2, for the `#pdf-content` block in `ChargeDocumentView.tsx` (~line 713 to ~880). The new component calls its own `useTranslations("Reports")` + `useLocale()`; everything the markup references from `ChargeDocumentView` (`doc`, `profile`, lines, helpers) becomes a typed prop. Keep `dir={locale === "he" ? "rtl" : "ltr"}` on the `#pdf-content` div.

- [ ] **Step 2: Compute snapshot-based doc locale + override**

In `ChargeDocumentView.tsx`, add imports (`NextIntlClientProvider`, `resolveDocumentLocale`, `DocumentLanguage`, `useDocumentMessages`, `PdfChargeDocument`). Extend the `doc` type with `document_language: string | null` and `client_document_language: string | null`. Then (after `locale` ~line 111):

```ts
const snapshotLang = (doc.document_language ?? null) as DocumentLanguage | null;
const effectiveDefault: DocumentLanguage =
  snapshotLang ??
  resolveDocumentLocale(
    (doc.client_document_language ?? null) as DocumentLanguage | null,
    doc.currency || "ILS"
  );
const [docLangOverride, setDocLangOverride] = useState<DocumentLanguage | null>(null);
const docLocale: DocumentLanguage = docLangOverride ?? effectiveDefault;
const docMessages = useDocumentMessages(docLocale);
```

- [ ] **Step 3: Print handler + toggle + wrap**

- In the print handler (~line 339) replace `locale === "he" ? "rtl" : "ltr"` with `docLocale === "he" ? "rtl" : "ltr"`.
- Add the same He/En segmented toggle as Task 7 Step 5 (selected = `docLocale`, `onClick` sets `setDocLangOverride`), placed near the document's print/template controls. Reuse the `Reports.documentLanguageToggle`/`documentLanguageHe`/`documentLanguageEn` keys (already added in Task 7).
- Replace the inline `#pdf-content` block with:

```tsx
{docMessages && (
  <NextIntlClientProvider locale={docLocale} messages={docMessages}>
    <PdfChargeDocument
      // props per PdfChargeDocumentProps
    />
  </NextIntlClientProvider>
)}
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npm run lint && npx tsx tests/unit/i18n-parity.test.ts`
Expected: clean; parity PASS.

Manual: issue a charge doc for an English (USD) client → opens in English LTR. Toggle to Hebrew → same saved doc prints Hebrew RTL **without** changing the snapshot (re-open later → still defaults English). A legacy doc (NULL snapshot) defaults to the client's resolved language.

- [ ] **Step 5: Commit**

```bash
git add "app/[locale]/(auth)/reports/PdfChargeDocument.tsx" "app/[locale]/(auth)/reports/ChargeDocumentView.tsx"
git commit -m "feat(charge-docs): print in snapshotted document language + override toggle"
```

---

### Task 9: Full verification pass

**Files:** none (verification only).

- [ ] **Step 1: Static + unit gates**

Run:
```bash
npx tsc --noEmit
npm run lint
npx tsx tests/unit/document-language.test.ts
npx tsx tests/unit/i18n-parity.test.ts
npm test
```
Expected: all green; zero lint warnings (the CI gate is zero-warning).

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: build succeeds (catches Suspense/SSR and dynamic-import issues).

- [ ] **Step 3: Manual matrix (dev server)**

Verify each cell prints correct chrome language + direction + currency/date formatting, with user-typed content verbatim:

| UI locale | Client setting / currency | Expected document |
|---|---|---|
| `/en` | Auto, ILS | Hebrew RTL |
| `/` (he) | Auto, USD | English LTR |
| `/en` | English, ILS | English LTR |
| any | "all clients" report | UI locale, toggle overrides |
| any | issued charge doc, toggle flipped | flips print only; snapshot unchanged on reload |

- [ ] **Step 4: Final commit (if any fixes)**

```bash
git add -A
git commit -m "chore(reports): verification fixes for document-language feature"
```

---

## Notes for the implementer

- **Prod migration:** `0026` is applied to **dev** in Task 2. The **prod** apply (same SQL via `DATABASE_URL_ADMIN` against the prod/Neon `main` branch) happens **at deploy time**, not during implementation. Flag it in the PR description.
- **No backfill:** existing clients (NULL) → Auto; existing charge docs (NULL) → resolve live. Do not write a backfill.
- **Excel route is unchanged** — it already builds locale-keyed labels from its `?locale=` param; Task 7 just passes `docLocale` instead of the UI locale.
- **PDF stays light-mode** (documented exception) — do not tokenize the PDF template colors.
- **Watch for next-intl `timeZone`/`now` warnings** from the nested provider; mirror whatever the root provider passes.
