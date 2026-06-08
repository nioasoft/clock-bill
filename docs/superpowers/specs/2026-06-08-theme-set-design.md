# Theme Set — Design Spec

**Date:** 2026-06-08
**Status:** Approved (brainstorm) — pending spec review → implementation plan
**Branch:** `feat/theme-set`

## Context

The app is currently **dark-only** (ClickHouse-inspired: near-black canvas, electric-yellow
accent, white type, hairline borders, no shadows). Design tokens live as hard-coded values
inside a single `@theme inline` block in `app/[locale]/globals.css`, which cannot switch at
runtime.

The user wants a **curated set of selectable themes** (not just a light mode), with one
explicit non-functional requirement: the themes must be **templates structured so that every
future update flows into all of them with minimal work** — add a token once, add a theme once,
and new components work everywhere without per-theme edits.

Goal: a maintainable, account-synced theme system with a small curated set, where components
never know about a specific theme — they only consume stable token names.

## Core principle — single source of truth + per-theme deltas

- One canonical list of **semantic token names** (already exists). Components reference names
  only, never raw colors or theme ids.
- `:root` holds **all** tokens at their default (current dark) values. Each theme is a
  `[data-theme="x"]` block holding **only the deltas** from default.
- Adding a token → one line in `:root` + `@theme` mapping; every theme inherits unless it
  overrides. Adding a theme → one `[data-theme]` block of deltas. New component → uses existing
  token names → works in all themes automatically.

This preserves the existing rule in `CLAUDE.md`: *"To change the theme, edit token VALUES, not
components. Token names are stable."*

## Architecture

### 1. Token template — CSS

- **New `app/[locale]/themes.css`**: holds `:root { --background: …; --foreground: …; … }` with
  every token at default (current dark) values, followed by one `[data-theme="<id>"] { … }`
  block per non-default theme containing only its overrides.
- **`app/[locale]/globals.css`**: the `@theme inline` block changes from literal values to a
  **name→var mapping** — `--color-background: var(--background)`, `--color-primary: var(--primary)`,
  etc. (Tailwind v4 `@theme inline` pattern.) Import `themes.css` before the mapping. The
  `html { color-scheme }` line becomes theme-driven (`light`/`dark` per theme via a
  `--color-scheme` token or a per-theme `color-scheme` declaration).
- The token name set is exactly today's: background, foreground, primary(+foreground/light/active),
  secondary(+…), accent(+foreground), muted(+foreground), destructive(+fg), success(+fg),
  border(+strong), input, ring, popover(+fg), card(+fg/elevated), sidebar(+fg), surface. Radius,
  fonts, transitions, animations stay theme-independent (single definition).

### 2. Theme registry — single source for UI + validation

- **New `lib/themes.ts`**: exports `THEMES`, an ordered registry:
  `{ id, labelHe, labelEn, base: 'dark'|'light', swatch: [hex, hex, hex] }` per theme, plus
  `DEFAULT_THEME = 'dark'`, a `ThemeId` union type, and an `isThemeId(v)` guard.
- This is the **only** place the theme list is enumerated: drives the settings selector, the
  API validation, and the type. Adding a theme = one CSS block + one entry here.

### 3. Persistence + provider (account-synced, cookie-driven SSR)

- **DB**: add `theme text default 'dark'` to `user_profiles` (`src/db/schema.ts`). Apply to
  dev + prod via `psql` + `DATABASE_URL_ADMIN` (drizzle journal is drifted in this repo — do not
  use db:migrate). Seed default `'dark'` on the existing signup-hook insert.
- **Cookie = SSR source of truth**: cookie `theme` (1-year, `SameSite=Lax`, not httpOnly so the
  client provider can read/write). `app/[locale]/layout.tsx` (server) resolves the initial theme in
  this order and renders `<html data-theme={theme}>` at render time → **zero flash, no injected
  script**:
  1. `theme` cookie if present (the common, fast path).
  2. else, if the request is authenticated → read `user_profiles.theme` server-side (so a returning
     user on a new device gets their saved theme on first paint — no cookie-set during RSC render
     needed).
  3. else → `DEFAULT_THEME`.
- **Cookie write happens client-side only**: the provider sets the `theme` cookie on mount (if
  missing) and on every switch, so subsequent loads take the fast cookie path. This avoids setting
  cookies during RSC render (not supported in a server component).
- **Client provider** — **new `components/theme-provider.tsx`** (~60 lines, no `next-themes`):
  React context exposing `theme` + `setTheme(id)`. `setTheme` (a) sets `document.documentElement.dataset.theme`
  immediately (optimistic, no flash), (b) writes the `theme` cookie, (c) fires
  `PATCH /api/profile { theme }`. Initial value read from the `<html data-theme>` set by SSR.
  Wired into `components/providers.tsx` alongside `TimerProvider`.
- **API**: `app/api/profile` `PATCH` accepts `theme`, validated against `isThemeId` (reject unknown),
  scoped to `current_user.id`.

### 4. Selector UI

- New **"מראה / Appearance"** section in settings (`app/[locale]/settings/page.tsx`) — a row of
  theme cards rendered from `THEMES`, each showing its `swatch` + localized label, the active one
  marked. Click = optimistic switch via the provider. Loading/empty/error states inherited from the
  page; switch is optimistic with rollback on PATCH failure (toast).

### 5. The visual set — produced via Claude Design

- Architecture is palette-agnostic. Initial set: **Midnight** (`dark`, = current tokens, default),
  **Daylight** (`light`), plus **1–2 additional curated themes** (e.g. a softer dark and/or a warm
  light). The exact hex values per token are produced during implementation using **Claude Design**
  (Anthropic Labs — reads the codebase/tokens, generates on-brand directions), each constrained to:
  WCAG AA contrast (≥4.5:1 body text), the hairline-border / no-shadow aesthetic, and a deliberate
  accent for light bases (electric yellow `#faff69` is unreadable on light → each light theme defines
  its own accent). Filling these values changes only `themes.css` + `lib/themes.ts` swatches — no
  architectural change.

## Files touched

- New: `app/[locale]/themes.css`, `lib/themes.ts`, `components/theme-provider.tsx`,
  `docs/superpowers/specs/2026-06-08-theme-set-design.md` (this file).
- Modified: `app/[locale]/globals.css` (literal tokens → `var()` mapping), `app/[locale]/layout.tsx`
  (`data-theme` from cookie + login sync), `components/providers.tsx` (wrap ThemeProvider),
  `app/[locale]/settings/page.tsx` (Appearance section), `app/api/profile` route (accept `theme`),
  `src/db/schema.ts` (+ `theme` column) + the signup-hook seed in `lib/auth/better-auth.ts`.
- Hardcoded-color cleanup so non-default themes look right: `components/persistent-timer-bar.tsx`
  (`bg-amber-500/20` → token), `components/landing/hero.tsx` (raw gradient → token-based). PDF
  templates stay light/printed — out of scope.

## Out of scope

- Per-user custom themes / color pickers (the chosen scope is a *curated set*).
- Theming the PDF report templates (printed pages stay light by design).
- Onboarding/profession presets (separate, deferred feature).

## Verification

- **Build/type/lint**: `npm run build`, `npm run lint`, `npm test` clean after the `globals.css`
  refactor (token names unchanged → existing utilities keep resolving).
- **Per-theme visual pass**: load dashboard, timer, a table, primary buttons, the usage banner, and
  the pricing page under each theme; confirm hairline borders, no shadows, AA contrast, accent
  legible (especially on light bases).
- **Switch + persistence**: switch theme in settings → instant, no flash; reload → persists (cookie);
  log in on another browser → `user_profiles.theme` applied. Verify `PATCH /api/profile { theme:'bogus' }`
  is rejected.
- **No-flash**: first paint already shows the saved theme (SSR `data-theme`), not a default-then-swap.
- **Add-a-theme drill** (proves the template goal): adding a 5th theme touches only `themes.css` +
  `lib/themes.ts`, nothing else.
