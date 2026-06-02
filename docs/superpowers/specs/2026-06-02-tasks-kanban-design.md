# Tasks Kanban (משימות) — Design

> 2026-06-02. Adds a standalone **"משימות"** section to the sidebar: a single per-user
> Kanban board (drag & drop) with three fixed columns — **חדש / בעבודה / הושלם**
> (`todo / in_progress / done`). Each task carries a **client, project, and rate** (an
> hourly `client_rate`), free notes, a due date, a priority, and tags. **Dragging a task
> into "בעבודה" starts a timer automatically** for that task's client+project+rate
> (integrating with the existing timer system); dragging it **out** of "בעבודה" opens the
> existing stop-timer modal.
>
> This **replaces** the existing per-project `tasks` feature entirely (the checklist
> section inside the project page and `/api/projects/[id]/tasks`). The current `tasks`
> table is migrated in place (ALTER + backfill), preserving `time_entries.task_id` links.

## Problem

Today `tasks` is a thin per-project checklist: `name`, `description`,
`status (todo/in_progress/done)`, scoped to one `project_id`, with no client, rate, due
date, or priority. It lives only as a section inside the project page, and the only path
to a timer is the manual start modal. There is no cross-project, prioritized "what should
I work on next" view, and no way to go from "I'm starting this task" to a running,
correctly-billed timer in one gesture.

## Goals

- One coherent, standalone Kanban board for all of the user's work, independent of any
  single project.
- A task answers, at a glance, **for whom / on what / at what rate** plus my private notes
  — so opening a task is unambiguous.
- The drag-to-"בעבודה" gesture **is** the "start working" action: it starts a timer for
  the task's client+project+rate with zero extra clicks.
- Replace, not duplicate: kill the per-project task checklist so there is a single source
  of truth for tasks.

## Non-Goals (YAGNI)

- No multiple boards, custom columns, or per-column WIP limits — **single board, fixed
  three columns**.
- No separate "flags" entity and no custom user-defined flags — **priority has 3 fixed
  levels**; everything else is expressed through the existing tag system.
- No assignees / collaborators — the app is single-user-per-tenant.
- No subtasks, checklists-within-a-task, comments, or attachments.

## Decisions (locked during brainstorming)

1. **Replace the existing `tasks` table entirely** — ALTER in place + backfill, keeping
   `time_entries.task_id` links intact.
2. **Single board + tags** — no `boards`/`columns` tables. Filtering/grouping by
   client/project/tag/priority on one board.
3. **Fixed columns**: חדש / בעבודה / הושלם → `todo / in_progress / done`.
4. **Drag out of "בעבודה"** (to done or back to todo) → **stop + open the existing stop
   modal**; status commit only after the stop is confirmed.
5. **Required on create**: client + project + rate (all three).
6. **Priority**: 3 fixed levels (`normal / high / urgent`); no separate flags — tags
   carry the rest. Plus a nullable **due date**.
7. **drag→timer integration**: a **dedicated transactional endpoint**
   `PATCH /api/tasks/[id]/move` (status + position + timer insert in one transaction).
8. **Existing data**: **backfill** old per-project todos into the new model.

## Data Model

**Migrate `tasks` in place** (drizzle migration; per the project's `drizzle-meta-drift`
note, apply to DEV via `psql` using `DATABASE_URL_ADMIN`, not `db:migrate`; PROD applied
separately). Only `src/db/schema.ts` is the source of truth for the Drizzle definition.

```
tasks (after migration)
──────────────────────────────────────────────────────────────────────
id            text PK
user_id       text NOT NULL                                   -- isolation + RLS
client_id     text NOT NULL  → clients(id)      ON DELETE CASCADE   -- NEW, required
project_id    text NOT NULL  → projects(id)     ON DELETE CASCADE   -- existing
rate_id       text           → client_rates(id) ON DELETE SET NULL  -- NEW, chosen hourly rate
rate          real                                            -- NEW, snapshot of value
rate_label    text                                            -- NEW, snapshot of name
title         text NOT NULL                                   -- was "name"
notes         text                                            -- was "description"
status        text NOT NULL DEFAULT 'todo'                    -- todo | in_progress | done
priority      text NOT NULL DEFAULT 'normal'                  -- NEW: normal | high | urgent
due_date      date                                            -- NEW, nullable
position      real NOT NULL                                   -- NEW, order within a column
tags          jsonb NOT NULL DEFAULT '[]'                     -- NEW, like time_entries.tags
created_at    timestamp DEFAULT now()
updated_at    timestamp DEFAULT now()
```

Key points:

- **`rate_id` is `ON DELETE SET NULL`** (not CASCADE) — deleting a `client_rate` must not
  delete tasks. The `rate` / `rate_label` snapshot keeps the card showing a rate even
  after the source rate is gone. (Mirrors the snapshot pattern already used on
  `time_entries.rate` / `rate_label`.)
- **`rate_id` is nullable in the DB** only to survive rate deletion; **app-level Zod
  validation requires client + project + rate on create/edit.**
- **`position`** is a `real` for fractional ordering: on drop, set it to the midpoint
  between the two neighbors, so a reorder touches one row, not the whole column. A periodic
  (or on-collision) renormalization is unnecessary at this scale; if two positions ever
  collide, the move endpoint re-spaces that column.
- **`check` constraints**: existing status check is kept; add
  `priority IN ('normal','high','urgent')`.
- **Indexes**: add `(user_id, status, position)` for the board query; keep the existing
  `idx_tasks_project_id` and `idx_tasks_user_id`.

### Backfill (migration step)

For every existing row:

- `client_id` ← the row's `projects.client_id`.
- `rate_id` / `rate` / `rate_label` ← the client's **default hourly** `client_rate`
  (`pickDefaultHourlyRate` semantics). If a client has no hourly rate, leave `rate_id`
  NULL and snapshots NULL — the task is still valid and the user can set a rate later
  (the board surfaces "missing rate" on such a card).
- `priority` ← `'normal'`.
- `position` ← row number ordered by `created_at` within each `(user_id, status)` group.
- `title` ← `name`; `notes` ← `description`.

`time_entries.task_id` links are untouched (same table, same ids).

### Tags

Reuse the existing tag conventions: a `tags jsonb DEFAULT '[]'` column on `tasks`
(consistent with `time_entries.tags`), with suggestions drawn from the existing
`custom_tags` table. No new tag table.

## drag → timer Flow (the core)

### Into "בעבודה" — `PATCH /api/tasks/[id]/move`

One DB transaction:

1. Verify ownership (`user_id`) and that the task is not already `in_progress`.
2. `UPDATE tasks SET status='in_progress', position=$pos, updated_at=now()`.
3. `INSERT INTO time_entries (... project_id, task_id=this, description, rate, rate_label,
   billing_kind='hourly', start_time=now, date=today, duration=0, is_billable=TRUE)` —
   the same shape `/api/timer/start` writes, but `project_id`/`rate`/`rate_label` are read
   from the task. (Multiple concurrent running timers per user are already allowed.)
4. COMMIT → return `{ success, entryId }`.
5. Client calls `refreshTimer()` from `timer-context` → the running timer appears in the
   active-timer bar and on the card.

Edge cases:
- If a running timer already exists **for this same task**, do not start a second one —
  the move just confirms `in_progress` (idempotent).
- If the task has no rate (`rate_id` NULL), the timer still starts with `rate=NULL`
  (matches today's "no rate" timer behavior); the card already flags the missing rate.

### Out of "בעבודה" (to done or back to todo)

The server does **not** stop the timer. The client:

1. Detects a running timer for the task: `runningTimers.find(t => t.taskId === task.id)`.
2. Calls the existing `handleStopTimer(entryId)` → **the existing stop modal opens**
   (duration / notes / description).
3. The status change is committed (via `move`) **only after** the stop is confirmed.
   Cancelling the stop modal rolls the card back to "בעבודה" (visual rollback; no `move`
   call was made).
4. If there is **no** running timer for the task (e.g. it was paused/stopped earlier),
   the move is a plain status+position update with no modal.

### Plain moves

Reordering within a column, or moving between חדש ↔ הושלם **without** a running timer,
is a `move` call that updates `status`/`position` only — no timer involvement.

## Routes & Components

```
app/tasks/page.tsx                  -- board page (auth-gated, follows existing page pattern)
components/tasks/
  kanban-board.tsx                  -- "use client": DnD context, three columns, filters
  kanban-column.tsx                 -- a droppable column (todo/in_progress/done)
  task-card.tsx                     -- client, project, rate, priority bar, due date, tags, timer indicator
  task-form-dialog.tsx              -- create/edit: client→project→rate dependent selects, due, priority, tags, notes
  task-detail-sheet.tsx             -- click a card: full detail + timer action

app/api/tasks/route.ts              -- GET (board + filters) · POST (create)
app/api/tasks/[id]/route.ts         -- PATCH (edit fields) · DELETE
app/api/tasks/[id]/move/route.ts    -- PATCH (status+position; + timer on entering in_progress)
lib/schemas/tasks.ts                -- Zod schema (client+project+rate required), shared client/server
```

- **DnD library**: `@dnd-kit/core` + `@dnd-kit/sortable` (accessible, keyboard + touch,
  React 19 compatible, RTL-aware). **Confirm via Context7 and check for an existing DnD
  dep before installing**; if the repo already has one, use it.
- Every query is filtered by `user_id` (defense-in-depth above RLS; matches the project's
  RLS setup on the `tasks` table).
- `lib/nav-items.ts`: add `{ name: "משימות", href: "/tasks", iconName: "FolderKanban" }`
  (the icon is already in the `iconName` union).
- **Removed**: the tasks section in the project page and `app/api/projects/[id]/tasks`.
  The "משימה" dropdown in the timer **start** modal stays (it now lists global tasks,
  filtered to the selected project).

## UX — Four States, RTL, Tokens

- **Four states** for the board: skeleton while loading · first-run empty state
  ("צור משימה ראשונה" with an inline CTA) · per-column empty ("אין משימות בעבודה") ·
  inline error with a "נסה שוב" button. All strings in Hebrew.
- **Card**: client + project name, rate label, due date (turns `destructive` red when
  past), a priority bar (`normal` = hairline `border`, `high` = `primary`, `urgent` =
  `destructive`), tags, and a "טיימר רץ" indicator when a timer for the task is running.
  A card missing a rate shows a clear "חסר תעריף" affordance.
- **Design tokens only** — `bg-card` / `border-border` / `text-foreground` /
  `bg-primary` + `text-primary-foreground` / `destructive`. Radius `--radius-card`. No
  hardcoded colors, no shadows. RTL via logical properties (`ps-*` / `me-*`); dnd-kit
  configured RTL-aware.
- **Optimistic UI** for drag (immediate move, rollback on failure) — **except** the move
  into "בעבודה", which waits for the timer-start confirmation, and the move out of
  "בעבודה", which waits for the stop-modal confirmation.
- **Mobile**: columns scroll horizontally, tap targets ≥44px, touch drag enabled.

## Implementation Phases (TDD)

1. **Migration + schema** — update `src/db/schema.ts`; write the `ALTER tasks` + backfill
   migration. Apply to DEV via `psql` (`DATABASE_URL_ADMIN`) per `drizzle-meta-drift`;
   PROD applied separately and tracked.
2. **Zod schema** — `lib/schemas/tasks.ts` (client + project + rate required) + unit tests.
3. **API routes** — `/api/tasks`, `/api/tasks/[id]`, `/api/tasks/[id]/move` + isolation
   tests (IDOR: another user cannot read/update/move/delete; verify `move` rejects a task
   the user doesn't own before inserting any time entry).
4. **timer-context wiring** — call `move` then `refreshTimer()` on enter; reuse
   `handleStopTimer` on exit; map a running timer to its task via `taskId`.
5. **Board components** — DnD, three columns, filters, the four UX states.
6. **Nav + removal** — add the nav item; remove the project-page task section and
   `/api/projects/[id]/tasks`.
7. **Tests** — unit (position/reorder math, priority mapping, validation); E2E
   (Playwright: create → drag to "בעבודה" → timer starts → drag to "הושלם" → stop modal →
   entry saved); then code-review + security-review.

## Risks & Notes

- **Migration is destructive-adjacent** (ALTER + backfill on a referenced table). Take a
  Neon snapshot before DEV apply; PROD apply is a separate, reviewed step (consistent with
  prior migrations 0013/0014 in this repo).
- **Transactional move** must use `withTransaction()` from `lib/db.ts` so a failed timer
  insert rolls back the status change.
- **`time_entries.task_id` is `ON DELETE SET NULL`** — deleting a task keeps its logged
  time (unlinked), which is the correct billing behavior.
- Removing `/api/projects/[id]/tasks` and the project-page section must not break the
  timer start modal's task dropdown (repoint it to `/api/tasks?projectId=`).
```