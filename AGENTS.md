# AGENTS.md

## Quick start

```bash
docker compose up -d              # PostgreSQL on :5432
npm install
cp .env.template .env.local       # fill secrets (BETTER_AUTH_SECRET, DATABASE_URL, etc.)
npm run dev                       # http://localhost:3000
```

## Commands (order matters)

| Step | Command | Notes |
|------|---------|-------|
| Lint | `npm run lint` | ESLint, `--max-warnings 0` — zero warnings enforced |
| Typecheck | `npx tsc --noEmit` | Not in a script; run manually |
| Unit tests | `npm test` | Custom runner (`tests/run-tests.ts` via `tsx`), NOT Jest/Vitest |
| Single test | `npx tsx tests/unit/format.test.ts` | |
| E2E | `npm run test:e2e` | Requires `npm run dev` running; Playwright, Chromium only |
| Build | `npm run build` | Needs all env vars set (CI uses mock values) |

**CI order:** lint → typecheck → test → build (`.github/workflows/ci.yml`)

## Architecture

- **Next.js 16 App Router** with `app/[locale]/` for i18n routes. Hebrew is default (prefix-less `/`), English is `/en/...`.
- **Dual DB layer:** Raw SQL (`lib/db.ts` `query()`, `$1` placeholders) for most API routes. Drizzle ORM (`src/db/index.ts`) for newer code. Schema defined in `src/db/schema.ts` — only edit this file for schema changes.
- **Auth:** Better Auth in `lib/auth/better-auth.ts`. Session read via `getUser()` from `lib/auth.ts`. Every API route must check `getUser()` and filter by `user.id`.
- **RLS is enabled.** App connects as restricted role `clockbill_app`; migrations use `DATABASE_URL_ADMIN`. `lib/db.ts` sets `app.current_user_id` per authed query. Keep `WHERE user_id = $` in queries too (defense in depth).
- **i18n:** next-intl v4. Hebrew default, locale prefix `"as-needed"`. Browser locale detection disabled — geo logic in `proxy.ts` sets first-visit default.

## Directory map

| Path | Purpose |
|------|---------|
| `app/[locale]/` | All page routes (Hebrew default, English `/en/`) |
| `app/api/` | API routes — all use raw `query()` from `lib/db.ts` |
| `lib/` | Core business logic (db, auth, formatting, validation, storage, email) |
| `src/db/` | Drizzle schema + ORM client |
| `src/i18n/` | next-intl routing config |
| `components/ui/` | shadcn/ui components |
| `hooks/` | React hooks |
| `tests/unit/` | Unit tests |
| `tests/e2e/` | Playwright E2E tests |
| `drizzle/` | Generated migrations |

## Gotchas

- **RTL everywhere.** Use logical CSS properties: `ps-4` not `pl-4`, `me-2` not `mr-2`. Check nested components — RTL breaks in dropdowns, popovers, sliders, tables.
- **All UI text is Hebrew.** Error messages in API responses use Hebrew for user-facing strings. English exists in `messages/en.json` via next-intl.
- **Timestamps:** `lib/db.ts` forces `TIMESTAMP` columns to UTC parsing. Don't use `new Date(string)` on raw DB values — go through `query()` to get the fix.
- **shadcn/ui** uses `new-york` style, `lucide` icons. Add components via `npx shadcn@latest add <name>`.
- **No `tsc` in npm scripts.** Must run `npx tsc --noEmit` explicitly for type checking.
- **Env vars** loaded lazily from `.env.local` via `lib/env.ts`. Build fails without them — CI mocks them.
- **PDF templates** (`*pdf*`) are the only exception to the dark theme — printed pages are light.

## Database

```bash
# Dev DB: Docker container `clockbill-db` on :5432
docker compose up -d

# Schema changes
npm run db:generate   # Generate migration from src/db/schema.ts
npm run db:migrate    # Apply migrations (uses DATABASE_URL_ADMIN)
npm run db:push       # Push schema directly (dev only)
npm run db:studio     # Drizzle Studio GUI
```

- All IDs are text UUIDs: `gen_random_uuid()::text`
- Legacy `users`/`sessions` tables were dropped — Better Auth uses `user`/`session`/`account`/`verification` tables.
