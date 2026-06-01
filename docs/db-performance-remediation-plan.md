# DB Isolation & Performance — Remediation Plan

> Created 2026-06-01 from two read-only audits (per-user isolation/RLS, and scalability/query-load)
> run before opening Monit to external users. This is a **planning document** — no code changed yet.

## Executive summary

- **Isolation / RLS: AIRTIGHT.** No IDOR across all 46 API routes; RLS ENABLED + FORCE'd on all 8
  user-data tables with USING + WITH CHECK. No secret leaks.
- **Prod config VERIFIED (2026-06-01):** Vercel Production `DATABASE_URL` connects as `clockbill_app`
  (NOBYPASSRLS) on the Neon `-pooler` endpoint → RLS is genuinely enforced in production.
- **Scalability: OK for closed beta; a short list of fixes needed before a public launch.** The
  user-reported page-transition lag is real and explained by API fan-out + the per-query RLS round-trips.

Nothing here is a data-leak risk. The items below are performance + future-proofing.

---

## Status legend
`[ ]` not started · `[~]` partially done · `[x]` done/verified

---

## P0 — Before public launch (high impact, low effort)

### 1. Covering index on `time_entries`  `[x]` (applied to dev AND prod 2026-06-01, verified)
Every dashboard/report aggregate (`SUM(duration)`, earnings, billable totals) currently does an
index scan **plus a heap fetch per row**. One online index removes the heap fetch.

```sql
CREATE INDEX CONCURRENTLY idx_time_entries_user_date_covering
  ON time_entries (user_id, date)
  INCLUDE (duration, is_billable, project_id);
```
- Zero downtime (`CONCURRENTLY`). Apply via the admin role (`DATABASE_URL_ADMIN`), not `db:migrate`
  (meta drift — see project memory). Add the matching index to `src/db/schema.ts` so it isn't lost.
- **Effort:** ~15 min. **Impact:** HIGH — first query to degrade at scale, fixed cheaply.

### 2. Reduce pg pool `max` 20 → 5  `[x]` (done 2026-06-01, `lib/db.ts`)
Each Vercel instance holds its own pool. `max:20` × N instances can exhaust Neon's connection limit
under load. Prod is already on the `-pooler` endpoint, so only the size needs to drop.
- File: `lib/db.ts` pool config (`max`, keep `idleTimeoutMillis`/`connectionTimeoutMillis`).
- **Effort:** ~10 min. **Impact:** HIGH — the only change that prevents connection exhaustion at scale.

### 3. Kill the reports-page fan-out  `[x]` (done 2026-06-01: `GET /api/reports/init` + page now one call)
`/(auth)/reports` fires **5 independent API calls** on mount (`profile`, `clients`, `projects`,
`presets`, `currency-rates`) ≈ 15 DB round-trips before the user clicks "Generate".
- Add `GET /api/reports/init` returning `{ clients, projects, presets, currencyRates }` in a single
  `withTransaction`. Carry `Cache-Control: private, max-age=120`.
- **Effort:** ~2–3 h. **Impact:** MEDIUM-HIGH — biggest single source of the perceived lag.

---

## P1 — Soon after launch (medium impact)

### 4. Collapse `POST /api/entries` 4 queries → 2  `[x]` (done 2026-06-01 with the ad-hoc-item feature; PUT also now a single transaction + CTE)
Today: (1) ownership check, (2) `SELECT gen_random_uuid()` ⟵ needless, (3) INSERT, (4) re-fetch JOIN.
- Inline UUID into `INSERT … VALUES (gen_random_uuid()::text, …) RETURNING …`; fold the re-fetch into
  a CTE (`WITH ins AS (INSERT … RETURNING …) SELECT ins.*, p.name, c.name FROM ins JOIN projects p …`).
- **Do this together with the ad-hoc-item feature** — same route is being touched anyway.
- **Effort:** ~45 min. **Impact:** MEDIUM (every manual entry).

### 5. Fold dashboard charts into one endpoint  `[x]` (done 2026-06-01)
`/dashboard` fired `stats` + `earnings-chart` + `project-hours` (3 DB-hitting calls). The two chart
aggregates were folded into `GET /api/dashboard/stats` (which now also returns `monthlyEarnings` +
`projectHours`); `EarningsChart`/`ProjectHoursChart` became presentational (props instead of
self-fetching); the two now-dead routes were deleted. `/api/timer/running` stays separate (real-time).
Dashboard mount: 3 DB-hitting calls → 1. Folded query verified on dev.

### 6. Merge multi-query read routes into one statement  `[x]` (done 2026-06-01)
- `[x]` `GET /api/dashboard/stats`: 3 time-period SUMs → one `FILTER` aggregate, clients+projects
  COUNTs → one scalar-subquery row, currency folded onto earnings (10 → 6 queries). FILTER equivalence
  verified on dev.
- `[x]` `GET /api/projects/[id]/stats`: ownership + SUM + COUNT → one LEFT JOIN aggregate (3 → 1).
- `[x]` `GET /api/dashboard/earnings-chart`: currency folded onto the earnings query via an outer
  scalar subquery (2 → 1). Verified on dev.
- `[x]` `GET /api/entries`: total now comes from `COUNT(*) OVER()` on the page query (no separate
  COUNT round-trip). Window-count == plain count verified on dev.

---

## P2 — Future-proofing (lower priority / larger)

### 7. Drop the RLS COMMIT round-trip on read-only queries  `[ ]` (HELD — audit suggestion is unsafe as written)
Read paths do `BEGIN; set_config; SELECT; COMMIT` = 3 round-trips; the COMMIT is wasted on SELECTs.
⚠️ The audit's "release without COMMIT, pool auto-rollbacks" is WRONG for node-pg: `pool.client.release()`
does NOT roll back an open transaction, so skipping COMMIT would leak open transactions and exhaust the
connection. A correct version must explicitly `ROLLBACK` read-only txns (still a round-trip, no win) or
pipeline set_config+SELECT+COMMIT. Net: no safe easy win here — deferred until we adopt #8 (JWT claim),
which removes the per-query set_config entirely and makes this moot. **Impact:** MEDIUM-LOW.

### 8. (Bigger) Move tenant id into the session JWT claim  `[ ]`
Reference `auth.jwt()->'app_metadata'->>'user_id'` directly in RLS policies → drops `set_config`
entirely, making authed queries 1 round-trip like unauthenticated ones. Requires re-issuing sessions
with the claim + rewriting all policies. **Effort:** high. **Impact:** HIGH at scale. Evaluate later.

### 9. Index/hardening tidy-ups  `[~]` (indexes done 2026-06-01)
- `[x]` `time_entries (user_id, project_id, date DESC)` for the project-filter bar — applied dev+prod
  (drizzle/0010), schema.ts updated.
- `[x]` Partial billable index `… (user_id, date) WHERE is_billable = TRUE` — applied dev+prod.
- `[ ]` Optional `client_rates (user_id, client_id)` for defence-in-depth.
- `[x]` Appended `AND user_id = $n` to the 3 cosmetic "fetch-after-write" reads (`clients/[id]`,
  `currency-rates`, `reports/presets`) — uniform, grep-clean (done 2026-06-01).

### 10. Hardening (not perf, tracked here for completeness)  `[~]`
- `[x]` **Drizzle footgun:** added a prominent RLS warning to `src/db/index.ts` (fails closed on
  user-data tables; safe only for Better Auth tables) and fixed its example (was pointing at a legacy
  table). Done 2026-06-01.
- `[x]` **Legacy dead tables dropped** (`users`, `sessions`, `password_reset_tokens`,
  `email_verification_tokens`) — all empty on dev+prod. drizzle/0011 + schema.ts. **Also fixed a latent
  bug:** `report_presets.user_id` had a stale FK to the empty legacy `users` table, which had silently
  made saving any report preset impossible; the FK is dropped (user_id is now a loose text ref like the
  other app tables).
- `[x]` **Better Auth rate-limit → DB** — done 2026-06-01: `storage: "database"` + `rate_limit` table
  (drizzle/0012, dev+prod), verified live (a failed sign-in writes a row; auth still returns 401).
- `[ ]` **Resend** (reset emails) — `sendResetPassword` still only logs; needs a Resend API key +
  verified from-domain. Wiring ready to add when the env vars land.
- `[ ]` **App-level cache (Upstash)** — RECOMMEND NOT NOW. All hot data here is per-user private, so a
  shared cache needs per-user keys (low reuse for a single user) + invalidation on every write (stale-data
  risk), plus an external dependency/creds. The lag was already fixed by the fan-out + index + query-merge
  work; browser `Cache-Control: private` already covers per-user reuse. Revisit only if a specific endpoint
  proves slow under real load (measure first).

---

## Suggested sequencing
1. **Now (with the ad-hoc-item feature):** #4 (same route).
2. **This week:** #1, #2 — 25 min combined, highest impact, unblock scale.
3. **Next:** #3, #5, #6 — remove the page-transition lag.
4. **Later / measure first:** #7, #8, #9, #10.

Each change should ship as its own small commit with a before/after note where measurable.
