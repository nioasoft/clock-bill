# CLAUDE.md

**ClockBill** — multi-tenant time tracking + billing for Israeli freelancers.
Bilingual he/en via next-intl under `app/[locale]` (he is prefix-less, en = `/en`);
`<html lang/dir>` are locale-dynamic. Charge documents ("התחשבנות") + 6 PDF templates,
Polar billing, PWA + web push.

## Commands (only the non-obvious)

- Tests: custom tsx runner, NOT Jest/Vitest — `npm test` (all), single file: `npx tsx tests/unit/format.test.ts`. E2E: `npm run test:e2e` (Playwright).
- **Migrations: never `db:migrate`** (drizzle journal out of sync). Add `drizzle/NNNN_*.sql` → `DATABASE_URL_ADMIN="<admin url>" npm run db:apply` (tracked in `schema_migrations`, re-run is a no-op). Apply to dev, then prod (admin URL in `.env.local.bak.prod-shared`), BEFORE deploying code that needs the schema.

## Database

- Dev `.env.local` → Neon **dev branch**; prod/Vercel → Neon main. No local Docker DB.
- Two coexisting layers: raw SQL `query()` / `withTransaction()` from `lib/db.ts` ($1 placeholders, most routes) and Drizzle at `@/src/db`. Schema changes ONLY in `src/db/schema.ts`.
- **RLS enabled + FORCE-d** (policies live in Neon, source: `drizzle/rls-policies.sql`). App role `clockbill_app` = `DATABASE_URL`; admin/migrations = `DATABASE_URL_ADMIN` (neondb_owner). `lib/db.ts` binds `app.current_user_id` per authed query. Keep the app-level `WHERE user_id = $n` filter anyway (defense in depth).
- Gotcha: psql via `DATABASE_URL` silently returns 0 rows on RLS tables — inspect data with `DATABASE_URL_ADMIN`.
- All IDs are text UUIDs (`gen_random_uuid()::text`).

## Auth

Better Auth (email/password + Google), instance `lib/auth/better-auth.ts`. Route guard: `getUser()` from `lib/auth.ts`; null → 401 `{ success: false, message: "לא מחובר" }`. BA tables are `user`/`session`/`account`/`verification` — the legacy `users`/`sessions` tables are obsolete.

## Conventions

- API responses: `{ success, data?, message?, error_code? }`; user-facing messages in Hebrew.
- Validation schemas live in `lib/schemas/` (this overrides the global `src/schemas` rule).
- Radix ignores `<html dir>` — RTL comes from `Direction.Provider` in `components/providers.tsx`; don't remove it.

## Design system — ClickHouse dark

Tokens in `app/[locale]/globals.css` under `@theme inline`. **Never hardcode design values** — no `bg-white`/`text-black`/`bg-gray-*`/hex in app UI (PDF templates `*pdf*` are the only light exception).

- Yellow accent (`bg-primary`/`bg-accent`) → text MUST be `text-primary-foreground`/`text-accent-foreground` (black), never white. No drop shadows — depth via surface contrast.
- Radius: `rounded-[var(--radius)]` (controls) / `rounded-[var(--radius-card)]` (cards). Numbers/timers: `font-mono` + `tabular-nums`.
- Mobile: inputs forced to 16px under 640px (iOS zoom) — keep it; tap targets ≥44px.
