# Client Locking + Write Guards — Implementation Plan (2 of 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** After a trial expires (effective tier `free`, limit 1), all `is_active` clients beyond the limit become **plan-locked**: reads + deletes/archiving stay allowed, but writes that add or edit billable work return HTTP 402. The single most-recently-active client stays usable; a "make active" action lets the user switch which one.

**Architecture:** A pure `computeLockedClientIds(rankedIds, limit)` ranks active clients (override `plan_priority_at` > latest entry activity > client age) and returns the over-limit tail. `getLockedClientIds(userId)` does the DB query + `resolvePlan` and returns a `Set<string>`. A shared guard `lib/plan-guard.ts` is called in each billable-write route after ownership is verified. A new `POST /api/clients/[id]/make-active` sets `plan_priority_at = NOW()`.

**Tech Stack:** Next.js 16 route handlers, Postgres raw `query()`/`withTransaction` (`$1` placeholders), Drizzle schema, custom tsx test runner.

Plan **2 of 4**. Depends on Plan 1 (trial state + `getUserPlan`/`resolvePlan`). Source spec: `docs/superpowers/specs/2026-06-19-trial-conversion-engine-design.md` §5.

## Global Constraints

- **Lock = read-only for billable work only.** BLOCK: create/edit time entries, start timer, create/edit projects, create charge documents, edit client, create rates, create/move tasks. ALLOW: all reads, deletes, archiving (`is_active=false`), and the reactivate (`PATCH /api/clients/[id]`) + make-active actions. Rationale: never hold data hostage; let users reduce below the cap.
- **402 response shape** (matches existing convention): `{ success: false, error_code: "CLIENT_PLAN_LOCKED", message: "<Hebrew default>" }`, status `402`. The client (Plan 3) localizes by `error_code`; he+en strings live in `messages/{he,en}.json`.
- **Ranking signal:** `GREATEST(COALESCE(plan_priority_at, clients.created_at), COALESCE(MAX(time_entries.created_at), clients.created_at))` per active client, DESC. Top `clientLimit` stay usable.
- **DB facts:** `projects.client_id → clients.id`; `time_entries.project_id → projects.id`; `time_entries.created_at` is a non-null timestamp (use it, NOT `start_time`, which is null on completed entries); `clients.is_active`; `tasks.client_id` exists.
- Migrations applied via `psql` + `DATABASE_URL_ADMIN` (read from `.env.local`: `psql "$(grep -E '^DATABASE_URL_ADMIN=' .env.local | cut -d= -f2-)" -f <file>`). Dev now; prod at deploy.
- TypeScript strict, no `any`; tests via `npx tsx tests/unit/<file>.test.ts`.

---

### Task 1: Migration + schema for `clients.plan_priority_at`

**Files:**
- Modify: `src/db/schema.ts` (clients table, near `isActive`/`createdAt` ~line 220)
- Create: `drizzle/0024_client_plan_priority.sql`

- [ ] **Step 1: Add the Drizzle column**

In `src/db/schema.ts`, inside the `clients` table after `isActive: boolean("is_active").default(true),` add:

```typescript
  // Explicit "keep this client active" bump for the plan cap. NULL => rank by
  // activity/age. Set to NOW() by the make-active action. See lib/plan-guard.ts.
  planPriorityAt: timestamp("plan_priority_at"),
```

- [ ] **Step 2: Write the migration**

Create `drizzle/0024_client_plan_priority.sql`:

```sql
-- Switchable "keep active" pointer for the client-count plan cap.
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS plan_priority_at timestamp;
```

- [ ] **Step 3: Apply to dev + verify**

```bash
psql "$(grep -E '^DATABASE_URL_ADMIN=' .env.local | cut -d= -f2-)" -f drizzle/0024_client_plan_priority.sql
psql "$(grep -E '^DATABASE_URL_ADMIN=' .env.local | cut -d= -f2-)" -c "\d clients" | grep plan_priority_at
```

Expected: one row `plan_priority_at | timestamp`.

- [ ] **Step 4: Commit**

```bash
git add src/db/schema.ts drizzle/0024_client_plan_priority.sql
git commit -m "feat(db): add clients.plan_priority_at (migration 0024)"
```

> Prod note: apply the same SQL to prod via psql at deploy time. Do NOT apply to prod now.

---

### Task 2: Pure `computeLockedClientIds` + `getLockedClientIds`

**Files:**
- Create: `lib/plan-guard.ts`
- Test: `tests/unit/locked-clients.test.ts` (create)

**Interfaces:**
- Consumes: `getUserPlan` from `@/lib/entitlements`
- Produces: `computeLockedClientIds(rankedActiveIds: string[], clientLimit: number): string[]` (pure); `getLockedClientIds(userId: string): Promise<Set<string>>`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/locked-clients.test.ts`:

```typescript
/** Unit tests for computeLockedClientIds (pure lock-ranking). */
import { computeLockedClientIds } from "../../lib/plan-guard";

class TestRunner {
  private tests: Array<{ name: string; fn: () => void }> = [];
  private passed = 0; private failed = 0;
  test(name: string, fn: () => void) { this.tests.push({ name, fn }); }
  async run() {
    console.log("🧪 Running locked-clients tests...\n");
    for (const { name, fn } of this.tests) {
      try { fn(); this.passed++; console.log(`  ✅ ${name}`); }
      catch (e) { this.failed++; console.error(`  ❌ ${name}`); if (e instanceof Error) console.error(`     ${e.message}`); }
    }
    console.log(`\n${this.passed} passed, ${this.failed} failed`);
    if (this.failed > 0) process.exit(1);
  }
}
function assertEqual<T>(a: T, b: T, m?: string) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(m ?? `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }
const runner = new TestRunner();

// ranked = client ids already ordered by rank DESC (most-active first)
runner.test("free (limit 1): all but the first are locked", () => {
  assertEqual(computeLockedClientIds(["a", "b", "c"], 1), ["b", "c"]);
});
runner.test("starter (limit 5): tail beyond 5 locked", () => {
  assertEqual(computeLockedClientIds(["a","b","c","d","e","f","g"], 5), ["f", "g"]);
});
runner.test("under limit: none locked", () => {
  assertEqual(computeLockedClientIds(["a"], 1), []);
});
runner.test("unlimited (Infinity): none locked", () => {
  assertEqual(computeLockedClientIds(["a","b","c"], Infinity), []);
});
runner.test("empty list: none locked", () => {
  assertEqual(computeLockedClientIds([], 1), []);
});

runner.run();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx tests/unit/locked-clients.test.ts`
Expected: FAIL — `lib/plan-guard.ts` does not exist.

- [ ] **Step 3: Create `lib/plan-guard.ts` (pure fn + DB reader)**

```typescript
/**
 * Plan-lock enforcement for the client-count cap. When a user's effective tier
 * caps active clients (free=1, starter=5), clients beyond the cap are
 * "plan-locked": billable writes are rejected (402) until the user upgrades or
 * switches which client is active. Reads/deletes/archiving stay allowed.
 */
import { NextResponse } from "next/server";
import { getUserPlan } from "@/lib/entitlements";

/**
 * Given active client ids already ordered by rank DESC (most-active first) and
 * the tier's client limit, return the ids that are locked (the over-limit tail).
 * A non-finite limit (unlimited) locks nothing.
 */
export function computeLockedClientIds(rankedActiveIds: string[], clientLimit: number): string[] {
  if (!Number.isFinite(clientLimit)) return [];
  return rankedActiveIds.slice(clientLimit);
}

/** The set of plan-locked client ids for a user (empty when unlimited/under cap). */
export async function getLockedClientIds(userId: string): Promise<Set<string>> {
  const plan = await getUserPlan(userId);
  if (!Number.isFinite(plan.clientLimit)) return new Set();
  const { query } = await import("@/lib/db");
  const result = await query<{ id: string }>(
    `SELECT c.id
       FROM clients c
       LEFT JOIN projects p ON p.client_id = c.id AND p.user_id = c.user_id
       LEFT JOIN time_entries te ON te.project_id = p.id AND te.user_id = c.user_id
      WHERE c.user_id = $1 AND c.is_active = TRUE
      GROUP BY c.id
      ORDER BY GREATEST(
        COALESCE(c.plan_priority_at, c.created_at),
        COALESCE(MAX(te.created_at), c.created_at)
      ) DESC`,
    [userId]
  );
  const ranked = result.rows.map((r) => r.id);
  return new Set(computeLockedClientIds(ranked, plan.clientLimit));
}

/** Standard 402 response for a blocked write to a plan-locked client. */
export function lockedClientResponse(): NextResponse {
  return NextResponse.json(
    { success: false, error_code: "CLIENT_PLAN_LOCKED", message: "הלקוח נעול. שדרג את המסלול או הפוך אותו ללקוח הפעיל." },
    { status: 402 }
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx tests/unit/locked-clients.test.ts`
Expected: PASS — 5 passed, 0 failed.

- [ ] **Step 5: Commit**

```bash
git add lib/plan-guard.ts tests/unit/locked-clients.test.ts
git commit -m "feat(billing): client lock ranking (computeLockedClientIds, getLockedClientIds)"
```

---

### Task 3: make-active endpoint + `lockedClientIds` in clients list

**Files:**
- Create: `app/api/clients/[id]/make-active/route.ts`
- Modify: `app/api/clients/route.ts` (GET response ~line 121)

**Interfaces:**
- Consumes: `getLockedClientIds` from `@/lib/plan-guard`
- Produces: `POST /api/clients/[id]/make-active` → `{ success: true }`; clients GET response gains `lockedClientIds: string[]`

- [ ] **Step 1: Create the make-active route**

Create `app/api/clients/[id]/make-active/route.ts` (allowed even when locked — it's the escape hatch):

```typescript
import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { createLogger } from "@/lib/logger";

const logger = createLogger("clients:make-active");

/**
 * POST /api/clients/[id]/make-active
 * Bumps the client's plan_priority_at to NOW() so it becomes the kept-active
 * client under the plan cap (and the previously-active one locks). Free action,
 * allowed even while the client is plan-locked.
 */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ success: false, error_code: "UNAUTHORIZED", message: "לא מחובר" }, { status: 401 });
    }
    const { id } = await context.params;
    const { query } = await import("@/lib/db");
    const result = await query(
      `UPDATE clients SET plan_priority_at = NOW() WHERE id = $1 AND user_id = $2`,
      [id, user.id]
    );
    if (result.rowCount === 0) {
      return NextResponse.json({ success: false, error_code: "NOT_FOUND", message: "לקוח לא נמצא" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("make-active failed", error);
    return NextResponse.json({ success: false, error_code: "SERVER_ERROR", message: "שגיאת שרת" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Add `lockedClientIds` to the clients GET response**

In `app/api/clients/route.ts`, the GET handler already computes `plan` via `getUserPlan`. Before the `NextResponse.json({ success: true, clients, plan: {...} })` (~line 121), add:

```typescript
    const { getLockedClientIds } = await import("@/lib/plan-guard");
    const lockedClientIds = Array.from(await getLockedClientIds(user.id));
```

and add `lockedClientIds` to the returned object:

```typescript
    return NextResponse.json({ success: true, clients, plan: { /* existing */ }, lockedClientIds });
```

(Keep the existing `plan` object exactly as-is; only add the new field.)

- [ ] **Step 3: Manual verify (dev) — make-active + list**

Run dev, with a non-founding user whose trial is expired and who has ≥2 active clients (set `trial_ends_at` to the past via psql to simulate):
```bash
# expire the trial of a test user, then:
curl -s localhost:3000/api/clients -H "cookie: <session>" | python3 -c "import sys,json;d=json.load(sys.stdin);print('locked:',d.get('lockedClientIds'))"
```
Expected: `lockedClientIds` lists all active clients except the most-recently-active one. After POSTing make-active on a locked client, it leaves the locked set.

(If interactive cookie auth is impractical for the implementer, SKIP the curl and instead verify by reading the code + the unit tests; note the deferral. The controller will cover it in E2E.)

- [ ] **Step 4: Commit**

```bash
git add app/api/clients/[id]/make-active/route.ts app/api/clients/route.ts
git commit -m "feat(billing): make-active endpoint + lockedClientIds in clients list"
```

---

### Task 4: Apply the 402 guard to billable-write routes

Insert the same guard after ownership is verified in each route below. The guard pattern (resolve the client id for the write, then check):

```typescript
const { getLockedClientIds, lockedClientResponse } = await import("@/lib/plan-guard");
if ((await getLockedClientIds(userId)).has(clientId)) return lockedClientResponse();
```

Inside a `withTransaction` callback that returns a sentinel (not a NextResponse), return a marker the outer code maps to `lockedClientResponse()` — e.g. `return { planLocked: true }` then, after the transaction, `if (result?.planLocked) return lockedClientResponse();`. Match each route's existing return-sentinel style (the map below notes tx vs plain query).

**Files (modify), with insertion point + how to get `clientId`:**

- `app/api/timer/start/route.ts:49` — extend `projectCheck` to `SELECT id, client_id FROM projects WHERE id=$1 AND user_id=$2`; guard after the not-found check (tx → use sentinel).
- `app/api/entries/route.ts:161` — extend the projectCheck JOIN to also select `c.id AS client_id`; guard after not-found (tx sentinel).
- `app/api/entries/[id]/route.ts:108` (PUT only) — extend projectCheck to select `c.id AS client_id`; guard after not-found (tx sentinel). (DELETE is allowed — do NOT guard it.)
- `app/api/projects/route.ts:202` (POST) — `clientId` already in scope from body + verified; guard after the clientCheck not-found (tx sentinel).
- `app/api/projects/[id]/route.ts:199` (PUT only) — add `client_id` to the `currentResult` SELECT; guard after not-found (tx sentinel). (DELETE allowed — do NOT guard.)
- `app/api/projects/[id]/duplicate/route.ts:77` (POST) — `original.client_id` already selected; guard after not-found (tx sentinel).
- `app/api/charge-documents/route.ts:61` (POST) — `clientId` in scope; this route THROWS inside the tx and catches downstream — `throw new Error("CLIENT_PLAN_LOCKED")` and map that message to a 402 in the existing catch (add a branch returning `lockedClientResponse()` when `error.message === "CLIENT_PLAN_LOCKED"`).
- `app/api/clients/[id]/route.ts:231` (PUT only) — `clientId` is the param; guard after not-found (tx sentinel). (PATCH reactivate + DELETE archive are EXEMPT — do NOT guard them.)
- `app/api/clients/[id]/rates/route.ts:84` (POST) — `clientId` is the param; guard after the owns-check (tx sentinel).
- `app/api/tasks/route.ts:87` (POST) — `clientId` in scope from body; guard after projectCheck (tx sentinel).
- `app/api/tasks/[id]/move/route.ts:41` (PATCH) — add `client_id` to the task SELECT (line 32); guard after `const task = existing.rows[0]` using `task.client_id` (plain query precedes tx — guard before the tx).

**Test:** `tests/unit/plan-guard-routes.test.ts` (create) — a focused unit test of the sentinel-mapping helper (see Step 1). Route-level enforcement is verified by the final E2E (interactive auth + DB not available to the unit runner).

- [ ] **Step 1: Write a unit test for a shared sentinel mapper**

To make route wiring DRY and testable, add a tiny pure helper to `lib/plan-guard.ts` and test it. Create `tests/unit/plan-guard-routes.test.ts`:

```typescript
import { isPlanLockedSentinel } from "../../lib/plan-guard";

class TestRunner {
  private tests: Array<{ name: string; fn: () => void }> = [];
  private passed = 0; private failed = 0;
  test(name: string, fn: () => void) { this.tests.push({ name, fn }); }
  async run() {
    console.log("🧪 Running plan-guard-routes tests...\n");
    for (const { name, fn } of this.tests) {
      try { fn(); this.passed++; console.log(`  ✅ ${name}`); }
      catch (e) { this.failed++; console.error(`  ❌ ${name}`); if (e instanceof Error) console.error(`     ${e.message}`); }
    }
    console.log(`\n${this.passed} passed, ${this.failed} failed`);
    if (this.failed > 0) process.exit(1);
  }
}
function assertEqual<T>(a: T, b: T, m?: string) { if (a !== b) throw new Error(m ?? `Expected ${b}, got ${a}`); }
const runner = new TestRunner();

runner.test("recognizes the planLocked sentinel", () => {
  assertEqual(isPlanLockedSentinel({ planLocked: true }), true);
});
runner.test("ignores other objects", () => {
  assertEqual(isPlanLockedSentinel({ notFound: true }), false);
  assertEqual(isPlanLockedSentinel(null), false);
  assertEqual(isPlanLockedSentinel({ id: "x" }), false);
});

runner.run();
```

- [ ] **Step 2: Run it (fails — helper missing)**

Run: `npx tsx tests/unit/plan-guard-routes.test.ts`
Expected: FAIL — `isPlanLockedSentinel` not exported.

- [ ] **Step 3: Add the sentinel helper to `lib/plan-guard.ts`**

```typescript
/** Type guard for the in-transaction plan-locked sentinel returned by routes. */
export function isPlanLockedSentinel(value: unknown): value is { planLocked: true } {
  return typeof value === "object" && value !== null && (value as { planLocked?: unknown }).planLocked === true;
}
```

- [ ] **Step 4: Run it (passes)**

Run: `npx tsx tests/unit/plan-guard-routes.test.ts`
Expected: PASS — 2 passed, 0 failed.

- [ ] **Step 5: Wire the guard into all 11 routes**

Apply the guard at each insertion point listed above. For tx routes use the `{ planLocked: true }` sentinel + `isPlanLockedSentinel(result)` → `lockedClientResponse()` after the transaction. For `tasks/[id]/move` (plain query before tx) and `charge-documents` (throw/catch), follow the route-specific notes above. Extend the noted SELECTs to include `client_id` where required.

- [ ] **Step 6: Verify typecheck, lint, and full unit suite**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: tsc clean, lint clean, all unit files pass (incl. the two new plan-guard test files).

- [ ] **Step 7: Commit**

```bash
git add app/api lib/plan-guard.ts tests/unit/plan-guard-routes.test.ts
git commit -m "feat(billing): 402 guard on billable-write routes for plan-locked clients"
```

---

## Decisions & deferrals (no silent caps)
- **Guarded (402):** timer/start, entries POST, entries/[id] PUT, projects POST, projects/[id] PUT, projects/[id]/duplicate, charge-documents POST, clients/[id] PUT, clients/[id]/rates POST, tasks POST, tasks/[id]/move.
- **Intentionally NOT guarded (allowed on locked clients):** all GET/reads; entries/[id] DELETE; entries/bulk PATCH+DELETE; projects/[id] DELETE; clients/[id] DELETE (archive) + PATCH (reactivate); make-active. Rationale: deletes/archiving let users reduce below the cap; bulk-edit of existing entries is an edge path. If product wants bulk-edit locked too, add it in a follow-up.
- `getLockedClientIds` runs one extra query per guarded write. Acceptable (writes are infrequent, query is indexed on `clients(user_id, is_active)` and `time_entries(project_id)`).

## Self-Review
- Spec §5 coverage: lock ranking (Task 2), `plan_priority_at` + make-active switch (Tasks 1, 3), server-side 402 enforcement (Task 4), `lockedClientIds` for UI (Task 3), data-safety/no-delete-block (Decisions). ✅
- Placeholder scan: none — full code for helper, endpoint, test; per-route insertions cite file:line + client-id source.
- Type consistency: `computeLockedClientIds`/`getLockedClientIds`/`lockedClientResponse`/`isPlanLockedSentinel` defined in Task 2-4 and consumed by Task 3-4 and Plan 3 (clients UI reads `lockedClientIds` + `error_code` "CLIENT_PLAN_LOCKED").
