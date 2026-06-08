# Profession Onboarding + Billing-Base Cascade — Design

> Status: approved (brainstorming). Next: implementation plan (writing-plans).
> Date: 2026-06-08. Branch: `feat/profession-onboarding-billing-cascade`.

## 1. Summary

After signup, a new Monit user starts with a **blank billing base**. The first time
they reach the dashboard, a dismissible **onboarding modal** lets them set their
billing rules in one step:

- **Profession** — picking a profession applies a smart **preset** (billing rounding,
  payment terms, PDF template).
- **Currency** — **geo-suggested** from the request country (IL→ILS, EU→EUR, US→USD),
  editable.
- **Default hourly rate** — the user types their standard rate (e.g. ₪400).
- **Rounding** — prefilled from the profession preset, editable.

These four become the user's **base**. Below the base, a **3-tier cascade** lets each
client and project override:

> The user sets the base. **Client overrides base, project overrides client.**
> A level with nothing set inherits from the level above.

Everything is fully editable later in Settings. The profession is just a smart starting
point, never a lock.

## 2. The cascade (core architecture)

| field | base (profile) | client override | project override | resolved when | history-safe? |
|---|---|---|---|---|---|
| **rounding** | `user_profiles.default_billing_rounding` | `clients.billing_rounding` | `projects.billing_rounding` | report / billing time | ✅ never stored on the entry |
| **hourly rate** | `user_profiles.default_rate` *(new)* | `clients.default_rate` | *(task carries its chosen rate)* | entry log → **snapshot** into `time_entries.rate` | ✅ snapshot freezes history |
| **currency** | `user_profiles.default_currency` *(exists)* | `clients.currency` | — | client creation / display | ✅ client-level |

**`NULL` at any level means "inherit from above."** Resolution functions fall through:

```
rounding:  project ?? client ?? profile ?? 'none'
rate:      task    ?? client ?? profile            (then snapshotted at log time)
currency:  client  ?? profile ?? 'ILS'
```

### Why each field is history-safe
- **Rounding** is a billing *convention* applied at report/charge-doc time and is never
  written onto a time entry (see `lib/rounding.ts` header). Changing the base re-affects
  inheriting clients/projects' *future and regenerated* billing — identical semantics to
  today's existing client→project cascade, just one level higher.
- **Rate** is resolved when a task/entry is created and then **snapshotted** to
  `time_entries.rate` ("immune to later edits"). Changing the base rate tomorrow does not
  touch entries already logged today.
- **Currency** lives on the client and is chosen at client creation; existing clients keep
  their explicit value.

### Required change for the cascade to take effect
Today a new client is created with **hardcoded** `billing_rounding = 'none'` and
`currency = 'ILS'` (see `app/api/clients/route.ts`). For the base to cascade, a new client
created **without an explicit choice** must store **`NULL` (= inherit)** for these fields
instead. **Existing clients keep their current explicit values → no retroactive change for
current users.** Only newly created clients inherit the base.

## 3. Onboarding modal

- **Trigger:** dismissible modal shown on first dashboard entry when
  `profile.onboarded === false`. The dashboard is already authenticated and not SSG, so
  there is **zero SSG risk** (pricing/login stay untouched — no `cookies()`/`getUser()` in
  the root layout).
- **New-users-only** is enforced by the migration: add `onboarded boolean default false`,
  then backfill `UPDATE user_profiles SET onboarded = true` for all existing rows. New
  signups keep the `false` default → only they see the modal.
- **Fields:**
  1. Profession card grid → applies preset (rounding + payment terms + PDF template).
  2. Currency selector — prefilled from `GET /api/geo`, editable.
  3. Default hourly rate — numeric input.
  4. Rounding — prefilled from the chosen profession, editable.
- **Submit:** `PATCH /api/profile { profession, defaultCurrency, defaultRate,
  defaultBillingRounding, onboarded: true }` → success toast → modal closes.
- **Skip ("דלג" / X):** `PATCH /api/profile { onboarded: true }` — base stays blank, never
  nags again.
- **4 UX states:** the modal is the success path; a PATCH failure shows an **inline Hebrew
  error + retry** and the modal stays open (never a silent dismiss). Loading state on the
  submit button (`disabled` + spinner) to prevent double submit.

### Geo currency suggestion
- `GET /api/geo` reads Vercel's `x-vercel-ip-country` request header → maps to a currency:
  `IL → ILS`, EU member countries `→ EUR`, `US → USD`, everything else `→ ILS`.
- **Suggestion only.** The modal prefills the currency selector with it; the user always
  sees and confirms it. Never silently auto-applied.
- Dev / no header present → falls back to `ILS`.

## 4. Profession registry — `lib/professions.ts`

Single source of truth, mirroring `lib/themes.ts`. Adding a profession = one record.

```ts
export interface ProfessionDefaults {
  defaultBillingRounding: RoundingMode;   // applied to profile base
  paymentTerms: string | null;            // Hebrew text, e.g. "שוטף+30"
  preferredPdfTemplate: string;           // existing template id
}

export interface Profession {
  id: string;                 // 'lawyer', 'accountant', ...
  labelHe: string;
  labelEn: string;
  /** Descriptive, NOT applied — orients the user (e.g. "מתאים לחיוב שעתי"). */
  modelHintHe: string;
  modelHintEn: string;
  defaults: ProfessionDefaults;
}
```

**Presets set rounding + payment terms + PDF template only.** They do **not** set:
- **currency** — comes from geo + user confirmation.
- **rate** — user-typed.
- **theme** — a personal aesthetic choice; untouched (default `dark`).
- **billing model** (hourly/retainer/fixed) — lives on client/project, has no profile-level
  field. Shown as **descriptive text only** (`modelHint*`) on the card to orient the user;
  not applied in v1. (Applying it would mean prefilling the new-client form — a separate,
  larger feature.)

### v1 preset table (research-corrected)

| id | labelHe | rounding | payment terms | PDF template | model hint (descriptive) |
|---|---|---|---|---|---|
| `lawyer` | עו"ד | `tenth_hour_up` | שוטף+30 | classic | חיוב שעתי |
| `accountant` | רו"ח / יועץ מס | `tenth_hour_up` | שוטף+30 | classic | ריטיינר חודשי |
| `consultant` | יועץ עסקי / מאמן | `half_hour_up` | שוטף+30 | modern | ריטיינר / שעתי |
| `developer` | מפתח תוכנה | `none` | שוטף+30 | modern | שעתי / ריטיינר |
| `designer` | מעצב גרפי / UX | `none` | שוטף+30 | modern | פרויקט / fixed |
| `photographer` | צלם / וידאו | `none` | שוטף+30 | modern | fixed (יום צילום) |
| `writer` | כותב תוכן / קופירייטר | `none` | שוטף+30 | modern | item / שעתי |
| `other` | אחר / כללי | `none` | null | modern | — |

> Research basis (2026): lawyers/accountants bill in **6-minute (tenths)** increments, the
> real industry standard (not 15 min). Creatives (designers/photographers) prefer
> project/fixed over hourly, so their model hint reflects that. Increments and presets are
> all overridable.

## 5. Rounding extension — `lib/rounding.ts`

Add two modes to the existing `none / hour_up / half_hour_up`:
- `tenth_hour_up` — 6 minutes: `Math.ceil(minutes / 6) * 6`
- `quarter_hour_up` — 15 minutes: `Math.ceil(minutes / 15) * 15`

Final ordered set (smallest→largest): `none`, `tenth_hour_up`, `quarter_hour_up`,
`half_hour_up`, `hour_up`.

Changes:
- `RoundingMode` type + `ROUNDING_MODES` array.
- `asRoundingMode()` — accept the two new values.
- `resolveRounding(projectMode, clientMode, profileMode)` — **add the third (profile)
  argument** as the lowest-priority fallback. All callers updated to pass the profile base.
- `roundBillableMinutes()` — handle the two new modes.

## 6. Schema changes

Applied via **psql + `DATABASE_URL_ADMIN`** (Drizzle journal is drifted — do NOT use
`db:migrate`). `src/db/schema.ts` updated to match. **DEV first; PROD only after the owner
(benatia.asaf@gmail.com) approves**, per project convention.

`user_profiles`:
- `+ profession text` (nullable) — chosen preset id; persisted for record/future analytics.
- `+ default_rate real` (nullable) — base hourly rate.
- `+ default_billing_rounding text NOT NULL DEFAULT 'none'` — CHECK in the 5-mode set.
- `+ onboarded boolean NOT NULL DEFAULT false` — then backfill existing rows to `true`.

`clients` / `projects`:
- Widen the `billing_rounding` CHECK constraints to the 5-mode set.
- New clients default `billing_rounding` and `currency` to **`NULL`** (inherit) — change in
  `app/api/clients/route.ts`, not a column default change for existing rows.

`lib/currency.ts`:
- `+ EUR: "€"` in `CURRENCY_SYMBOLS` (Intl formats EUR natively as a real ISO code).
- Add `EUR` to the currency picker option list.

## 7. API changes

`app/api/profile/route.ts` (PATCH) — extend the Zod schema + dynamic update builder:
- `profession` — validated server-side against the registry allow-list (mirror `isThemeId`).
- `defaultRate` — `number` nullable.
- `defaultBillingRounding` — validated against `ROUNDING_MODES`.
- `onboarded` — boolean.
- GET returns the new fields.

`app/api/clients/route.ts` (POST):
- Widen the `billingRounding` Zod enum to 5 modes.
- When `billingRounding` / `currency` are absent, insert `NULL` (inherit) instead of
  `'none'` / `'ILS'`.

`app/api/geo/route.ts` (new, GET):
- Reads `x-vercel-ip-country`, returns `{ country, suggestedCurrency }`.

Billing/report resolution call sites (reports, charge documents, anywhere
`resolveRounding` is used) updated to pass the profile base as the third argument.

## 8. i18n + design

- `messages/he.json` + `messages/en.json` — keep **parity** (there is a parity test):
  modal copy, profession labels + model hints, new rounding-mode labels under the
  `Rounding` namespace (`tenth_hour_up`, `quarter_hour_up`), EUR.
- **Design tokens only.** Use `text-foreground` (never `text-white`), semantic surfaces,
  hairline borders, no hardcoded hex. **Verify the modal in-browser on a LIGHT theme**
  before considering it done (the lesson from the Theme Set feature).
- RTL: logical properties; verify the card grid, selectors, and toast in RTL.

## 9. Testing (TDD on pure logic)

- `tests/unit/rounding.test.ts` — the two new modes; `resolveRounding` 3-tier fall-through
  (project > client > profile > 'none'); existing modes unchanged.
- `tests/unit/professions.test.ts` — registry integrity: every preset's
  `defaultBillingRounding` ∈ `ROUNDING_MODES`, `preferredPdfTemplate` is a valid template,
  ids unique, he/en labels present.
- `tests/unit/geo.test.ts` — country→currency mapping (IL/US/EU members/unknown).
- Profile validation — the new PATCH fields accept valid / reject invalid input.
- Messages parity test stays green.

## 10. Scope boundaries (YAGNI)

In v1:
- Onboarding for **new users only**. Existing users get nothing now; a Settings "choose
  profession" entry point is a possible follow-up, not v1.
- Billing **model** is descriptive only — not applied.
- Rate cascade has **no project tier** (task carries the chosen rate); only profile→client.
- Currency cascade is profile→client (no project tier).
- No retroactive application of a changed base to existing clients (they keep explicit
  values; only inheriting/new ones follow the base).

## 11. Open risks / notes

- `GET /api/geo` only resolves a country on Vercel (prod). Local dev returns the ILS
  fallback — acceptable.
- Widening the rounding CHECK constraints must run **before** any preset can write
  `tenth_hour_up`/`quarter_hour_up`.
- All preset values and the geo suggestion are **overridable** — this is the guiding
  principle; never a hard lock.
