# Tasks Kanban (משימות) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a standalone "משימות" Kanban board (single per-user board, fixed columns חדש/בעבודה/הושלם) where each task carries client+project+rate+priority+due-date+tags, and dragging a task into "בעבודה" starts a timer automatically; replace the old per-project task checklist.

**Architecture:** Migrate the existing `tasks` table in place (ALTER + backfill, preserving `time_entries.task_id`). Pure decision logic (fractional ordering, drag→timer effect) lives in small tested `lib/` modules; API routes stay thin and reuse `withTransaction()`. The board UI uses `@dnd-kit` and integrates with the existing `timer-context` (start via a transactional `move` endpoint, stop via the existing stop modal).

**Tech Stack:** Next.js 16 App Router, PostgreSQL (`lib/db.ts` raw `query`/`withTransaction`), Drizzle schema (`src/db/schema.ts`), Better Auth (`getUser`), Zod (`parseBody`), `@dnd-kit/core` + `@dnd-kit/sortable`, Tailwind v4 design tokens, custom tsx test runner (`tests/run-tests.ts`).

**Spec:** `docs/superpowers/specs/2026-06-02-tasks-kanban-design.md`

---

## Conventions (read before starting)

- **API response shape:** `{ success: boolean, ... }`; user-facing messages in **Hebrew**. Auth guard at the top of every route:
  ```ts
  const user = await getUser();
  if (!user) return NextResponse.json({ success: false, message: "לא מחובר" }, { status: 401 });
  ```
- **Every query filtered by `user.id`** (defense-in-depth above RLS). `tasks` already has a `tenant_isolation` RLS policy keyed on `user_id` — keep the `user_id` column and the WHERE filter.
- **Tokens only** in UI (`bg-card`, `border-border`, `text-foreground`, `bg-primary`+`text-primary-foreground`, `destructive`); RTL logical props (`ps-*`, `me-*`); no hardcoded colors/shadows.
- **Migrations:** apply to **DEV** via `psql` with `DATABASE_URL_ADMIN` (NOT `db:migrate` — see memory `drizzle-meta-drift`). PROD is a separate reviewed step.
- **Tests:** each `tests/unit/*.test.ts` is a standalone tsx file using the inline `TestRunner` pattern (see `tests/unit/rounding.test.ts`). Run one with `npx tsx tests/unit/<file>.test.ts`; run all with `npm test`.
- **Commits:** conventional (`feat:`/`test:`/`chore:`), small and frequent. Branch: `feat/tasks-kanban`.

---

## File Structure

**Create:**
- `drizzle/0015_tasks_kanban.sql` — ALTER `tasks` + backfill.
- `lib/tasks-order.ts` — fractional position helper (pure).
- `lib/tasks-move.ts` — drag→timer effect decision (pure).
- `lib/schemas/tasks.ts` — Zod schemas + shared TS types (client+project+rate required).
- `app/api/tasks/route.ts` — GET (board) · POST (create).
- `app/api/tasks/[id]/route.ts` — PATCH (edit) · DELETE.
- `app/api/tasks/[id]/move/route.ts` — PATCH (status+position; + timer on entering in_progress).
- `app/tasks/page.tsx` — board page (client component, like `app/clients/page.tsx`).
- `components/tasks/kanban-board.tsx` — DnD context, three columns, filters, 4 states.
- `components/tasks/kanban-column.tsx` — one droppable column.
- `components/tasks/task-card.tsx` — card presentation.
- `components/tasks/task-form-dialog.tsx` — create/edit dialog.
- `components/tasks/task-detail-sheet.tsx` — detail view + timer action.
- `lib/tasks-types.ts` — shared `TaskRecord`, `TaskStatus`, `TaskPriority` types (imported by API + UI).
- `tests/unit/tasks-order.test.ts`, `tests/unit/tasks-move.test.ts`, `tests/unit/tasks-schema.test.ts`.

**Modify:**
- `src/db/schema.ts:251-273` — extend the `tasks` table definition.
- `lib/nav-items.ts:12-20` — add the "משימות" nav item.
- `contexts/timer-context.tsx` — add `startTimerForTask` + expose `runningTimers` task mapping (already exposed) and reuse `handleStopTimer`.
- `components/timer-start-modal.tsx` — repoint task dropdown source (tasks are global now) — only if it breaks; see Task 13.
- `app/projects/[id]/page.tsx` — remove the per-project tasks section.

**Delete:**
- `app/api/projects/[id]/tasks/route.ts` and `app/api/projects/[id]/tasks/[taskId]/route.ts` (if present).

---

## Task 1: Install and verify the DnD library

**Files:** `package.json`

- [ ] **Step 1: Confirm the API via Context7 and check for an existing dep**

Run: `grep -iE "dnd|sortable|drag" package.json` → expect no matches (none installed).
Use Context7 (`resolve-library-id` → `query-docs` for `@dnd-kit/core`) to confirm the current React-19-compatible API for `DndContext`, `useDraggable`/`useDroppable`, `@dnd-kit/sortable` `SortableContext`, and RTL handling.

- [ ] **Step 2: Install**

Run: `npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`
Expected: packages added to `dependencies`, no peer-dep errors against React 19.

- [ ] **Step 3: Verify build still boots**

Run: `npm run lint`
Expected: passes (zero warnings — see memory `ci-lint-baseline`).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(tasks): add @dnd-kit for the Kanban board"
```

---

## Task 2: Shared types module

**Files:** Create `lib/tasks-types.ts`

- [ ] **Step 1: Write the types**

```ts
/** Shared task types used by API routes and board UI. */

export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "normal" | "high" | "urgent";

export const TASK_STATUSES: readonly TaskStatus[] = ["todo", "in_progress", "done"];
export const TASK_PRIORITIES: readonly TaskPriority[] = ["normal", "high", "urgent"];

/** Hebrew column labels, in board (RTL) order. */
export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "חדש",
  in_progress: "בעבודה",
  done: "הושלם",
};

export const TASK_PRIORITY_LABEL: Record<TaskPriority, string> = {
  normal: "רגילה",
  high: "גבוהה",
  urgent: "דחוף",
};

/** A task row as returned to the client by /api/tasks. */
export interface TaskRecord {
  id: string;
  clientId: string;
  clientName: string;
  projectId: string;
  projectName: string;
  rateId: string | null;
  rate: number | null;
  rateLabel: string | null;
  title: string;
  notes: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null; // ISO date (YYYY-MM-DD) or null
  position: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors from this file.

- [ ] **Step 3: Commit**

```bash
git add lib/tasks-types.ts
git commit -m "feat(tasks): shared task types and status/priority constants"
```

---

## Task 3: Fractional ordering helper (TDD)

**Files:** Create `lib/tasks-order.ts`, `tests/unit/tasks-order.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
/** Unit tests for lib/tasks-order.ts — fractional position math for drag & drop. */
import { positionBetween, INITIAL_POSITION, POSITION_GAP } from "../../lib/tasks-order";

class TestRunner {
  private tests: Array<{ name: string; fn: () => void }> = [];
  private passed = 0;
  private failed = 0;
  test(name: string, fn: () => void) { this.tests.push({ name, fn }); }
  async run() {
    console.log("🧪 Running tasks-order.ts tests...\n");
    for (const { name, fn } of this.tests) {
      try { fn(); this.passed++; console.log(`  ✅ ${name}`); }
      catch (e) { this.failed++; console.error(`  ❌ ${name}`); if (e instanceof Error) console.error(`     ${e.message}`); }
    }
    console.log(`\n📊 Results: ${this.passed} passed, ${this.failed} failed`);
    return this.failed === 0;
  }
}
function assertEqual<T>(actual: T, expected: T, msg?: string) {
  if (actual !== expected) throw new Error(msg || `Expected "${expected}" but got "${actual}"`);
}
function assertTrue(cond: boolean, msg?: string) { if (!cond) throw new Error(msg || "expected true"); }

const runner = new TestRunner();

runner.test("empty column: first item gets INITIAL_POSITION", () => {
  assertEqual(positionBetween(null, null), INITIAL_POSITION);
});
runner.test("drop at top: above the first item", () => {
  assertEqual(positionBetween(null, 1000), 1000 - POSITION_GAP);
});
runner.test("drop at bottom: below the last item", () => {
  assertEqual(positionBetween(1000, null), 1000 + POSITION_GAP);
});
runner.test("drop between two items: midpoint", () => {
  assertEqual(positionBetween(1000, 2000), 1500);
});
runner.test("midpoint stays strictly between neighbors", () => {
  const p = positionBetween(1000, 1001);
  assertTrue(p > 1000 && p < 1001, `expected 1000 < ${p} < 1001`);
});

runner.run().then((ok) => process.exit(ok ? 0 : 1));
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx tests/unit/tasks-order.test.ts`
Expected: FAIL — `Cannot find module '../../lib/tasks-order'`.

- [ ] **Step 3: Write minimal implementation**

```ts
/** Fractional positioning for Kanban drag & drop. A reorder sets the moved
 *  row's `position` to the midpoint of its new neighbors, touching one row. */

/** Position assigned to the first card in an empty column. */
export const INITIAL_POSITION = 1000;
/** Gap used when inserting at the top or bottom of a column. */
export const POSITION_GAP = 1000;

/**
 * Compute a `position` for a card dropped between `before` (the neighbor above,
 * smaller position) and `after` (the neighbor below, larger position). Pass
 * `null` for a missing neighbor (top/bottom/empty column).
 */
export function positionBetween(before: number | null, after: number | null): number {
  if (before === null && after === null) return INITIAL_POSITION;
  if (before === null) return (after as number) - POSITION_GAP;
  if (after === null) return before + POSITION_GAP;
  return (before + after) / 2;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx tests/unit/tasks-order.test.ts`
Expected: PASS — `5 passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add lib/tasks-order.ts tests/unit/tasks-order.test.ts
git commit -m "feat(tasks): fractional ordering helper with tests"
```

---

## Task 4: Drag→timer effect decision (TDD)

**Files:** Create `lib/tasks-move.ts`, `tests/unit/tasks-move.test.ts`

This is the pure heart of the feature: given a move, decide whether to start a timer, open the stop modal, or just persist status/position.

- [ ] **Step 1: Write the failing test**

```ts
/** Unit tests for lib/tasks-move.ts — the drag→timer effect decision. */
import { moveEffect } from "../../lib/tasks-move";

class TestRunner {
  private tests: Array<{ name: string; fn: () => void }> = [];
  private passed = 0; private failed = 0;
  test(name: string, fn: () => void) { this.tests.push({ name, fn }); }
  async run() {
    console.log("🧪 Running tasks-move.ts tests...\n");
    for (const { name, fn } of this.tests) {
      try { fn(); this.passed++; console.log(`  ✅ ${name}`); }
      catch (e) { this.failed++; console.error(`  ❌ ${name}`); if (e instanceof Error) console.error(`     ${e.message}`); }
    }
    console.log(`\n📊 Results: ${this.passed} passed, ${this.failed} failed`);
    return this.failed === 0;
  }
}
function assertEqual<T>(a: T, b: T, m?: string) { if (a !== b) throw new Error(m || `Expected "${b}" but got "${a}"`); }
const runner = new TestRunner();

runner.test("todo → in_progress: start a timer", () => {
  assertEqual(moveEffect({ from: "todo", to: "in_progress", hasRunningTimer: false }), "start_timer");
});
runner.test("done → in_progress: start a timer", () => {
  assertEqual(moveEffect({ from: "done", to: "in_progress", hasRunningTimer: false }), "start_timer");
});
runner.test("in_progress → in_progress (reorder): plain, no second timer", () => {
  assertEqual(moveEffect({ from: "in_progress", to: "in_progress", hasRunningTimer: true }), "plain");
});
runner.test("in_progress → done WITH running timer: open stop modal", () => {
  assertEqual(moveEffect({ from: "in_progress", to: "done", hasRunningTimer: true }), "open_stop_modal");
});
runner.test("in_progress → todo WITH running timer: open stop modal", () => {
  assertEqual(moveEffect({ from: "in_progress", to: "todo", hasRunningTimer: true }), "open_stop_modal");
});
runner.test("in_progress → done WITHOUT running timer: plain", () => {
  assertEqual(moveEffect({ from: "in_progress", to: "done", hasRunningTimer: false }), "plain");
});
runner.test("todo → done (no in_progress involved): plain", () => {
  assertEqual(moveEffect({ from: "todo", to: "done", hasRunningTimer: false }), "plain");
});
runner.test("todo → todo (reorder): plain", () => {
  assertEqual(moveEffect({ from: "todo", to: "todo", hasRunningTimer: false }), "plain");
});

runner.run().then((ok) => process.exit(ok ? 0 : 1));
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx tests/unit/tasks-move.test.ts`
Expected: FAIL — `Cannot find module '../../lib/tasks-move'`.

- [ ] **Step 3: Write minimal implementation**

```ts
import type { TaskStatus } from "./tasks-types";

/** What the client/server should do as a result of a drag move. */
export type MoveEffect = "start_timer" | "open_stop_modal" | "plain";

export interface MoveInput {
  from: TaskStatus;
  to: TaskStatus;
  /** Whether a timer is currently running for THIS task. */
  hasRunningTimer: boolean;
}

/**
 * Decide the side effect of a Kanban move:
 * - Entering "in_progress" from another column → start a timer.
 * - Leaving "in_progress" while a timer runs → open the stop modal (status is
 *   committed only after the stop is confirmed by the caller).
 * - Everything else (reorders, todo↔done, leaving in_progress with no timer) → plain.
 */
export function moveEffect({ from, to, hasRunningTimer }: MoveInput): MoveEffect {
  if (to === "in_progress" && from !== "in_progress") return "start_timer";
  if (from === "in_progress" && to !== "in_progress" && hasRunningTimer) return "open_stop_modal";
  return "plain";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx tests/unit/tasks-move.test.ts`
Expected: PASS — `8 passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add lib/tasks-move.ts tests/unit/tasks-move.test.ts
git commit -m "feat(tasks): pure drag→timer effect decision with tests"
```

---

## Task 5: Zod schemas (TDD)

**Files:** Create `lib/schemas/tasks.ts`, `tests/unit/tasks-schema.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
/** Unit tests for lib/schemas/tasks.ts */
import { createTaskSchema, updateTaskSchema, moveTaskSchema } from "../../lib/schemas/tasks";

class TestRunner {
  private tests: Array<{ name: string; fn: () => void }> = [];
  private passed = 0; private failed = 0;
  test(name: string, fn: () => void) { this.tests.push({ name, fn }); }
  async run() {
    console.log("🧪 Running tasks-schema tests...\n");
    for (const { name, fn } of this.tests) {
      try { fn(); this.passed++; console.log(`  ✅ ${name}`); }
      catch (e) { this.failed++; console.error(`  ❌ ${name}`); if (e instanceof Error) console.error(`     ${e.message}`); }
    }
    console.log(`\n📊 Results: ${this.passed} passed, ${this.failed} failed`);
    return this.failed === 0;
  }
}
function assertTrue(c: boolean, m?: string) { if (!c) throw new Error(m || "expected true"); }
function assertFalse(c: boolean, m?: string) { if (c) throw new Error(m || "expected false"); }
const runner = new TestRunner();

const validCreate = {
  clientId: "c1", projectId: "p1", rateId: "r1",
  title: "כתיבת דוח", notes: "פרטים", priority: "high",
  dueDate: "2026-06-30", tags: ["דחוף"],
};

runner.test("create: valid payload passes", () => {
  assertTrue(createTaskSchema.safeParse(validCreate).success);
});
runner.test("create: missing clientId fails (client required)", () => {
  assertFalse(createTaskSchema.safeParse({ ...validCreate, clientId: "" }).success);
});
runner.test("create: missing projectId fails", () => {
  assertFalse(createTaskSchema.safeParse({ ...validCreate, projectId: undefined }).success);
});
runner.test("create: missing rateId fails (rate required)", () => {
  assertFalse(createTaskSchema.safeParse({ ...validCreate, rateId: "" }).success);
});
runner.test("create: empty title fails", () => {
  assertFalse(createTaskSchema.safeParse({ ...validCreate, title: "  " }).success);
});
runner.test("create: bad priority fails", () => {
  assertFalse(createTaskSchema.safeParse({ ...validCreate, priority: "later" }).success);
});
runner.test("create: dueDate omitted is allowed", () => {
  const { dueDate, ...noDue } = validCreate;
  assertTrue(createTaskSchema.safeParse(noDue).success);
});
runner.test("create: defaults priority to normal and tags to []", () => {
  const parsed = createTaskSchema.parse({ clientId: "c", projectId: "p", rateId: "r", title: "x" });
  assertTrue(parsed.priority === "normal" && Array.isArray(parsed.tags) && parsed.tags.length === 0);
});
runner.test("move: valid status + position passes", () => {
  assertTrue(moveTaskSchema.safeParse({ status: "in_progress", position: 1500 }).success);
});
runner.test("move: bad status fails", () => {
  assertFalse(moveTaskSchema.safeParse({ status: "archived", position: 1 }).success);
});
runner.test("update: partial payload (title only) passes", () => {
  assertTrue(updateTaskSchema.safeParse({ title: "שם חדש" }).success);
});

runner.run().then((ok) => process.exit(ok ? 0 : 1));
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx tests/unit/tasks-schema.test.ts`
Expected: FAIL — `Cannot find module '../../lib/schemas/tasks'`.

- [ ] **Step 3: Write minimal implementation**

```ts
import { z } from "zod";
import { TASK_STATUSES, TASK_PRIORITIES } from "../tasks-types";

const titleField = z
  .string({ message: "נא להזין שם משימה" })
  .trim()
  .min(1, "נא להזין שם משימה")
  .max(500, "שם המשימה ארוך מדי");

const priorityField = z.enum(
  TASK_PRIORITIES as unknown as [string, ...string[]],
  { message: "רמת דחיפות לא תקינה" }
);

const statusField = z.enum(
  TASK_STATUSES as unknown as [string, ...string[]],
  { message: "סטטוס לא תקין" }
);

const tagsField = z.array(z.string().trim().min(1).max(50)).max(50).default([]);

/** Create: client + project + rate are all required (the auto-timer needs them). */
export const createTaskSchema = z.object({
  clientId: z.string({ message: "נא לבחור לקוח" }).min(1, "נא לבחור לקוח"),
  projectId: z.string({ message: "נא לבחור פרויקט" }).min(1, "נא לבחור פרויקט"),
  rateId: z.string({ message: "נא לבחור תעריף" }).min(1, "נא לבחור תעריף"),
  title: titleField,
  notes: z.string().max(5000).nullish(),
  priority: priorityField.default("normal"),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "תאריך לא תקין").nullish(),
  tags: tagsField,
});

/** Update: any subset of editable fields. */
export const updateTaskSchema = z.object({
  clientId: z.string().min(1).optional(),
  projectId: z.string().min(1).optional(),
  rateId: z.string().min(1).optional(),
  title: titleField.optional(),
  notes: z.string().max(5000).nullish(),
  priority: priorityField.optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "תאריך לא תקין").nullish(),
  tags: z.array(z.string().trim().min(1).max(50)).max(50).optional(),
});

/** Move: target column + new fractional position. */
export const moveTaskSchema = z.object({
  status: statusField,
  position: z.number().finite(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type MoveTaskInput = z.infer<typeof moveTaskSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx tests/unit/tasks-schema.test.ts`
Expected: PASS — `11 passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add lib/schemas/tasks.ts tests/unit/tasks-schema.test.ts
git commit -m "feat(tasks): zod schemas for create/update/move with tests"
```

---

## Task 6: Schema definition + migration + backfill

**Files:** Modify `src/db/schema.ts:251-273`; Create `drizzle/0015_tasks_kanban.sql`

- [ ] **Step 1: Update the Drizzle `tasks` definition**

Replace the `tasks` table block (currently lines ~251-273) with:

```ts
export const tasks = pgTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    // Chosen hourly rate. SET NULL on rate delete (snapshot below keeps display).
    rateId: text("rate_id").references(() => clientRates.id, { onDelete: "set null" }),
    rate: real("rate"), // ₪/hour snapshot at assignment
    rateLabel: text("rate_label"), // rate name snapshot
    title: text("title").notNull(),
    notes: text("notes"),
    status: text("status").notNull().default("todo"),
    priority: text("priority").notNull().default("normal"),
    dueDate: date("due_date"),
    position: real("position").notNull().default(1000),
    tags: jsonb("tags").notNull().default([]),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_tasks_project_id").on(table.projectId),
    index("idx_tasks_user_id").on(table.userId),
    index("idx_tasks_user_status_position").on(table.userId, table.status, table.position),
    check("tasks_status_check", sql`${table.status} IN ('todo', 'in_progress', 'done')`),
    check("tasks_priority_check", sql`${table.priority} IN ('normal', 'high', 'urgent')`),
  ]
);
```

- [ ] **Step 2: Write the migration SQL**

Create `drizzle/0015_tasks_kanban.sql`:

```sql
-- Tasks Kanban: extend the per-project tasks table into a standalone, client/
-- project/rate-aware board model. ALTER + backfill in place (preserves
-- time_entries.task_id links).
--
-- Apply with the privileged role (DATABASE_URL_ADMIN), not db:migrate — see
-- memory drizzle-meta-drift. DEV first; PROD pending (separate reviewed step).

-- 1. New columns (nullable first so backfill can populate them).
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS client_id  text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS rate_id    text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS rate       real;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS rate_label text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS title      text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority   text NOT NULL DEFAULT 'normal';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_date   date;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS position   real NOT NULL DEFAULT 1000;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS tags       jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 2. Backfill title/notes from the old name/description columns.
UPDATE tasks SET title = name WHERE title IS NULL;

-- 3. Backfill client_id from the task's project.
UPDATE tasks t
SET client_id = p.client_id
FROM projects p
WHERE t.project_id = p.id AND t.client_id IS NULL;

-- 4. Backfill rate from the client's default hourly rate (default flag first,
--    else the first hourly rate). Leaves rate_id NULL if the client has none.
UPDATE tasks t
SET rate_id = cr.id, rate = cr.rate, rate_label = cr.name
FROM (
  SELECT DISTINCT ON (client_id) id, client_id, rate, name
  FROM client_rates
  WHERE kind = 'hourly'
  ORDER BY client_id, is_default DESC, created_at ASC
) cr
WHERE t.client_id = cr.client_id AND t.rate_id IS NULL;

-- 5. Sequential positions within each (user_id, status) bucket by created_at.
UPDATE tasks t
SET position = ord.rn * 1000
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id, status ORDER BY created_at) AS rn
  FROM tasks
) ord
WHERE t.id = ord.id;

-- 6. Enforce NOT NULL + FKs now that data is populated.
ALTER TABLE tasks ALTER COLUMN client_id SET NOT NULL;
ALTER TABLE tasks ALTER COLUMN title     SET NOT NULL;

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_client_id_fkey;
ALTER TABLE tasks ADD CONSTRAINT tasks_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_rate_id_fkey;
ALTER TABLE tasks ADD CONSTRAINT tasks_rate_id_fkey
  FOREIGN KEY (rate_id) REFERENCES client_rates(id) ON DELETE SET NULL;

-- 7. Priority guard + board index.
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_priority_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_priority_check
  CHECK (priority IN ('normal', 'high', 'urgent'));

CREATE INDEX IF NOT EXISTS idx_tasks_user_status_position
  ON tasks (user_id, status, position);

-- 8. Drop the now-superseded legacy columns (name → title, description → notes
--    already exists). `description` is kept as `notes`? No: tasks already has a
--    `description` column, NOT `notes`. Rename it.
ALTER TABLE tasks RENAME COLUMN description TO notes;
ALTER TABLE tasks DROP COLUMN IF EXISTS name;
```

> Note on Step 8: the old `tasks` table has `name` + `description`. We rename `description`→`notes` and drop `name` after copying it into `title`. If a fresh DB ever lacks `description`, the rename is a no-op-safe only if the column exists — on DEV it does. Verify with Step 4 below before running on PROD.

- [ ] **Step 3: Snapshot DEV, then apply the migration to DEV**

```bash
# Take a Neon branch/snapshot first (see memory: a recovery snapshot pattern is used).
# Then apply with the admin role:
psql "$DATABASE_URL_ADMIN" -f drizzle/0015_tasks_kanban.sql
```
Expected: `ALTER TABLE` / `UPDATE n` lines, no errors.

- [ ] **Step 4: Verify the migrated shape**

```bash
psql "$DATABASE_URL_ADMIN" -c "\d tasks"
psql "$DATABASE_URL_ADMIN" -c "SELECT id, client_id, project_id, rate_id, title, status, priority, position FROM tasks LIMIT 5;"
```
Expected: columns present, `name` gone, `notes` present, every row has `client_id`, `title`, and `position` populated.

- [ ] **Step 5: Verify schema compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/db/schema.ts drizzle/0015_tasks_kanban.sql
git commit -m "feat(tasks): migrate tasks table to standalone Kanban model + backfill"
```

---

## Task 7: GET + POST `/api/tasks`

**Files:** Create `app/api/tasks/route.ts`

- [ ] **Step 1: Implement the route**

```ts
import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { parseBody } from "@/lib/api-validation";
import { createTaskSchema } from "@/lib/schemas/tasks";
import { createLogger } from "@/lib/logger";
import type { TaskRecord } from "@/lib/tasks-types";

const logger = createLogger("tasks:list");

/** GET /api/tasks — all of the user's tasks for the board (optional ?projectId). */
export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ success: false, message: "לא מחובר" }, { status: 401 });

    const { query } = await import("@/lib/db");
    const projectId = new URL(request.url).searchParams.get("projectId");

    const params: (string)[] = [user.id];
    let where = " WHERE t.user_id = $1";
    if (projectId) { params.push(projectId); where += ` AND t.project_id = $2`; }

    const result = await query<Record<string, unknown>>(
      `SELECT t.id, t.client_id, c.name AS client_name, t.project_id, p.name AS project_name,
              t.rate_id, t.rate, t.rate_label, t.title, t.notes, t.status, t.priority,
              t.due_date, t.position, t.tags, t.created_at, t.updated_at
       FROM tasks t
       JOIN clients c ON c.id = t.client_id
       JOIN projects p ON p.id = t.project_id
       ${where}
       ORDER BY t.status, t.position ASC`,
      params
    );

    const tasks: TaskRecord[] = result.rows.map((r) => ({
      id: r.id as string,
      clientId: r.client_id as string,
      clientName: r.client_name as string,
      projectId: r.project_id as string,
      projectName: r.project_name as string,
      rateId: (r.rate_id as string) ?? null,
      rate: r.rate === null ? null : Number(r.rate),
      rateLabel: (r.rate_label as string) ?? null,
      title: r.title as string,
      notes: (r.notes as string) ?? null,
      status: r.status as TaskRecord["status"],
      priority: r.priority as TaskRecord["priority"],
      dueDate: r.due_date ? new Date(r.due_date as string).toISOString().slice(0, 10) : null,
      position: Number(r.position),
      tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
      createdAt: (r.created_at as Date)?.toISOString?.() ?? String(r.created_at),
      updatedAt: (r.updated_at as Date)?.toISOString?.() ?? String(r.updated_at),
    }));

    return NextResponse.json({ success: true, tasks });
  } catch (error) {
    logger.error("Failed to list tasks", error);
    return NextResponse.json({ success: false, message: "שגיאה בטעינת המשימות" }, { status: 500 });
  }
}

/** POST /api/tasks — create a task. Verifies the project belongs to the user and
 *  that the rate belongs to the chosen client; snapshots the rate value/label. */
export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ success: false, message: "לא מחובר" }, { status: 401 });

    const parsed = await parseBody(request, createTaskSchema);
    if (!parsed.ok) return parsed.response;
    const { clientId, projectId, rateId, title, notes, priority, dueDate, tags } = parsed.data;

    const { query } = await import("@/lib/db");

    // Ownership + relationship checks (project belongs to user AND to the client).
    const projectCheck = await query<{ id: string }>(
      `SELECT id FROM projects WHERE id = $1 AND client_id = $2 AND user_id = $3`,
      [projectId, clientId, user.id]
    );
    if (projectCheck.rows.length === 0)
      return NextResponse.json({ success: false, message: "הפרויקט לא נמצא" }, { status: 404 });

    // Rate must belong to the chosen client (snapshot its value+name).
    const rateCheck = await query<{ id: string; rate: number; name: string }>(
      `SELECT id, rate, name FROM client_rates
       WHERE id = $1 AND client_id = $2 AND user_id = $3 AND kind = 'hourly'`,
      [rateId, clientId, user.id]
    );
    if (rateCheck.rows.length === 0)
      return NextResponse.json({ success: false, message: "התעריף לא נמצא" }, { status: 404 });
    const chosen = rateCheck.rows[0];

    // New tasks land at the top of "חדש": one less than the current min position.
    const minPos = await query<{ min: number | null }>(
      `SELECT MIN(position) AS min FROM tasks WHERE user_id = $1 AND status = 'todo'`,
      [user.id]
    );
    const position = (minPos.rows[0]?.min ?? 1000) - 1000;

    const result = await query<{ id: string }>(
      `INSERT INTO tasks
         (id, user_id, client_id, project_id, rate_id, rate, rate_label, title, notes,
          status, priority, due_date, position, tags)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8,
               'todo', $9, $10, $11, $12::jsonb)
       RETURNING id`,
      [user.id, clientId, projectId, chosen.id, chosen.rate, chosen.name,
       title, notes ?? null, priority, dueDate ?? null, position, JSON.stringify(tags)]
    );

    return NextResponse.json({ success: true, id: result.rows[0].id });
  } catch (error) {
    logger.error("Failed to create task", error);
    return NextResponse.json({ success: false, message: "שגיאה ביצירת המשימה" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Manually verify create + list (DEV server running)**

```bash
# With the dev server up and an authenticated session cookie, or via the UI later.
# Smoke check that the file builds:
npx tsc --noEmit
```
Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/tasks/route.ts
git commit -m "feat(tasks): GET/POST /api/tasks with ownership + rate validation"
```

---

## Task 8: PATCH + DELETE `/api/tasks/[id]`

**Files:** Create `app/api/tasks/[id]/route.ts`

- [ ] **Step 1: Implement the route**

```ts
import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { parseBody } from "@/lib/api-validation";
import { updateTaskSchema } from "@/lib/schemas/tasks";
import { createLogger } from "@/lib/logger";

const logger = createLogger("tasks:item");

/** PATCH /api/tasks/[id] — edit fields. Re-snapshots rate if rateId changes. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ success: false, message: "לא מחובר" }, { status: 401 });

    const { id } = await params;
    const parsed = await parseBody(request, updateTaskSchema);
    if (!parsed.ok) return parsed.response;
    const data = parsed.data;

    const { query } = await import("@/lib/db");

    // Ownership.
    const existing = await query<{ id: string; client_id: string }>(
      `SELECT id, client_id FROM tasks WHERE id = $1 AND user_id = $2`,
      [id, user.id]
    );
    if (existing.rows.length === 0)
      return NextResponse.json({ success: false, message: "המשימה לא נמצאה" }, { status: 404 });

    // If rateId changes, re-validate against the (new or existing) client and re-snapshot.
    let rateSnapshot: { id: string; rate: number; name: string } | null = null;
    if (data.rateId) {
      const clientId = data.clientId ?? existing.rows[0].client_id;
      const r = await query<{ id: string; rate: number; name: string }>(
        `SELECT id, rate, name FROM client_rates
         WHERE id = $1 AND client_id = $2 AND user_id = $3 AND kind = 'hourly'`,
        [data.rateId, clientId, user.id]
      );
      if (r.rows.length === 0)
        return NextResponse.json({ success: false, message: "התעריף לא נמצא" }, { status: 404 });
      rateSnapshot = r.rows[0];
    }

    // Build a dynamic SET clause from provided fields only.
    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    const set = (col: string, v: unknown) => { sets.push(`${col} = $${i++}`); vals.push(v); };

    if (data.clientId !== undefined) set("client_id", data.clientId);
    if (data.projectId !== undefined) set("project_id", data.projectId);
    if (rateSnapshot) { set("rate_id", rateSnapshot.id); set("rate", rateSnapshot.rate); set("rate_label", rateSnapshot.name); }
    if (data.title !== undefined) set("title", data.title);
    if (data.notes !== undefined) set("notes", data.notes ?? null);
    if (data.priority !== undefined) set("priority", data.priority);
    if (data.dueDate !== undefined) set("due_date", data.dueDate ?? null);
    if (data.tags !== undefined) { sets.push(`tags = $${i++}::jsonb`); vals.push(JSON.stringify(data.tags)); }

    if (sets.length === 0)
      return NextResponse.json({ success: true, id });

    sets.push(`updated_at = NOW()`);
    vals.push(id, user.id);
    await query(
      `UPDATE tasks SET ${sets.join(", ")} WHERE id = $${i++} AND user_id = $${i++}`,
      vals
    );

    return NextResponse.json({ success: true, id });
  } catch (error) {
    logger.error("Failed to update task", error);
    return NextResponse.json({ success: false, message: "שגיאה בעדכון המשימה" }, { status: 500 });
  }
}

/** DELETE /api/tasks/[id] — remove a task. time_entries.task_id is SET NULL by FK. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ success: false, message: "לא מחובר" }, { status: 401 });

    const { id } = await params;
    const { query } = await import("@/lib/db");

    const result = await query<{ id: string }>(
      `DELETE FROM tasks WHERE id = $1 AND user_id = $2 RETURNING id`,
      [id, user.id]
    );
    if (result.rows.length === 0)
      return NextResponse.json({ success: false, message: "המשימה לא נמצאה" }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Failed to delete task", error);
    return NextResponse.json({ success: false, message: "שגיאה במחיקת המשימה" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "app/api/tasks/[id]/route.ts"
git commit -m "feat(tasks): PATCH/DELETE /api/tasks/[id] with ownership checks"
```

---

## Task 9: PATCH `/api/tasks/[id]/move` (transactional + timer)

**Files:** Create `app/api/tasks/[id]/move/route.ts`

- [ ] **Step 1: Implement the route**

```ts
import { NextRequest, NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { getUser } from "@/lib/auth";
import { parseBody } from "@/lib/api-validation";
import { moveTaskSchema } from "@/lib/schemas/tasks";
import { createLogger } from "@/lib/logger";

const logger = createLogger("tasks:move");

/**
 * PATCH /api/tasks/[id]/move — update status + position. When a task ENTERS
 * "in_progress" from another column, start a timer for it in the SAME transaction
 * (status change + time_entry insert are atomic). Leaving "in_progress" is a plain
 * status/position update — the client opens the existing stop modal separately.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ success: false, message: "לא מחובר" }, { status: 401 });

    const { id } = await params;
    const parsed = await parseBody(request, moveTaskSchema);
    if (!parsed.ok) return parsed.response;
    const { status, position } = parsed.data;

    const { query, withTransaction } = await import("@/lib/db");

    // Ownership + current status + the fields the timer needs.
    const existing = await query<{
      status: string; project_id: string; rate: number | null; rate_label: string | null; title: string;
    }>(
      `SELECT status, project_id, rate, rate_label, title FROM tasks WHERE id = $1 AND user_id = $2`,
      [id, user.id]
    );
    if (existing.rows.length === 0)
      return NextResponse.json({ success: false, message: "המשימה לא נמצאה" }, { status: 404 });

    const task = existing.rows[0];
    const enteringInProgress = status === "in_progress" && task.status !== "in_progress";

    let entryId: string | null = null;

    await withTransaction(async (client: PoolClient) => {
      await client.query(
        `UPDATE tasks SET status = $1, position = $2, updated_at = NOW() WHERE id = $3 AND user_id = $4`,
        [status, position, id, user.id]
      );

      if (enteringInProgress) {
        // Idempotent: don't start a second timer if one is already running for this task.
        const running = await client.query<{ id: string }>(
          `SELECT id FROM time_entries
           WHERE task_id = $1 AND user_id = $2 AND start_time IS NOT NULL AND end_time IS NULL
           LIMIT 1`,
          [id, user.id]
        );
        if (running.rows.length === 0) {
          const now = new Date();
          const today = now.toISOString().split("T")[0];
          const inserted = await client.query<{ id: string }>(
            `INSERT INTO time_entries
               (id, user_id, project_id, task_id, description, start_time, date, duration,
                is_billable, billing_kind, rate, rate_label)
             VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, 0, TRUE, 'hourly', $7, $8)
             RETURNING id`,
            [user.id, task.project_id, id, task.title, now.toISOString(), today, task.rate, task.rate_label]
          );
          entryId = inserted.rows[0].id;
        } else {
          entryId = running.rows[0].id;
        }
      }
    });

    return NextResponse.json({ success: true, entryId });
  } catch (error) {
    logger.error("Failed to move task", error);
    return NextResponse.json({ success: false, message: "שגיאה בעדכון המשימה" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual transaction smoke test (DEV)**

With the dev server and a session, move a task into "בעבודה" via curl (or wait for the UI in Task 12). Verify a running `time_entries` row was created with the task's `project_id`/`rate`. Then move it out and confirm no new entry is created by the endpoint.

- [ ] **Step 4: Commit**

```bash
git add "app/api/tasks/[id]/move/route.ts"
git commit -m "feat(tasks): transactional move endpoint that auto-starts a timer"
```

---

## Task 10: timer-context — start-for-task + stop reuse

**Files:** Modify `contexts/timer-context.tsx`

The board needs to (a) ask the context to refresh after a `move` starts a timer, and (b) open the existing stop modal for a task's running timer. `refreshTimer()`, `handleStopTimer(entryId)`, and `runningTimers` are already exposed. Add one helper that finds a task's running timer id.

- [ ] **Step 1: Add a `runningTimerForTask` helper to the context value**

In the `TimerContextValue` interface (near line 90), add:

```ts
  /** The running timer's entry id for a given task, or null. */
  runningTimerForTask: (taskId: string) => string | null;
```

In `defaultTimerValue` (near line 137), add:

```ts
  runningTimerForTask: () => null,
```

Implement it inside `TimerProvider` (near the other `useCallback`s, before `const value`):

```ts
  const runningTimerForTask = useCallback(
    (taskId: string): string | null =>
      runningTimers.find((t) => t.taskId === taskId)?.id ?? null,
    [runningTimers]
  );
```

Add `runningTimerForTask,` to the `value` object (near line 668).

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add contexts/timer-context.tsx
git commit -m "feat(tasks): expose runningTimerForTask from timer-context"
```

---

## Task 11: Nav item

**Files:** Modify `lib/nav-items.ts:12-20`

- [ ] **Step 1: Add the nav entry**

Insert after the "התחשבנות" line:

```ts
  { name: "משימות", href: "/tasks", iconName: "FolderKanban" },
```

(The `FolderKanban` icon is already in the `iconName` union — no type change needed.)

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/nav-items.ts
git commit -m "feat(tasks): add משימות to the sidebar nav"
```

---

## Task 12: Board UI — card, column, board, dialogs

**Files:** Create `components/tasks/task-card.tsx`, `kanban-column.tsx`, `kanban-board.tsx`, `task-form-dialog.tsx`, `task-detail-sheet.tsx`, `app/tasks/page.tsx`

This is the largest task. Build presentational pieces first, then the DnD board, then wire drag→timer. Use existing UI primitives in `components/ui/` (Dialog, Select, Input, Button, etc. — check what exists with `ls components/ui`).

- [ ] **Step 1: `task-card.tsx` — presentation**

```tsx
"use client";

import { TASK_PRIORITY_LABEL, type TaskRecord } from "@/lib/tasks-types";

interface TaskCardProps {
  task: TaskRecord;
  isTimerRunning: boolean;
  onClick: () => void;
}

/** Priority → token-based accent (no hardcoded colors). */
const priorityBar: Record<TaskRecord["priority"], string> = {
  normal: "bg-border",
  high: "bg-primary",
  urgent: "bg-destructive",
};

function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false;
  const today = new Date().toISOString().slice(0, 10);
  return dueDate < today;
}

export function TaskCard({ task, isTimerRunning, onClick }: TaskCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-start rounded-[var(--radius-card)] border border-border bg-card p-3 transition-colors hover:bg-card-elevated"
    >
      <div className="flex items-start gap-2">
        <span className={`mt-1 h-full w-1 shrink-0 rounded-full ${priorityBar[task.priority]}`} aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-sans font-medium text-foreground">{task.title}</span>
            {isTimerRunning && (
              <span className="shrink-0 rounded-[var(--radius)] bg-primary px-1.5 py-0.5 text-xs text-primary-foreground">
                טיימר רץ
              </span>
            )}
          </div>
          <div className="mt-1 truncate text-sm text-muted-foreground">
            {task.clientName} · {task.projectName}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {task.rateLabel ? (
              <span>{task.rateLabel}</span>
            ) : (
              <span className="text-destructive">חסר תעריף</span>
            )}
            {task.dueDate && (
              <span className={isOverdue(task.dueDate) ? "text-destructive" : ""}>
                יעד: {task.dueDate}
              </span>
            )}
            {task.priority !== "normal" && <span>{TASK_PRIORITY_LABEL[task.priority]}</span>}
            {task.tags.map((t) => (
              <span key={t} className="rounded-[var(--radius)] border border-border px-1.5 py-0.5">{t}</span>
            ))}
          </div>
        </div>
      </div>
    </button>
  );
}
```

- [ ] **Step 2: `kanban-column.tsx` — droppable column with the 3 internal states**

```tsx
"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { TASK_STATUS_LABEL, type TaskRecord, type TaskStatus } from "@/lib/tasks-types";
import { SortableTaskCard } from "./kanban-board"; // exported there to share dnd wiring

interface KanbanColumnProps {
  status: TaskStatus;
  tasks: TaskRecord[];
  runningTimerForTask: (taskId: string) => string | null;
  onCardClick: (task: TaskRecord) => void;
}

const EMPTY_LABEL: Record<TaskStatus, string> = {
  todo: "אין משימות חדשות",
  in_progress: "אין משימות בעבודה",
  done: "אין משימות שהושלמו",
};

export function KanbanColumn({ status, tasks, runningTimerForTask, onCardClick }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div className="flex min-w-72 flex-1 flex-col">
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="font-sans font-medium text-foreground">{TASK_STATUS_LABEL[status]}</span>
        <span className="text-sm text-muted-foreground tabular-nums">{tasks.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex min-h-32 flex-col gap-2 rounded-[var(--radius-card)] border border-border p-2 transition-colors ${isOver ? "bg-card-elevated" : "bg-surface"}`}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">{EMPTY_LABEL[status]}</p>
          ) : (
            tasks.map((task) => (
              <SortableTaskCard
                key={task.id}
                task={task}
                isTimerRunning={Boolean(runningTimerForTask(task.id))}
                onClick={() => onCardClick(task)}
              />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: `kanban-board.tsx` — DnD context + drag→timer wiring + board-level 4 states**

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, closestCorners, type DragEndEvent } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTimer } from "@/contexts/timer-context";
import { showErrorToast } from "@/lib/toast";
import { positionBetween } from "@/lib/tasks-order";
import { moveEffect } from "@/lib/tasks-move";
import { TASK_STATUSES, type TaskRecord, type TaskStatus } from "@/lib/tasks-types";
import { TaskCard } from "./task-card";
import { KanbanColumn } from "./kanban-column";
import { TaskDetailSheet } from "./task-detail-sheet";

/** Sortable wrapper around TaskCard (exported so the column can use it). */
export function SortableTaskCard(props: { task: TaskRecord; isTimerRunning: boolean; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.task.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      {...attributes}
      {...listeners}
    >
      <TaskCard task={props.task} isTimerRunning={props.isTimerRunning} onClick={props.onClick} />
    </div>
  );
}

interface BoardState { loading: boolean; error: boolean; tasks: TaskRecord[]; }

export function KanbanBoard() {
  const { refreshTimer, runningTimerForTask, handleStopTimer, onTimerStopped } = useTimer();
  const [state, setState] = useState<BoardState>({ loading: true, error: false, tasks: [] });
  const [selected, setSelected] = useState<TaskRecord | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: false }));
    try {
      const res = await fetch("/api/tasks");
      const data = await res.json();
      if (data.success) setState({ loading: false, error: false, tasks: data.tasks });
      else setState((s) => ({ ...s, loading: false, error: true }));
    } catch {
      setState((s) => ({ ...s, loading: false, error: true }));
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  // When a timer stops (e.g. via the stop modal after dragging out), refresh the board.
  useEffect(() => onTimerStopped(() => load()), [onTimerStopped, load]);

  const byStatus = (status: TaskStatus) =>
    state.tasks.filter((t) => t.status === status).sort((a, b) => a.position - b.position);

  const persistMove = useCallback(async (taskId: string, status: TaskStatus, position: number) => {
    const res = await fetch(`/api/tasks/${taskId}/move`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, position }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message || "move failed");
    return data.entryId as string | null;
  }, []);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const task = state.tasks.find((t) => t.id === active.id);
    if (!task) return;

    // Resolve target column: dropping over a column id, or over another card.
    const overId = String(over.id);
    const targetStatus: TaskStatus = (TASK_STATUSES as readonly string[]).includes(overId)
      ? (overId as TaskStatus)
      : state.tasks.find((t) => t.id === overId)?.status ?? task.status;

    const column = byStatus(targetStatus).filter((t) => t.id !== task.id);
    // Drop at end of column for simplicity; refine with index from `over` if needed.
    const last = column[column.length - 1]?.position ?? null;
    const position = positionBetween(last, null);

    const effect = moveEffect({
      from: task.status,
      to: targetStatus,
      hasRunningTimer: Boolean(runningTimerForTask(task.id)),
    });

    if (effect === "open_stop_modal") {
      // Open the existing stop modal; commit the move only after stop is confirmed.
      const entryId = runningTimerForTask(task.id);
      if (entryId) {
        const unsub = onTimerStopped(async () => {
          unsub();
          try { await persistMove(task.id, targetStatus, position); await load(); }
          catch { showErrorToast("שגיאה בעדכון המשימה"); }
        });
        handleStopTimer(entryId);
      }
      return; // do not move yet
    }

    // Optimistic move for start_timer / plain.
    setState((s) => ({
      ...s,
      tasks: s.tasks.map((t) => (t.id === task.id ? { ...t, status: targetStatus, position } : t)),
    }));
    try {
      await persistMove(task.id, targetStatus, position);
      if (effect === "start_timer") await refreshTimer();
      await load();
    } catch {
      showErrorToast("שגיאה בעדכון המשימה");
      await load(); // rollback to server truth
    }
  }, [state.tasks, runningTimerForTask, persistMove, load, refreshTimer, handleStopTimer, onTimerStopped]);

  if (state.loading) {
    return <div className="flex gap-4">{TASK_STATUSES.map((s) => (
      <div key={s} className="min-w-72 flex-1 animate-pulse rounded-[var(--radius-card)] border border-border bg-surface h-64" />
    ))}</div>;
  }
  if (state.error) {
    return (
      <div className="rounded-[var(--radius-card)] border border-border bg-card p-8 text-center">
        <p className="text-foreground">שגיאה בטעינת המשימות</p>
        <button onClick={load} className="mt-3 rounded-[var(--radius)] bg-primary px-4 py-2 text-primary-foreground">נסה שוב</button>
      </div>
    );
  }
  if (state.tasks.length === 0) {
    return (
      <div className="rounded-[var(--radius-card)] border border-border bg-card p-10 text-center">
        <p className="text-foreground">אין עדיין משימות</p>
        <p className="mt-1 text-sm text-muted-foreground">צור את המשימה הראשונה כדי להתחיל</p>
        {/* The "+ משימה חדשה" button lives in the page header; see app/tasks/page.tsx */}
      </div>
    );
  }

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {TASK_STATUSES.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              tasks={byStatus(status)}
              runningTimerForTask={runningTimerForTask}
              onCardClick={setSelected}
            />
          ))}
        </div>
      </DndContext>
      {selected && (
        <TaskDetailSheet
          task={selected}
          onClose={() => setSelected(null)}
          onChanged={() => { setSelected(null); load(); }}
        />
      )}
    </>
  );
}
```

> Note: RTL — dnd-kit positions follow DOM order; the flex row sits inside the app's `dir="rtl"` root, so columns read right-to-left automatically. Verify visually in Task 14.

- [ ] **Step 4: `task-form-dialog.tsx` — create/edit (dependent client→project→rate selects)**

Build a dialog using the existing `components/ui/dialog` + `select`/`input`. Fields: client (select), project (filtered by client), rate (hourly rates of the client, default preselected via `pickDefaultHourlyRate`), title, notes (textarea), priority (select: רגילה/גבוהה/דחוף), dueDate (date input), tags (simple comma/enter input). On submit POST `/api/tasks` (create) or PATCH `/api/tasks/[id]` (edit). Reuse the fetch patterns from `timer-context` (`/api/projects`, `/api/clients/[id]/rates`). All strings Hebrew, tokens only. Validate client+project+rate present before enabling submit (mirror `createTaskSchema`).

(Full field code follows the same token/RTL patterns as `task-card.tsx`; keep the file < 300 lines.)

- [ ] **Step 5: `task-detail-sheet.tsx` — detail + actions**

A sheet/dialog showing the task's client, project, rate, due date, priority, tags, and notes, with **Edit** (opens the form dialog), **Delete** (DELETE `/api/tasks/[id]`, with a confirm), and a clear read of whether a timer is running for it. Delete and edit call `onChanged()` to refresh the board.

- [ ] **Step 6: `app/tasks/page.tsx` — the board page**

```tsx
"use client";

import { useState } from "react";
import { KanbanBoard } from "@/components/tasks/kanban-board";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";

export default function TasksPage() {
  const [creating, setCreating] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-sans font-bold text-foreground">משימות</h1>
        <button
          onClick={() => setCreating(true)}
          className="rounded-[var(--radius)] bg-primary px-4 py-2 font-medium text-primary-foreground"
        >
          + משימה חדשה
        </button>
      </div>
      <KanbanBoard key={reloadKey} />
      {creating && (
        <TaskFormDialog
          mode="create"
          onClose={() => setCreating(false)}
          onSaved={() => { setCreating(false); setReloadKey((k) => k + 1); }}
        />
      )}
    </div>
  );
}
```

> Match the page chrome (container width, header) to `app/clients/page.tsx` so it's consistent. Confirm the auth-gating wrapper used by other top-level pages (layout-level) covers `/tasks`.

- [ ] **Step 7: Verify build + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no type errors, zero lint warnings.

- [ ] **Step 8: Commit**

```bash
git add app/tasks components/tasks
git commit -m "feat(tasks): Kanban board UI with drag→timer integration and 4 states"
```

---

## Task 13: Repoint the timer start modal's task dropdown

**Files:** Modify `components/timer-start-modal.tsx` and `contexts/timer-context.tsx` (the task fetch effect, ~lines 272-295)

The timer modal lists tasks for the selected project via `GET /api/projects/[id]/tasks`, which is being removed. Repoint it to the new endpoint.

- [ ] **Step 1: Change the task fetch source in `timer-context.tsx`**

In the effect that fetches tasks for the timer modal (currently `fetch(\`/api/projects/${selectedProject}/tasks\`)`), change to:

```ts
const response = await fetch(`/api/tasks?projectId=${selectedProject}`);
const data = await response.json();
if (data.success) {
  setTimerTasks(
    (data.tasks || [])
      .filter((t: { status: string }) => t.status !== "done")
      .map((t: { id: string; title: string }) => ({ id: t.id, name: t.title }))
  );
}
```

(Note `title` replaces `name`.)

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add contexts/timer-context.tsx
git commit -m "fix(tasks): point timer modal task dropdown at /api/tasks"
```

---

## Task 14: Remove the legacy per-project tasks feature

**Files:** Delete `app/api/projects/[id]/tasks/route.ts` (+ any `[taskId]` subroute); Modify `app/projects/[id]/page.tsx`

- [ ] **Step 1: Find every reference to the old endpoint/section**

Run: `grep -rn "projects/.*/tasks\|newTaskName\|handleCreateTask\|tasksLoading" app components`
Expected: references in `app/projects/[id]/page.tsx` and the API route only.

- [ ] **Step 2: Delete the API route(s)**

```bash
rm -rf "app/api/projects/[id]/tasks"
```

- [ ] **Step 3: Remove the tasks section from the project page**

In `app/projects/[id]/page.tsx`, remove the tasks `interface Task`, the `tasks`/`tasksLoading`/`newTaskName`/`creatingTask` state, the fetch effect, `handleCreateTask`, and the JSX section that renders the task checklist. Leave the rest of the page intact. Add a small link/hint pointing to the new "/tasks" board if appropriate.

- [ ] **Step 4: Verify build + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no type errors, no unused-var warnings, zero lint warnings.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(tasks): remove legacy per-project task checklist + API"
```

---

## Task 15: Full test run, manual verification, reviews

**Files:** none (verification)

- [ ] **Step 1: Run the whole unit suite**

Run: `npm test`
Expected: all files pass, including `tasks-order`, `tasks-move`, `tasks-schema`.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: production build succeeds.

- [ ] **Step 3: Manual end-to-end check (DEV) — the four critical flows**

With `npm run dev` and a logged-in user:
1. **Create** a task (client→project→rate required; try submitting without a rate → blocked). → appears in "חדש".
2. **Drag into "בעבודה"** → a timer starts (appears in the active-timer bar; card shows "טיימר רץ"). Confirm a running `time_entries` row exists with the task's project + rate.
3. **Drag out of "בעבודה"** (to "הושלם") → the **existing stop modal opens**; confirm → entry saved with duration; card lands in "הושלם". Cancel path: card stays in "בעבודה".
4. **Empty/error/loading states** render (Hebrew, tokens). Overdue due date shows in `destructive`. A task whose rate was deleted shows "חסר תעריף" but still works.
5. **RTL**: columns read right-to-left; drag works with touch and keyboard.

- [ ] **Step 4: Code review + security review**

Run the `code-reviewer` and `security-reviewer` agents over the diff. Focus: every `/api/tasks*` query filtered by `user.id` (IDOR); the `move` transaction rolls back on a failed timer insert; no hardcoded colors; no `console.log` of sensitive data. Fix CRITICAL/HIGH before merge.

- [ ] **Step 5: Commit any review fixes**

```bash
git add -A
git commit -m "fix(tasks): address code/security review findings"
```

---

## Task 16: PROD migration (separate, gated)

**Files:** `drizzle/0015_tasks_kanban.sql`

- [ ] **Step 1: Confirm DEV is fully verified and the branch is ready to ship.**

- [ ] **Step 2: Snapshot PROD (Neon), then apply**

```bash
psql "$PROD_DATABASE_URL_ADMIN" -f drizzle/0015_tasks_kanban.sql
```
(Prod admin connection string is in `.env.local.bak.prod-shared` per memory `billing-rounding-and-resync`. Verify the rename step (`description`→`notes`) against the live `tasks` shape first with `\d tasks`.)
Expected: success; spot-check with `SELECT ... FROM tasks LIMIT 5;`.

- [ ] **Step 3: Update memory** noting migration 0015 applied to DEV and PROD.

---

## Self-Review (completed during authoring)

- **Spec coverage:** data model (Task 6), drag→timer transactional endpoint (Task 9) + decision logic (Task 4), stop-modal-on-exit (Task 12 Step 3), required client+project+rate (Task 5/7), priority 3-level + due date + tags (Tasks 5/6/12), single board + fixed columns (Task 12), nav (Task 11), backfill (Task 6), remove legacy (Task 14), 4 UX states + tokens + RTL (Task 12), tests (Tasks 3-5, 15). ✓
- **No Playwright in repo** → E2E replaced with a concrete manual checklist (Task 15 Step 3) + agent reviews; adding Playwright is out of scope.
- **Type consistency:** `TaskRecord`/`TaskStatus`/`TaskPriority` defined in Task 2 and used unchanged in Tasks 4, 7, 12; `moveEffect` signature matches its use in Task 12; `runningTimerForTask` defined in Task 10 and consumed in Task 12; `positionBetween` defined in Task 3 and used in Task 12. ✓
- **Migration risk:** snapshot-before-apply on DEV (Task 6) and PROD (Task 16); FK `rate_id` is SET NULL (no cascade delete of tasks); `time_entries.task_id` SET NULL preserved.
```