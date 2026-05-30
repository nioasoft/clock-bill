# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**מוניט (Monit)** — Multi-tenant time tracking app for Israeli freelancers. Full Hebrew UI, RTL layout, real-time timer, client/project management, flexible billing models (hourly, retainer, fixed monthly), PDF report export with 6 templates, and multi-currency support (ILS, USD, USDT, BTC, ETH).

## Commands

```bash
npm run dev          # Start dev server (Next.js)
npm run build        # Production build
npm run lint         # ESLint
npm test             # Run all unit tests (tests/unit/*.test.ts)
npm run test:format  # Run format tests only
npm run test:validation  # Run validation tests only

# Database (Drizzle Kit)
npm run db:generate  # Generate migration from schema changes
npm run db:migrate   # Apply migrations
npm run db:push      # Push schema directly (dev)
npm run db:studio    # Open Drizzle Studio
```

Tests use a custom runner (`tests/run-tests.ts`) with `tsx`, not a framework like Jest/Vitest. Run a single test: `npx tsx tests/unit/format.test.ts`

## Architecture

### Dual Database Layer

The codebase has two coexisting database access patterns:

1. **Raw SQL via `lib/db.ts`** — `query()` function using `pg` Pool with `$1, $2` parameterized placeholders. Used by most API routes. Also has `withTransaction()` for transactional operations.
2. **Drizzle ORM via `src/db/index.ts`** — Type-safe queries using schema from `src/db/schema.ts`. Available for new code at `import { db } from "@/src/db"`.

Schema is defined in `src/db/schema.ts` (Drizzle) and also duplicated as raw SQL in `lib/db.ts:initSchema()` (legacy, deprecated). Only modify `src/db/schema.ts` for schema changes.

### Auth Pattern

**Better Auth** (email/password + Google), instance in `lib/auth/better-auth.ts`, Drizzle adapter, BA tables `user`/`session`/`account`/`verification`. Client: `lib/auth/client.ts`. Handler: `app/api/auth/[...all]/route.ts`. The legacy `users`/`sessions` tables are obsolete. Every API route follows this pattern:

```typescript
const user = await getUser(); // lib/auth.ts — reads the Better Auth session
if (!user) {
  return NextResponse.json({ success: false, message: "לא מחובר" }, { status: 401 });
}
// All queries MUST filter by user.id for data isolation
```

`getUser()` returns `{ id, email, emailVerified, role }` or `null`. Google login needs `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`.

**Row-Level Security is ENABLED.** The app connects as the restricted role `clockbill_app` (`DATABASE_URL`); migrations use the privileged `DATABASE_URL_ADMIN`. `lib/db.ts` sets `app.current_user_id` (transaction-local) per authed query — resolved from an explicit in-frame context (`setUserContext`, signup hook) or the BA session (`getSessionUserId`, cached; needed because `enterWith` from `getUser()` doesn't reach the Next route frame). Policies live in Neon (`drizzle/rls-policies.sql`), FORCE-d on user_profiles/clients/projects/tasks/time_entries/report_presets/custom_tags. Keep the app-level `WHERE user_id = $` filter too (defense in depth). **Prod TODO:** set Vercel `DATABASE_URL`=clockbill_app + `DATABASE_URL_ADMIN`=neondb_owner.

### API Routes

All under `app/api/`. Use raw `query()` from `lib/db.ts` with dynamic import: `const { query } = await import("@/lib/db")`. Return `NextResponse.json()` with `{ success: boolean, ... }` shape. Error messages are in Hebrew for user-facing strings.

### Key Libraries

- `@/lib/format.ts` — Number/currency/date formatting
- `@/lib/validation.ts` — Input validation schemas
- `@/lib/env.ts` — Env var validation with Hebrew error messages, lazy-loaded
- `@/lib/fixed-charges.ts` — Fixed monthly charge calculations for reports
- `@/lib/storage.ts` — File storage abstraction (local dev / Vercel Blob prod)

### Frontend

- Next.js 16 App Router with `app/` directory
- Root layout: `<html lang="he" dir="rtl">` with **Heebo** font (Hebrew+Latin) + JetBrains Mono
- Tailwind CSS v4 with `@theme inline` pattern in `globals.css`
- shadcn/ui components in `components/ui/`
- Path alias: `@/*` maps to project root

## Design System — ClickHouse (dark)

The app uses a **ClickHouse-inspired** dark theme: near-black canvas, electric-yellow
accent, white type, hairline borders, **no drop shadows** (depth comes from
canvas/surface contrast). All tokens live in `app/globals.css` under `@theme inline`.

**🚫 NEVER hardcode design values. ALWAYS use the design tokens.**

- **Colors** — use the semantic Tailwind token classes, never raw colors:
  - Surfaces: `bg-background` (#0a0a0a), `bg-surface`, `bg-card` (#1a1a1a), `bg-card-elevated`.
  - Text: `text-foreground` (white), `text-muted-foreground`.
  - Accent: `bg-primary` / `bg-accent` = electric yellow (#faff69). **On a yellow background, text MUST be `text-primary-foreground` / `text-accent-foreground` (black) — never `text-white`** (low contrast).
  - Borders: `border-border` (hairline #2a2a2a), `border-border-strong`. Focus ring: `ring-ring` (yellow).
  - Semantic: `destructive` (red, white fg), `success` (green, `success-foreground`).
  - ❌ No `bg-white`, `text-black`, `bg-gray-*`, or `bg-[#hex]` in app UI (PDF templates under `*pdf*` are the only exception — printed pages stay light).
- **Radius** — `rounded-[var(--radius)]` (8px, controls) or `rounded-[var(--radius-card)]` (12px, cards). Never `rounded-[14px]` or other hardcoded px.
- **Fonts** — `font-sans` (Heebo) for UI, `font-mono` (JetBrains Mono) for numbers/timers. Use `tabular-nums` for aligned figures; `.timer-display` for hero timer digits.
- **To change the theme**, edit the token VALUES in `globals.css` `@theme` — do not touch components. Token names are stable so the whole app re-themes from one place.
- **Mobile**: inputs are forced to 16px under 640px (prevents iOS zoom) — keep it. Tap targets ≥44px.

### Database

- **Dev:** PostgreSQL via Docker container `clockbill-db` on port 5432 (user: `clockbill`, pass: `clockbill_dev`, db: `clockbill`)
- **Prod:** Neon PostgreSQL
- Drizzle ORM configured for `postgresql` dialect
- All IDs are text (UUIDs generated as `gen_random_uuid()::text`)

## Important Conventions

- All UI text is Hebrew. Error messages in API responses use Hebrew for user-facing strings
- RTL layout: use logical CSS properties (`ps-4` not `pl-4`, `me-2` not `mr-2`)
- Every database query touching user data MUST include `user_id` filter — no cross-tenant data access
- API response shape: `{ success: boolean, data?: ..., message?: string }`
- Env vars loaded from `.env.local`: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`
