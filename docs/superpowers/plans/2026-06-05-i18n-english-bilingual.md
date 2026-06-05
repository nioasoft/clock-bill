# Bilingual (Hebrew + English) i18n Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add full English (LTR) support alongside the existing Hebrew (RTL) UI of מוניט/Monit, using URL-based locale routing (`/dashboard` = Hebrew, `/en/dashboard` = English), so the product is internationally discoverable (SEO) and shareable.

**Architecture:** `next-intl` v4 with the App Router `[locale]` segment and `localePrefix: 'as-needed'` — Hebrew (default) keeps its current prefix-less URLs (existing links, PWA, SEO untouched), English gets a `/en` prefix. All app routes move under `app/[locale]/`; `app/api/*` stays put. Navigation swaps to next-intl's locale-aware `Link`/`useRouter` wrappers so the ~74 hardcoded paths stay written as `/dashboard` but get prefixed automatically. The server returns **error codes** (not Hebrew strings); the client maps them to localized messages. Formatting moves to `Intl`/next-intl. `dir`/`lang` become dynamic. The app stays 100% functional in Hebrew at every single commit.

**Tech Stack:** Next.js 16 (App Router, RSC), TypeScript strict, Tailwind v4, next-intl v4, Better Auth, Drizzle/Postgres (Neon), custom test runner (`tests/run-tests.ts` via `tsx`), Playwright for E2E.

---

## Why `localePrefix: 'as-needed'` is the keystone decision

The deep investigation found the app has **no middleware**, a **single root layout**, **74 hardcoded paths**, and a **PWA manifest with hardcoded `start_url: /dashboard`**. A naive always-prefixed `[locale]` strategy would break all of those.

`as-needed` makes Hebrew (the `defaultLocale`) render at the **same URLs it has today** (`/dashboard`, not `/he/dashboard`). Consequences that shrink the blast radius:
- Existing Hebrew links, bookmarks, SEO, and the PWA `start_url` keep working **unchanged**.
- Only the **new** `/en/*` URLs are added.
- The folder move to `app/[locale]/` is structural, but the *runtime URLs* for Hebrew don't change.

This is the single biggest risk-reducer and every later phase depends on it.

---

## Branch Strategy

- Base off `main`. Create `feat/i18n-english`.
- The app must build and pass tests at the end of **every task**. Hebrew must remain fully working throughout — English is allowed to be incomplete (showing Hebrew fallback or keys) until its phase lands.
- Commit after every task (bite-sized). Open the PR only after Phase 0 + Phase 1 are green (the app is demonstrably bilingual for the core), then stack the remaining phases.
- DB migration (Phase 3, `locale` column) uses `DATABASE_URL_ADMIN` per project convention (see CLAUDE.md / memory `drizzle-meta-drift`: apply via psql, not `db:migrate`).

---

## Locked Architecture Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Library | next-intl v4 | App Router/RSC native, ICU plurals (Hebrew needs them), built-in Intl formatting, works with `[locale]`. |
| Routing | `[locale]` segment, `localePrefix: 'as-needed'` | SEO + shareable, Hebrew URLs unchanged. |
| Locales | `['he', 'en']`, `defaultLocale: 'he'` | Hebrew is primary. |
| Locale detection | URL → cookie (`NEXT_LOCALE`) → `user_profiles.locale` → `Accept-Language` → default | next-intl middleware handles URL+cookie+header; user pref syncs the cookie on login. |
| Server messages | Error codes + client-side mapping | Client already displays `data.message` directly with Hebrew fallback → clean refactor; no per-request server translation. |
| Formatting | `Intl` via next-intl `useFormatter`/`getFormatter`; custom crypto symbols | DB already stores raw numbers; no migration needed for formatting. |
| `dir`/`lang` | Dynamic in `app/[locale]/layout.tsx` | `dir={locale === 'he' ? 'rtl' : 'ltr'}`. |
| Translation key style | Namespaced, screen/feature-scoped (`Settings.profile.title`, `errors.UNAUTHORIZED`, `common.save`) | Matches file/feature decomposition; ICU for plurals. |

---

## File Structure (new + moved)

**New files:**
- `src/i18n/routing.ts` — `defineRouting` (locales, defaultLocale, localePrefix).
- `src/i18n/request.ts` — `getRequestConfig` (loads messages per locale).
- `src/i18n/navigation.ts` — `createNavigation` wrappers (`Link`, `useRouter`, `usePathname`, `redirect`, `getPathname`).
- `middleware.ts` (repo root) — `createMiddleware(routing)` + matcher excluding `/api`, `/_next`, static assets, `sw.js`, `manifest`.
- `messages/he.json`, `messages/en.json` — translation catalogs (namespaced).
- `lib/error-codes.ts` — `ERROR_CODES` enum + `ApiError` response helper.
- `lib/i18n/locale-cookie.ts` — read/write `NEXT_LOCALE` cookie + sync helper.
- `components/locale-switcher.tsx` — He/En toggle.
- `tests/unit/error-codes.test.ts`, `tests/unit/currency-format.test.ts`, `tests/unit/messages-parity.test.ts` — unit tests (custom runner).
- `tests/e2e/locale-routing.spec.ts` — Playwright smoke for both locales.

**Moved:**
- Everything currently directly under `app/` that is a **page/route** moves under `app/[locale]/` — EXCEPT `app/api/**` (stays), `app/manifest.ts`, `app/sitemap.ts` (new), `app/robots.ts` (new), and global files Next requires at root (`app/global-error.tsx` stays at root but becomes locale-aware via cookie).
- `next.config.mjs` — wrap with `createNextIntlPlugin('./src/i18n/request.ts')`.

**Modified (high-traffic):**
- `app/[locale]/layout.tsx` (was `app/layout.tsx`) — dynamic `lang`/`dir`, `setRequestLocale`, `NextIntlClientProvider`, locale-aware metadata.
- `lib/nav-items.ts`, `components/sidebar.tsx`, `components/mobile-bottom-nav.tsx`, `components/breadcrumb.tsx`, `components/global-search.tsx` — swap to `@/i18n/navigation`, externalize labels.
- `lib/format.ts`, `lib/currency.ts` — locale-aware.
- `app/api/**/route.ts` (51 files) — return `error_code`.
- `lib/auth/better-auth.ts`, `lib/email.ts`, `lib/notifications.ts`, `lib/env.ts` — localize / externalize.
- Reports subsystem (`app/[locale]/(auth)/reports/*`, `printStyles.ts`, `pdf-*.css`, `app/api/reports/excel/route.ts`).

---

## Phase Map (independently shippable; Hebrew never breaks)

| Phase | Scope | Est. | Gate |
|---|---|---|---|
| **0** | Infrastructure: next-intl wiring, `[locale]` move, middleware, dynamic dir, locale switcher | 3–4 d | App renders identically in Hebrew at `/`; `/en/*` renders (untranslated = Hebrew fallback). |
| **1** | Core string externalization (dashboard, timer, tasks, clients, projects, entries, settings, auth, nav) | 8–10 d | Core app fully English at `/en/*`. |
| **2** | Formatting layer (`format.ts`, `currency.ts`, call sites) | 4–5 d | Dates/numbers/currency localize per locale. |
| **3** | Server error codes + Better Auth emails + notifications + `locale` column | 3–4 d | API errors localized client-side; emails respect user locale. |
| **4** | Reports / PDF / Excel / email documents (bidirectional) | 6–8 d | Bilingual report + charge-doc + Excel export. |
| **5** | Marketing/legal pages + SEO (metadata, OG, sitemap, hreflang) + PWA manifest | 2–3 d | `/en` landing + `hreflang` + localized OG. |
| **6** | RTL→LTR visual QA sweep (~38 hardcodes) + E2E | 3–4 d | No LTR layout breakage; Playwright green both locales. |

---

# PHASE 0 — Infrastructure (fully bite-sized)

**Files:**
- Create: `src/i18n/routing.ts`, `src/i18n/request.ts`, `src/i18n/navigation.ts`, `middleware.ts`, `messages/he.json`, `messages/en.json`
- Modify: `next.config.mjs`, move `app/layout.tsx` → `app/[locale]/layout.tsx`, move all page routes under `app/[locale]/`
- Test: `tests/unit/messages-parity.test.ts`, `tests/e2e/locale-routing.spec.ts`

### Task 0.1: Install next-intl

- [ ] **Step 1: Install**

```bash
npm install next-intl
```

- [ ] **Step 2: Verify version is v4+**

Run: `node -e "console.log(require('next-intl/package.json').version)"`
Expected: `4.x.x`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(i18n): add next-intl dependency"
```

### Task 0.2: Routing config

- [ ] **Step 1: Create `src/i18n/routing.ts`**

```ts
import {defineRouting} from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['he', 'en'],
  defaultLocale: 'he',
  // Hebrew (default) stays prefix-less: /dashboard. English gets /en/dashboard.
  localePrefix: 'as-needed',
  // Persist the chosen locale so a returning visitor keeps it.
  localeCookie: {name: 'NEXT_LOCALE'},
});

export type Locale = (typeof routing.locales)[number];
```

- [ ] **Step 2: Create `src/i18n/navigation.ts`**

```ts
import {createNavigation} from 'next-intl/navigation';
import {routing} from './routing';

// Locale-aware wrappers. Importing Link/useRouter from here (instead of
// next/link, next/navigation) auto-prefixes the active locale, so call
// sites keep writing href="/dashboard".
export const {Link, redirect, usePathname, useRouter, getPathname} =
  createNavigation(routing);
```

- [ ] **Step 3: Commit**

```bash
git add src/i18n/routing.ts src/i18n/navigation.ts
git commit -m "feat(i18n): add next-intl routing + navigation config"
```

### Task 0.3: Request config + plugin

- [ ] **Step 1: Create `src/i18n/request.ts`**

```ts
import {getRequestConfig} from 'next-intl/server';
import {hasLocale} from 'next-intl';
import {routing} from './routing';

export default getRequestConfig(async ({requestLocale}) => {
  const requested = await requestLocale; // maps to the [locale] segment
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
```

- [ ] **Step 2: Wrap `next.config.mjs` with the plugin**

Note: project config is ESM `.mjs` (see memory `ci-lint-baseline`). Wrap the existing default export.

```js
// next.config.mjs
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ...existing config unchanged...
};

export default withNextIntl(nextConfig);
```

- [ ] **Step 3: Create initial `messages/he.json` and `messages/en.json`**

Start with one shared namespace so the provider has something to load.

```json
// messages/he.json
{
  "common": {
    "save": "שמור",
    "cancel": "ביטול",
    "delete": "מחק",
    "edit": "ערוך",
    "loading": "טוען...",
    "skipToMain": "דלג לתוכן ראשי"
  }
}
```

```json
// messages/en.json
{
  "common": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "edit": "Edit",
    "loading": "Loading...",
    "skipToMain": "Skip to main content"
  }
}
```

- [ ] **Step 4: Verify build compiles**

Run: `npm run build`
Expected: build succeeds (no usage yet, just wiring).

- [ ] **Step 5: Commit**

```bash
git add src/i18n/request.ts next.config.mjs messages/
git commit -m "feat(i18n): wire next-intl request config + plugin + seed messages"
```

### Task 0.4: Middleware

- [ ] **Step 1: Create `middleware.ts` at repo root**

The matcher MUST exclude `/api` (Better Auth handler + all API routes stay locale-free), `/_next`, static files, `sw.js`, and `manifest`.

```ts
import createMiddleware from 'next-intl/middleware';
import {routing} from './src/i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Match all paths except API, Next internals, static files, SW, manifest.
  matcher: [
    '/((?!api|_next|_vercel|sw\\.js|manifest\\.webmanifest|.*\\..*).*)',
  ],
};
```

- [ ] **Step 2: Manually verify API + SW are untouched**

Run: `npm run dev`, then:
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/auth/session   # expect 200/401, NOT a locale redirect (3xx to /he/...)
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/sw.js              # expect 200
```
Expected: API and `sw.js` return normally with no locale rewrite.

- [ ] **Step 3: Commit**

```bash
git add middleware.ts
git commit -m "feat(i18n): add locale middleware (excludes api/_next/sw/manifest)"
```

### Task 0.5: Move routes under `app/[locale]/`

This is structural. Do it as ONE mechanical move so history is clean.

- [ ] **Step 1: Create the segment and move page routes**

Move every page route directory and the root layout into `app/[locale]/`. Keep `app/api`, `app/manifest.ts`, `app/global-error.tsx`, `app/not-found.tsx` where Next requires them.

```bash
mkdir -p "app/[locale]"
# Move page routes (NOT api, NOT manifest, NOT global-error/not-found):
git mv app/layout.tsx "app/[locale]/layout.tsx"
git mv app/page.tsx "app/[locale]/page.tsx"
git mv app/globals.css "app/[locale]/globals.css"  # if imported by layout; else leave + fix import
for d in login register forgot-password reset-password privacy terms contact offline \
         dashboard entries tasks clients projects settings feedback admin "(auth)"; do
  [ -e "app/$d" ] && git mv "app/$d" "app/[locale]/$d"
done
```

> NOTE FOR IMPLEMENTER: confirm the exact route directory list against `app/` before running — the deep-investigation route tree lists: `login, register, forgot-password, reset-password, privacy, terms, contact, offline, dashboard, entries, tasks, clients, projects, settings, feedback, admin, (auth)/reports`. Adjust the loop to the real directories. Keep `globals.css` import path consistent.

- [ ] **Step 2: Fix `globals.css` and any relative imports broken by the move**

Update import paths in the moved `layout.tsx` (e.g. `./globals.css` still resolves if moved together; otherwise point to the new location).

- [ ] **Step 3: Build to surface broken imports**

Run: `npm run build`
Expected: FAIL initially with import errors — fix each until it builds. (This is the move's cost; resolve all path breaks.)

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(i18n): move page routes under app/[locale] segment"
```

### Task 0.6: Locale-aware root layout

- [ ] **Step 1: Rewrite `app/[locale]/layout.tsx`**

Make `lang`/`dir` dynamic, validate the locale, enable static rendering, wrap with the provider. Preserve ALL existing providers (TimerProvider, PwaProvider, Toaster, Analytics, SpeedInsights) and the skip-link.

```tsx
import {NextIntlClientProvider, hasLocale} from 'next-intl';
import {setRequestLocale, getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {routing} from '@/src/i18n/routing';
// ...existing imports: fonts, Providers, PwaProvider, Toaster, Analytics, SpeedInsights, globals.css

type Props = {
  children: React.ReactNode;
  params: Promise<{locale: string}>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({locale}));
}

export default async function LocaleLayout({children, params}: Props) {
  const {locale} = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations('common');
  const dir = locale === 'he' ? 'rtl' : 'ltr';

  return (
    <html lang={locale} dir={dir}>
      <body className={/* existing font classes */ undefined}>
        <a href="#main-content" className="skip-to-main">{t('skipToMain')}</a>
        <NextIntlClientProvider>
          <Providers>
            <main id="main-content">{children}</main>
          </Providers>
        </NextIntlClientProvider>
        <PwaProvider />
        <Toaster />
        {/* Analytics, SpeedInsights */}
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Make metadata locale-aware**

Convert the static `metadata` export to `generateMetadata({params})` that pulls title/description from the `Meta` namespace and sets `openGraph.locale` (`he_IL` / `en_US`) + `alternates.languages` for hreflang.

```tsx
import type {Metadata} from 'next';
import {getTranslations} from 'next-intl/server';

export async function generateMetadata({params}: {params: Promise<{locale: string}>}): Promise<Metadata> {
  const {locale} = await params;
  const t = await getTranslations({locale, namespace: 'Meta'});
  return {
    title: t('title'),
    description: t('description'),
    openGraph: {locale: locale === 'he' ? 'he_IL' : 'en_US'},
    alternates: {languages: {he: '/', en: '/en'}},
  };
}
```

Add the `Meta` namespace to both message files (title/description from the current Hebrew metadata + English translations).

- [ ] **Step 3: Build + manual smoke**

Run: `npm run build && npm run dev`
- Visit `http://localhost:3000/` → Hebrew, `dir="rtl"`, identical to today.
- Visit `http://localhost:3000/en` → renders with `dir="ltr"` (most strings still Hebrew = fallback; that's expected until Phase 1).

- [ ] **Step 4: Commit**

```bash
git add "app/[locale]/layout.tsx" messages/
git commit -m "feat(i18n): locale-aware root layout (dynamic lang/dir, provider, metadata)"
```

### Task 0.7: Messages parity test (guards every later phase)

- [ ] **Step 1: Write the failing test `tests/unit/messages-parity.test.ts`**

```ts
// Ensures he.json and en.json have identical key trees — no missing/extra keys.
import he from '../../messages/he.json';
import en from '../../messages/en.json';

function flatten(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object'
      ? flatten(v as Record<string, unknown>, `${prefix}${k}.`)
      : [`${prefix}${k}`]
  );
}

export function run() {
  const heKeys = new Set(flatten(he));
  const enKeys = new Set(flatten(en));
  const missingInEn = [...heKeys].filter((k) => !enKeys.has(k));
  const missingInHe = [...enKeys].filter((k) => !heKeys.has(k));
  if (missingInEn.length || missingInHe.length) {
    throw new Error(
      `Message key mismatch.\nMissing in en: ${missingInEn.join(', ')}\nMissing in he: ${missingInHe.join(', ')}`
    );
  }
  console.log(`messages-parity: OK (${heKeys.size} keys)`);
}
```

> NOTE: match the actual signature of `tests/run-tests.ts` (read it first — it uses `tsx`, not Jest). If it expects a default export or a specific harness, adapt this `run()` accordingly.

- [ ] **Step 2: Run it — expect PASS** (seed catalogs are in parity)

Run: `npx tsx tests/unit/messages-parity.test.ts`
Expected: `messages-parity: OK`

- [ ] **Step 3: Wire into the suite**

Add the test to `tests/run-tests.ts` registration (follow the existing pattern there).

- [ ] **Step 4: Commit**

```bash
git add tests/
git commit -m "test(i18n): add he/en message-key parity guard"
```

**Phase 0 gate:** `npm run build` green; `/` is byte-for-byte Hebrew as before; `/en` renders LTR with fallback; API/SW unaffected; parity test in CI.

---

# PHASE 1 — Core String Externalization (recipe-driven)

> SCOPE-CHECK NOTE: ~1,600 strings across ~92 files is mechanical repetition, not 1,600 unique design decisions. Per the writing-plans scope guidance, this phase is specified as a **precise recipe + a worked example + a file inventory with namespaces**, not as 1,600 enumerated steps. Each file is one commit. The parity test (Task 0.7) is the safety net.

**Namespace convention:** one namespace per screen/feature, dot-nested. Examples: `Dashboard.*`, `Timer.*`, `Tasks.*`, `Clients.*`, `Projects.*`, `Entries.*`, `Settings.*`, `Auth.login.*`, `Nav.*`, `common.*`. Enum label maps that already exist as Hebrew records (`lib/tasks-types.ts` `TASK_STATUS_LABEL`, `lib/rounding.ts` `ROUNDING_LABELS`, `lib/schemas/feedback.ts` `CATEGORY_LABELS_HE`, `lib/tasks-transitions.ts`) become message keys (`Tasks.status.todo`, etc.).

### The Recipe (apply per file)

1. Identify the file's namespace (e.g. `Settings`).
2. For a **Server Component**: `const t = await getTranslations('Settings')`. For a **Client Component**: `import {useTranslations} from 'next-intl'; const t = useTranslations('Settings')`.
3. Replace each inline Hebrew string with `{t('key')}`; move the Hebrew text to `messages/he.json` under that namespace and add the English to `messages/en.json`.
4. **Interpolation:** `` `${count} משימות` `` → `t('taskCount', {count})` with ICU plural in the catalog (see plural rule below).
5. **Swap navigation imports:** in any file using `next/link` or `next/navigation`, change to `@/i18n/navigation` (`Link`, `useRouter`, `usePathname`, `redirect`). Paths stay written as `/dashboard`.
6. Run the parity test + build. Commit.

### ICU Plural rule (Hebrew needs `one`/`two`/`many`/`other`)

The investigation flagged abbreviations (`שע׳`, `דק׳`) used to dodge plurals. With ICU we can do it properly:

```json
// messages/he.json → "Common"
{
  "Common": {
    "hours": "{count, plural, one {שעה} two {שעתיים} other {# שעות}}",
    "minutes": "{count, plural, one {דקה} other {# דקות}}",
    "tasksCount": "{count, plural, one {משימה אחת} two {שתי משימות} other {# משימות}}"
  }
}
```
```json
// messages/en.json → "Common"
{
  "Common": {
    "hours": "{count, plural, one {# hour} other {# hours}}",
    "minutes": "{count, plural, one {# minute} other {# minutes}}",
    "tasksCount": "{count, plural, one {# task} other {# tasks}}"
  }
}
```

### Worked Example (the pattern, fully shown once)

**File:** `app/[locale]/settings/page.tsx` (Client Component)

- [ ] **Step 1 (test-first, behavioral): add the keys, expect parity test to fail then pass**

Add to `messages/he.json`:
```json
"Settings": {
  "title": "הגדרות",
  "save": "שמור שינויים",
  "profileTab": "פרופיל",
  "notificationsTab": "התראות"
}
```
Add the matching English to `messages/en.json`:
```json
"Settings": {
  "title": "Settings",
  "save": "Save changes",
  "profileTab": "Profile",
  "notificationsTab": "Notifications"
}
```
Run: `npx tsx tests/unit/messages-parity.test.ts` → must stay PASS (parity maintained).

- [ ] **Step 2: Replace inline strings in the component**

```tsx
'use client';
import {useTranslations} from 'next-intl';
import {Link, useRouter} from '@/i18n/navigation'; // was next/link, next/navigation

export default function SettingsPage() {
  const t = useTranslations('Settings');
  // ...
  return (
    <h1>{t('title')}</h1>
    // <button>שמור שינויים</button>  ->
    <button>{t('save')}</button>
    // ...tabs, etc.
  );
}
```

- [ ] **Step 3: Build + visual check both locales**

Run: `npm run dev` → `/settings` (Hebrew unchanged) and `/en/settings` (now English for the converted strings).

- [ ] **Step 4: Commit**

```bash
git add "app/[locale]/settings/page.tsx" messages/
git commit -m "feat(i18n): externalize settings page strings"
```

### File Inventory for Phase 1 (heaviest first — one commit each)

Apply the recipe to, in order (counts from investigation):

1. `lib/validation.ts` + `lib/schemas/*.ts` — **highest reuse**, ~37 validation messages → namespace `Validation.*`. Convert the message-returning functions to return **keys**, and translate at the call site (or have them accept a `t`). **Handle gendered/plural edge cases** (`"הוא שדה חובה"`, `"X תווים"`) with ICU.
2. `lib/nav-items.ts`, `lib/tasks-types.ts`, `lib/rounding.ts`, `lib/tasks-transitions.ts`, `lib/schemas/feedback.ts` — enum/label maps → message keys.
3. `app/[locale]/settings/page.tsx` (190 lines) — namespace `Settings`.
4. `app/[locale]/(auth)/reports/AdHocReportTab.tsx` (149) — **defer report-body labels to Phase 4**; only externalize the tab's *UI chrome* here.
5. `app/[locale]/entries/page.tsx` (91) — `Entries`.
6. `app/[locale]/clients/page.tsx` (73), `clients/[id]/page.tsx` (65) — `Clients`.
7. `app/[locale]/projects/page.tsx` (57), `projects/[id]/page.tsx` (73) — `Projects`.
8. `app/[locale]/dashboard/page.tsx`, `app/[locale]/tasks/page.tsx` — `Dashboard`, `Tasks`.
9. Auth pages: `login`, `register`, `forgot-password`, `reset-password` — `Auth.*`.
10. `app/[locale]/admin/**` — `Admin.*`.
11. Components: `components/sidebar.tsx`, `mobile-bottom-nav.tsx`, `breadcrumb.tsx`, `global-search.tsx`, `timer-start-modal.tsx`, `persistent-timer-bar.tsx`, `tasks/task-form-dialog.tsx`, `ui/empty-state.tsx`, etc. — feature namespaces. **Externalize aria-labels too** (screen-reader text must localize).
12. `lib/notifications.ts` (browser notifications, with plurals) — `Notifications.*`.

**Phase 1 gate:** core authed app + auth pages fully English at `/en/*`; every nav link works in both locales; parity test green; no `next/link`/`next/navigation` imports remain in converted files (grep check).

---

# PHASE 2 — Formatting Layer

**Files:** Modify `lib/format.ts`, `lib/currency.ts`, and ~8 call sites using hardcoded `toLocaleDateString("he-IL")`. Test: `tests/unit/currency-format.test.ts`.

### Task 2.1: Locale-aware currency (TDD)

- [ ] **Step 1: Write failing test `tests/unit/currency-format.test.ts`**

```ts
import {formatCurrency} from '../../lib/currency';

export function run() {
  // Fiat via Intl: thousands separators, locale-correct.
  assertEq(formatCurrency(1234.5, 'USD', 'en'), '$1,234.50');
  assertEq(formatCurrency(1234.5, 'ILS', 'he'), '₪1,234.50');
  // Crypto: Intl has no ISO code → custom symbol + grouped number.
  assertEq(formatCurrency(0.12345678, 'BTC', 'en'), '₿0.12345678');
  assertEq(formatCurrency(1000, 'USDT', 'en'), '₮1,000.00');
}
function assertEq(a: string, b: string) { if (a !== b) throw new Error(`${a} !== ${b}`); }
```

Run: `npx tsx tests/unit/currency-format.test.ts` → FAIL (current `formatCurrency` ignores locale, no separators, no locale param).

- [ ] **Step 2: Implement locale-aware `formatCurrency`**

```ts
export const CURRENCY_SYMBOLS: Record<string, string> = {
  ILS: '₪', USD: '$', USDT: '₮', BTC: '₿', ETH: 'Ξ',
};
const FIAT = new Set(['ILS', 'USD']);
const CRYPTO_DECIMALS: Record<string, number> = {USDT: 2, BTC: 8, ETH: 6};

export function formatCurrency(amount: number, currency: string, locale: string = 'he'): string {
  const intlLocale = locale === 'he' ? 'he-IL' : 'en-US';
  if (FIAT.has(currency)) {
    return new Intl.NumberFormat(intlLocale, {style: 'currency', currency}).format(amount);
  }
  // Crypto: Intl has no ISO entry → format the number, prepend the symbol.
  const decimals = CRYPTO_DECIMALS[currency] ?? 2;
  const num = new Intl.NumberFormat(intlLocale, {
    minimumFractionDigits: 2, maximumFractionDigits: decimals,
  }).format(amount);
  return `${CURRENCY_SYMBOLS[currency] ?? currency}${num}`;
}
```

Run the test → PASS.

- [ ] **Step 3: Commit**

```bash
git add lib/currency.ts tests/unit/currency-format.test.ts
git commit -m "feat(i18n): locale-aware currency formatting (fiat via Intl, crypto custom)"
```

### Task 2.2: Locale-aware date/time/duration

- [ ] **Step 1:** Remove the unused `_locale` params in `lib/format.ts`; route date/time through `Intl.DateTimeFormat(intlLocale, …)` honoring the user's stored `dateFormat`/`timeFormat`. Replace `formatDuration`'s hardcoded `שע׳`/`דק׳` with the ICU `Common.hours`/`Common.minutes` messages (caller passes `t`), OR move duration formatting into components using `useTranslations('Common')`.
- [ ] **Step 2:** Replace the ~8 hardcoded `new Date(x).toLocaleDateString("he-IL")` call sites (e.g. `app/[locale]/entries/page.tsx:1243`, `settings/page.tsx:230`) with the locale-aware formatter (via next-intl `useFormatter().dateTime(...)` in components, which already knows the active locale).
- [ ] **Step 3:** Build + verify dates/numbers render correctly at `/` (he) and `/en`.
- [ ] **Step 4:** Commit per file.

**Phase 2 gate:** numbers show thousands separators; dates/durations localize; crypto precision correct; currency test green.

---

# PHASE 3 — Server Error Codes + Emails + Notifications + `locale` column

**Files:** Create `lib/error-codes.ts`; modify 51 `app/api/**/route.ts`; `lib/auth/better-auth.ts`, `lib/email.ts`, `lib/env.ts`; `src/db/schema.ts` (+ migration). Test: `tests/unit/error-codes.test.ts`.

### Task 3.1: Error-code system (TDD)

- [ ] **Step 1: Write failing test `tests/unit/error-codes.test.ts`**

```ts
import {ERROR_CODES, apiError} from '../../lib/error-codes';
import {ERROR_MESSAGES_HE, ERROR_MESSAGES_EN} from '../../lib/error-codes';

export function run() {
  const res = apiError(ERROR_CODES.UNAUTHORIZED, 401);
  // body carries a stable code; message kept for backward-compat fallback.
  // Every code must have a he + en message (no gaps).
  for (const code of Object.values(ERROR_CODES)) {
    if (!ERROR_MESSAGES_HE[code]) throw new Error(`missing he for ${code}`);
    if (!ERROR_MESSAGES_EN[code]) throw new Error(`missing en for ${code}`);
  }
  console.log('error-codes: OK');
}
```

Run → FAIL (module doesn't exist).

- [ ] **Step 2: Implement `lib/error-codes.ts`**

```ts
import {NextResponse} from 'next/server';

export const ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  CLIENT_NOT_FOUND: 'CLIENT_NOT_FOUND',
  PROJECT_NOT_FOUND: 'PROJECT_NOT_FOUND',
  TASK_NOT_FOUND: 'TASK_NOT_FOUND',
  RATE_NOT_FOUND: 'RATE_NOT_FOUND',
  DOC_NOT_FOUND: 'DOC_NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  CURRENCY_MISMATCH: 'CURRENCY_MISMATCH',
  RATE_LIMIT: 'RATE_LIMIT',
  SERVER_ERROR: 'SERVER_ERROR',
  // ...complete the set to cover all 39 unique messages from the audit
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

// Hebrew fallback kept on the wire for backward-compat; client prefers code→i18n.
export const ERROR_MESSAGES_HE: Record<ErrorCode, string> = {
  UNAUTHORIZED: 'לא מחובר',
  CLIENT_NOT_FOUND: 'הלקוח לא נמצא',
  // ...all 39
} as unknown as Record<ErrorCode, string>;

export const ERROR_MESSAGES_EN: Record<ErrorCode, string> = {
  UNAUTHORIZED: 'Not authenticated',
  CLIENT_NOT_FOUND: 'Client not found',
  // ...all 39
} as unknown as Record<ErrorCode, string>;

export function apiError(code: ErrorCode, status: number) {
  return NextResponse.json(
    {success: false, error_code: code, message: ERROR_MESSAGES_HE[code]},
    {status}
  );
}
```

Run test → PASS.

- [ ] **Step 3: Add the `errors` namespace to `messages/{he,en}.json`** (mirror the code→message maps) so the client can localize.

- [ ] **Step 4: Commit**

```bash
git add lib/error-codes.ts messages/ tests/unit/error-codes.test.ts
git commit -m "feat(api): add error-code system with he/en message maps"
```

### Task 3.2: Refactor API routes to error codes

- [ ] **Recipe per route file:** replace `return NextResponse.json({success:false, message:"לא מחובר"}, {status:401})` with `return apiError(ERROR_CODES.UNAUTHORIZED, 401)`. The most common (`"לא מחובר"` ×77, `"הלקוח לא נמצא"` ×103) are mechanical. Commit in logical groups (clients routes, projects routes, charge-documents routes, …).
- [ ] **Client side:** add a small helper `messageForError(data, t)` that prefers `t('errors.' + data.error_code)` and falls back to `data.message`. Update the ~handful of fetch call sites that show `data.message`.

### Task 3.3: `locale` column + emails + env

- [ ] **Step 1:** Add `locale text default 'he'` to `user_profiles` in `src/db/schema.ts`; generate + apply migration via `DATABASE_URL_ADMIN` (psql, per memory `drizzle-meta-drift`) on DEV first, PROD later.
- [ ] **Step 2:** On login/locale-switch, persist the chosen locale to `user_profiles.locale` and set the `NEXT_LOCALE` cookie so the next visit lands in the right language.
- [ ] **Step 3:** Better Auth emails (`lib/auth/better-auth.ts`): pick the template language from the user's `locale`; provide he + en versions of the 8 reset/verify strings; email `<html lang dir>` becomes locale-driven.
- [ ] **Step 4:** `lib/env.ts` messages are developer-facing — leave Hebrew or translate to English (recommend English for dev logs). Low priority.

**Phase 3 gate:** API errors localize on the client; reset/verify emails arrive in the user's language; `locale` persisted; error-code test green.

---

# PHASE 4 — Reports / PDF / Excel / Email Documents (bidirectional)

> Treated as a separate workstream (250+ strings, browser-print RTL hardcoded). The mechanism is **browser print** (`window.print()` + injected `@media print` CSS), 6 templates, with duplicated logic between `printStyles.ts` and `AdHocReportTab.tsx`.

### Task 4.1: De-duplicate + parameterize print styles by direction

- [ ] **Step 1:** Make `buildPrintStyles(template, colors, dir)` accept `dir`. Replace hardcoded `direction: rtl !important` / `text-align: right` (printStyles.ts:38, pdf-styles.css:65, the 20+ `text-align:right` rules) with `direction: ${dir}` and `text-align: ${dir === 'rtl' ? 'right' : 'left'}` (or CSS logical `text-align: end`).
- [ ] **Step 2:** Remove the inline duplicate of the 6 templates in `AdHocReportTab.tsx`; have it call the shared `buildPrintStyles`. Set the print container `dir` from the active locale (`printContainer.setAttribute('dir', locale === 'he' ? 'rtl' : 'ltr')`).

### Task 4.2: Externalize document labels

- [ ] Report headers/columns/totals (`AdHocReportTab.tsx` ~38), charge-doc labels (`ChargeDocumentView.tsx` ~34, `statusMeta.ts` status labels), Excel sheet names + headers (`app/api/reports/excel/route.ts` ~50, and flip `readingOrder` by locale), email document text → `Reports.*`, `ChargeDoc.*`, `Excel.*` namespaces.

### Task 4.3: Mixed-direction safety (the known gotcha)

- [ ] Wrap **user-supplied content** (client names, notes) in `dir="auto"` (or an explicit `<bdi>`) inside documents so a Hebrew client name renders correctly inside an English report and vice-versa. Add a Playwright print-snapshot test rendering one report + one charge-doc in each locale.

**Phase 4 gate:** report, charge-doc, and Excel export produce correct output in both languages; Hebrew name in an English doc renders RTL-correct; no LTR misalignment in printed tables.

---

# PHASE 5 — Marketing/Legal + SEO + PWA

- [ ] **Landing + legal:** externalize `components/landing/*` (~300 strings) and `terms`/`privacy`/`contact` → `Landing.*`, `Legal.*`.
- [ ] **SEO:** add `app/sitemap.ts` (both locales), `app/robots.ts`, and `alternates.languages` (hreflang `he` ↔ `en`) on every page's metadata. Set per-locale OG.
- [ ] **PWA `app/manifest.ts`:** because Hebrew is prefix-less (`as-needed`), `start_url: '/dashboard'` and shortcuts keep working for Hebrew. Decide PWA install language policy (recommend: keep manifest Hebrew-primary; English users still install and the app follows their cookie/locale). Document the choice.

**Phase 5 gate:** `/en` landing fully English; `hreflang` present; sitemap lists both; Lighthouse SEO clean.

---

# PHASE 6 — RTL→LTR Visual QA + E2E

Fix the ~38 directional hardcodes the audit found (these only matter once English/LTR is live):

- [ ] **Toggle switches** (`settings/page.tsx:940, 990`): `after:right-[2px] after:-translate-x-full` → `[dir=rtl]:after:right-[2px] [dir=ltr]:after:left-[2px]` + conditional translate.
- [ ] **Sidebar/layout** (`components/app-layout.tsx:131,142`): `fixed right-0` → `[dir=rtl]:right-0 [dir=ltr]:left-0`; `mr-16/mr-64` → `me-16/me-64` (logical) or `[dir]`-scoped.
- [ ] **Convert remaining hardcoded directional classes** (`mr-/ml-/pr-/pl-/left-/right-/text-left/text-right`, ~12+ spots) to logical (`me-/ms-/pe-/ps-/text-start/text-end`).
- [ ] **accessibility.css:** add LTR-equivalents for the `[dir="rtl"] :focus-visible` rules.
- [ ] **Component sweep:** dropdowns/popovers/tooltips/toasts/sliders/tables — verify in LTR (Radix follows the `dir` attribute, but verify).
- [ ] **E2E `tests/e2e/locale-routing.spec.ts`:** Playwright — for each locale: load `/`(he) and `/en`, assert `<html dir>`, assert a known translated string, click through sidebar links (assert no 404 and correct prefix), run an axe a11y check.

**Phase 6 gate:** manual LTR pass on every primary screen shows no broken layout; Playwright green for both locales; axe clean.

---

## Self-Review (run before execution)

**1. Spec coverage** — every investigation finding maps to a phase: strings→P1, RTL hardcodes→P6, formatting→P2, server messages→P3, routing/middleware→P0, reports/PDF/Excel/email→P4, SEO/PWA→P5. ✅
**2. Placeholder scan** — repetitive phases (P1, P3.2, P4.2, P5) are intentionally recipe+inventory, not enumerated, with a fully worked example each and the parity test as the gate. This is the sanctioned treatment for large mechanical repetition; the implementer follows the recipe per file. Phase 0 and the testable units (currency, error-codes, parity) are fully bite-sized TDD.
**3. Type consistency** — `ERROR_CODES`/`ErrorCode`/`apiError` consistent across 3.1–3.2; `formatCurrency(amount, currency, locale)` signature consistent P2↔P4; `routing`/`Locale` from `src/i18n/routing.ts` used everywhere; navigation always from `@/i18n/navigation`.

**Open verification for the implementer (do first):**
- Read `tests/run-tests.ts` and match the exact test registration/signature before writing the three unit tests.
- Confirm the real route-directory list under `app/` before the Task 0.5 move loop.
- Confirm next-intl v4 is what npm installs; if v3, `requestLocale` API still applies but double-check `hasLocale`.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-05-i18n-english-bilingual.md`.

Recommended order: **Phase 0 → Phase 1**, open the PR (app is bilingual for the core), then stack Phases 2–6. Hebrew stays fully working at every commit; English fills in phase by phase.
