# AGENTS.md

Agent-facing companion to `CLAUDE.md`. Where the two overlap, `CLAUDE.md` wins.

## Quick start

```bash
npm install
cp .env.template .env.local       # fill secrets (BETTER_AUTH_SECRET, DATABASE_URL, etc.)
npm run dev                       # http://localhost:3000
```

**There is no local dev database.** `.env.local` points at the Neon **dev branch**;
prod/Vercel uses Neon **main**. `docker-compose.yml` still exists but is NOT used for
app development — it only spins up a throwaway Postgres if you want to run the
account-deletion integration test locally.

## Commands (order matters)

| Step | Command | Notes |
|------|---------|-------|
| Lint | `npm run lint` | ESLint, `--max-warnings 0` — zero warnings enforced |
| Typecheck | `npx tsc --noEmit` | Not in a script; run manually |
| Unit tests | `npm test` | Custom runner (`tests/run-tests.ts` via `tsx`), NOT Jest/Vitest |
| Single test | `npx tsx tests/unit/format.test.ts` | |
| E2E | `npm run test:e2e` | Requires `npm run dev` running; Playwright, Chromium only |
| Build | `npm run build` | Needs all env vars set (CI uses mock values) |

**CI order** (`.github/workflows/ci.yml`): audit → gitleaks → lint → typecheck → test →
account-deletion integration → build. The `npm audit --omit=dev --audit-level=high` gate
runs **first**, so when it fails every later step reports `skipped` — that is not "tests
passed", it means they never ran.

## Migrations — read before touching the schema

**Never run `npm run db:migrate`.** The drizzle-kit journal is out of sync with the DB;
that script exists only as a drizzle-kit default. Using it has caused a production
outage before.

```bash
# 1. edit src/db/schema.ts (the ONLY place schema changes belong)
# 2. hand-write drizzle/NNNN_description.sql
# 3. apply to DEV, then PROD, BEFORE deploying code that needs the schema
DATABASE_URL_ADMIN="<admin url>" npm run db:apply
```

`db:apply` records each file in `schema_migrations`; re-running is a no-op. The prod
admin URL lives in `.env.local.bak.prod-shared`.

## Architecture

- **Next.js 16 App Router**, routes under `app/[locale]/`. Hebrew is default
  (prefix-less `/`), English is `/en/...`.
- **Dual DB layer:** raw SQL (`lib/db.ts` `query()` / `withTransaction()`, `$1`
  placeholders) in most API routes; Drizzle (`src/db/`) for newer code.
- **Auth:** Better Auth (`lib/auth/better-auth.ts`). Every API route must call
  `getUser()` from `lib/auth.ts` and filter by `user.id`.
- **RLS is enabled and FORCE-d.** App connects as `clockbill_app` (`DATABASE_URL`);
  migrations use `DATABASE_URL_ADMIN`. Keep `WHERE user_id = $n` in queries anyway
  (defense in depth).
- **i18n:** next-intl v4, locale prefix `"as-needed"`. Browser locale detection is off —
  `proxy.ts` geo logic picks the first-visit default.

## Directory map

| Path | Purpose |
|------|---------|
| `app/[locale]/` | All page routes (Hebrew default, English `/en/`) |
| `app/api/` | API routes — mostly raw `query()` from `lib/db.ts` |
| `lib/` | Core logic (db, auth, dates, formatting, validation, storage, email) |
| `lib/schemas/` | Zod validation schemas (NOT `src/schemas`) |
| `src/db/` | Drizzle schema + ORM client |
| `components/ui/` | shadcn/ui components |
| `tests/unit/`, `tests/e2e/` | Unit tests / Playwright |
| `drizzle/` | Migrations (hand-written, applied via `db:apply`) |

## Gotchas

- **Dates: never derive a calendar day from `toISOString()`.** Use `appToday()` /
  `appDateBoundaries()` from `lib/dates.ts` (`Asia/Jerusalem`) — they are pure `Intl`
  and safe in client components too. The trap to grep for is
  `new Date(y, m, d).toISOString()`: it builds *local* midnight and serializes it as
  UTC, so east of Greenwich it silently lands on the previous day. Guard test:
  `tests/unit/app-today.test.ts`.
- **`date` columns come back as `Date`, not `string`.** `lib/db.ts` overrides the
  parser for `timestamp` (OID 1114) but not `date` (OID 1082), so a `date` column is
  parsed at the Node process's local midnight while TypeScript still types it `string`.
  Cast with `::text` in SQL when you need a real string.
- **RTL everywhere.** Logical properties: `ps-4` not `pl-4`, `me-2` not `mr-2`. Radix
  ignores `<html dir>` — RTL comes from `Direction.Provider` in
  `components/providers.tsx`; don't remove it.
- **User-facing strings are Hebrew**, including API `message` fields. English lives in
  `messages/en.json` via next-intl.
- **Never hardcode design values** — no `bg-white`/`text-black`/`bg-gray-*`/hex in app
  UI. PDF templates (`*pdf*`) are the only light-theme exception.
- **Env vars** load lazily from `.env.local` via `lib/env.ts`. Build fails without them;
  CI mocks them.
- **shadcn/ui** uses `new-york` style + `lucide` icons: `npx shadcn@latest add <name>`.
- All IDs are text UUIDs: `gen_random_uuid()::text`.
- Legacy `users`/`sessions` tables are gone — Better Auth uses
  `user`/`session`/`account`/`verification`.
