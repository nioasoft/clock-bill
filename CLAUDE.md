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

Custom auth (not Better Auth despite the spec) using scrypt password hashing and cookie-based sessions (`lib/auth.ts`). Every API route follows this pattern:

```typescript
const user = await getUser();
if (!user) {
  return NextResponse.json({ success: false, message: "לא מחובר" }, { status: 401 });
}
// All queries MUST filter by user.id for data isolation
```

`getUser()` reads the `session` cookie, joins `sessions` + `users` tables, returns `{ id, email, emailVerified, role }` or `null`.

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
- Root layout: `<html lang="he" dir="rtl">` with Assistant font (Hebrew+Latin)
- Tailwind CSS v4 with `@theme inline` pattern ("Midnight Atelier" theme) in `globals.css`
- shadcn/ui components in `components/ui/`
- Path alias: `@/*` maps to project root

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
