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

### 1. Covering index on `time_entries`  `[ ]`
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

### 2. Reduce pg pool `max` 20 → 5  `[ ]`
Each Vercel instance holds its own pool. `max:20` × N instances can exhaust Neon's connection limit
under load. Prod is already on the `-pooler` endpoint, so only the size needs to drop.
- File: `lib/db.ts` pool config (`max`, keep `idleTimeoutMillis`/`connectionTimeoutMillis`).
- **Effort:** ~10 min. **Impact:** HIGH — the only change that prevents connection exhaustion at scale.

### 3. Kill the reports-page fan-out  `[ ]`
`/(auth)/reports` fires **5 independent API calls** on mount (`profile`, `clients`, `projects`,
`presets`, `currency-rates`) ≈ 15 DB round-trips before the user clicks "Generate".
- Add `GET /api/reports/init` returning `{ clients, projects, presets, currencyRates }` in a single
  `withTransaction`. Carry `Cache-Control: private, max-age=120`.
- **Effort:** ~2–3 h. **Impact:** MEDIUM-HIGH — biggest single source of the perceived lag.

---

## P1 — Soon after launch (medium impact)

### 4. Collapse `POST /api/entries` 4 queries → 2  `[ ]`
Today: (1) ownership check, (2) `SELECT gen_random_uuid()` ⟵ needless, (3) INSERT, (4) re-fetch JOIN.
- Inline UUID into `INSERT … VALUES (gen_random_uuid()::text, …) RETURNING …`; fold the re-fetch into
  a CTE (`WITH ins AS (INSERT … RETURNING …) SELECT ins.*, p.name, c.name FROM ins JOIN projects p …`).
- **Do this together with the ad-hoc-item feature** — same route is being touched anyway.
- **Effort:** ~45 min. **Impact:** MEDIUM (every manual entry).

### 5. Fold dashboard charts into one endpoint  `[ ]`
`/dashboard` fires `stats` + `earnings-chart` + `project-hours` (3 DB-hitting calls). Merge the two
chart aggregates into the `stats` `Promise.all` and rename to `GET /api/dashboard`. Keep
`/api/timer/running` separate (must not be cached).
- **Effort:** ~1–2 h. **Impact:** MEDIUM.

### 6. Merge multi-query read routes into one statement  `[ ]`
- `GET /api/dashboard/stats`: merge the 3 time-period SUMs into one `GROUP BY CASE`, and the
  clients/projects COUNTs into one two-aggregate query (~10 → ~4 queries).
- `GET /api/projects/[id]/stats`: collapse existence-check + SUM + COUNT into one query.
- `GET /api/dashboard/earnings-chart`: JOIN `user_profiles` for currency instead of a separate lookup.
- `GET /api/entries`: get total via `COUNT(*) OVER ()` window instead of a separate COUNT round-trip.
- **Effort:** ~2–3 h total. **Impact:** MEDIUM.

---

## P2 — Future-proofing (lower priority / larger)

### 7. Drop the RLS COMMIT round-trip on read-only queries  `[ ]`
Read paths do `BEGIN; set_config; SELECT; COMMIT` = 3 round-trips; the COMMIT is wasted on SELECTs.
Detect read-only intent in `query()` and release without an explicit COMMIT (pool auto-rollbacks).
Saves 1 round-trip per read. **Effort:** ~1 h. **Impact:** MEDIUM-LOW but touches every read.

### 8. (Bigger) Move tenant id into the session JWT claim  `[ ]`
Reference `auth.jwt()->'app_metadata'->>'user_id'` directly in RLS policies → drops `set_config`
entirely, making authed queries 1 round-trip like unauthenticated ones. Requires re-issuing sessions
with the claim + rewriting all policies. **Effort:** high. **Impact:** HIGH at scale. Evaluate later.

### 9. Index/hardening tidy-ups  `[ ]`
- `time_entries (user_id, project_id, date DESC)` for the project-filter bar.
- Partial billable index `… (user_id, date) WHERE is_billable = TRUE` for earnings.
- Optional `client_rates (user_id, client_id)` for defence-in-depth.
- Append `AND user_id = $n` to the 3 cosmetic "fetch-after-write" reads (`clients/[id]:350`,
  `currency-rates:110`, `reports/presets:108`) for a grep-clean, uniform pattern.

### 10. Hardening (not perf, tracked here for completeness)  `[ ]`
- **Drizzle footgun:** `@/src/db` runs with no tenant context → using it on an RLS'd table fails
  closed (0 rows). Keep it for Better Auth tables only, or wrap with context binding. Add a code-review/
  lint note.
- **Better Auth rate-limit** storage is in-memory per instance, and `sendResetPassword` only logs the
  link. Move BA `rateLimit` to DB/Redis and wire Resend before wide launch.
- **Legacy dead tables** (`users`, `sessions`, `password_reset_tokens`, `email_verification_tokens`)
  are unused + un-RLS'd — drop from schema + DB once confirmed unreferenced.
- No app-level cache (Upstash) is wired; `Cache-Control: private` is browser-only.

---

## Suggested sequencing
1. **Now (with the ad-hoc-item feature):** #4 (same route).
2. **This week:** #1, #2 — 25 min combined, highest impact, unblock scale.
3. **Next:** #3, #5, #6 — remove the page-transition lag.
4. **Later / measure first:** #7, #8, #9, #10.

Each change should ship as its own small commit with a before/after note where measurable.
