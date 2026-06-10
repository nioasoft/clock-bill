# Per-Session Billing via Unit Labels + Profession Starter Items — Design

> Status: approved (brainstorming). Next: implementation plan. Date: 2026-06-09.
> Branch: `feat/session-unit-labels`. Builds on the shipped profession-onboarding feature.

## 1. Summary

Make Monit feel native for **per-session / per-unit** professions (therapist, tutor,
fitness-trainer, translator, writer, photographer) **without** a new billing concept.

Decision (from brainstorming): a "session" is **an item priced per session** — the item
model already does flat-price × quantity with no rounding. The only thing missing is a
**`unit` label** so a rate/line reads "3 × פגישה" instead of a generic "item", plus
**profession starter item-templates** that seed a ready "פגישה" / "יום צילום" / "מילה"
rate on the user's first client. No timer→session flow (the user confirmed "add a
session manually is enough"), so **no new `billingKind`** — sessions ride entirely on the
existing `item` infrastructure.

In scope this round: **(1) `unit` labels end-to-end, (2) profession starter item-templates,
(3) a "pre-VAT" note.** Deferred: profession task/tag presets (`custom_tags` has no
existing create/consume path — needs its own investigation), packages/punch-card balances,
a distinct `session` billing kind, and any VAT calculation.

## 2. Data model (one psql migration — DEV first, PROD on owner approval)

All new columns are **nullable** → backward-compatible (existing items keep working; a null
`unit` falls back to today's generic "items" label).

- `client_rates.unit text` — the per-unit noun for a rate (`"פגישה"`, `"מילה"`, `"יום"`).
  Hourly rates leave it null (the unit is implicitly "שעה" and not shown).
- `time_entries.unit text` — **snapshot at log time** (mirrors the existing `rate_label`
  snapshot) so reports/charge-docs stay correct after a rate is edited or deleted.
- `charge_document_lines.unit text` — snapshot into issued charge/settlement documents so
  the התחשבנות reads "3 פגישות".
- `lib/professions.ts` registry gains `starterItems?: StarterItem[]` where
  `StarterItem = { nameHe: string; nameEn: string; unitHe: string; unitEn: string }`.

Migration applied via **psql + `DATABASE_URL_ADMIN`** (Drizzle journal is drifted — never
`db:migrate`/`db:push`). DEV from `.env.local`; PROD from `.env.local.bak.prod-shared`
only after explicit owner (benatia.asaf@gmail.com) approval. `src/db/schema.ts` updated to
match (descriptive).

## 3. `unit` label — end to end

1. **Rate schema** (`lib/schemas/rates.ts`): `ClientRateInput` + `clientRateSchema` gain an
   optional `unit: z.string().trim().max(30).optional()` (and the `addClientItemSchema`
   used by `POST /api/clients/[id]/rates`). Hourly rates ignore it.
2. **Rates editor** (`components/client-rates-editor.tsx`): each **item** row gets a small
   `unit` text input (placeholder: "יחידה — פגישה / מילה / יום"). Hourly rows: no unit
   field. Design tokens only, RTL.
3. **Persisting rates**: the client create/update routes (`app/api/clients/route.ts`
   rates handling, `app/api/clients/[id]/rates`) read/write `client_rates.unit`.
4. **Entry logging snapshots unit**: when an item entry is created (`POST /api/entries`,
   and any path that logs an item from a rate), snapshot the rate's `unit` onto
   `time_entries.unit` alongside `rate_label`. **Note the snapshot mechanics:** `rate_label`
   is *client-sent* in the request body (the server never resolves it from `client_rates`),
   so `unit` rides the same path — the entry-form UI that offers item rates must send the
   selected rate's `unit` in the POST body. The entries Zod schema + INSERT gain `unit`,
   and **`PUT /api/entries/[id]` persists `unit` the same way it already persists
   `rate_label`** (otherwise editing an entry silently drops its unit). GET endpoints that
   return entries include `unit`.
5. **Charge documents**: `BillableEntry` + `ChargeLineDraft` (`lib/charge-documents.ts`)
   gain `unit`; `buildLineFromEntry` copies the entry's `unit` into the draft (amount math
   unchanged — still `quantity × rate`, no rounding). The charge-document create route
   inserts `unit` into `charge_document_lines`. The billable query selects `te.unit`.
6. **Rendering**: in `BillableTab`, the reports route output, and `ChargeDocumentView`,
   item lines render the quantity with the unit — "N × <unit>" (e.g. "3 × פגישה"). Where
   today the code shows the generic `t("units.items", {count})`, prefer the line's `unit`
   when present, else fall back to the existing generic label. Hourly lines unchanged.
   **Scope guard — aggregated rows stay generic:** summary rows that sum `totalQuantity`
   across entries (e.g. `AdHocReportTab` by-label/by-client rows) may mix units
   (3 פגישה + 200 מילה), so they keep the generic "יח׳" label this round; only
   per-entry/per-line rendering is unit-aware.

## 4. Profession starter item-templates

- **Registry**: add `starterItems` to the relevant presets:
  - therapist, health-pro → `{ nameHe: "פגישה", unitHe: "פגישה" }` (+ en: "Session"/"session")
  - tutor → "שיעור" / unit "שיעור" (en "Lesson"/"lesson")
  - fitness-trainer → "אימון" / unit "אימון" (en "Session"/"session")
  - photographer → "יום צילום" / unit "יום" (en "Shoot day"/"day")
  - translator → "תרגום" / unit "מילה" (en "Translation"/"word")
  - writer → "כתיבת תוכן" / unit "מילה" (en "Content"/"word")
  - all others → no `starterItems`.
- **New-client prefill**: in the new-client form (`app/[locale]/clients/page.tsx`), when
  creating a client (not editing) AND the user's profession has `starterItems` AND the
  rates list is empty, prefill the `ClientRatesEditor` with the starter item row(s) —
  `kind: "item"`, `name` + `unit` from the registry (localized by current locale),
  **`rate: 0` / price blank** for the user to fill. One-time default; the user can edit or
  remove the row. Reads `profile.profession` (already fetched for the retainer prefill).
  Must NOT prefill on the edit path, and must not clobber a row the user already added.

## 5. Pre-VAT note

A static, explanatory line (no calculation): "כל הסכומים הם לפני מע"מ" / "All amounts are
pre-VAT", shown on the report view and the charge-document view, plus a one-line hint in
the rates editor. i18n keys in both `messages/he.json` + `messages/en.json` (parity).

## 6. Testing

- `lib/charge-documents.ts`: `buildLineFromEntry` carries `unit` through to the draft;
  amount is unchanged for item and hourly. (Unit test.)
- `lib/schemas/rates.ts`: schema accepts an optional `unit`, trims, rejects >30 chars;
  rates without `unit` still validate. (Unit test.)
- `lib/professions.ts`: registry-integrity test — every `starterItems` entry (when present)
  has non-empty he/en name + unit. (Extend `professions.test.ts`.)
- Messages parity stays green.

## 7. i18n / design / migration notes

- New strings in he+en with parity: rates-editor unit placeholder, the pre-VAT note, and a
  unit-aware quantity label if a new key is needed (else reuse/extend `units.items`).
- Design tokens only (`text-foreground`, etc.); RTL; legible on light themes.
- Migration is backward-compatible; deploy order doesn't matter (old code ignores the new
  nullable columns), but PROD migration still happens before merge per convention.

## 8. Out of scope (deferred, logged)

- **Profession task/tag presets** — `custom_tags` has no create/consume path in the code;
  needs its own small spec.
- A distinct `billingKind = "session"` — explicitly rejected; sessions are items + unit.
- Packages / punch-card prepaid-balance tracking.
- Israeli business-status (עוסק פטור/מורשה) axis + any VAT computation — out; the only
  VAT-related change is the static "pre-VAT" note in §5.
- `unit` on hourly rates (always "שעה", not shown).
