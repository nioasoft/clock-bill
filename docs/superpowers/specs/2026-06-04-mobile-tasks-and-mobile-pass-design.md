# Mobile Tasks Redesign + General Mobile Pass — Design

**Date:** 2026-06-04
**Status:** Approved, pending implementation plan
**Scope:** Deep redesign of the Tasks experience on mobile, plus a focused mobile pass on the rest of the app (clients/projects list tables and the timer-start flow).

---

## 1. Problem

The mobile experience for tasks is broken at a structural level, not cosmetic:

1. **Horizontal Kanban on a phone.** `KanbanBoard` renders 3 columns in `flex gap-4 overflow-x-auto`, each `min-w-72` (288px). On a phone you see ~1 column at a time. Moving a card from "חדש" to "בעבודה" means dragging to an off-screen column — which touch drag cannot do.
2. **Drag fights scroll.** `PointerSensor` uses `activationConstraint: { distance: 5 }`. On touch, any 5px finger movement starts a drag, so vertical scroll inside a column and horizontal scroll across the board both accidentally grab cards. There is no `TouchSensor` with a press-delay.
3. **Mis-drags trigger real timer actions.** A board move runs `moveEffect`: entering "בעבודה" starts a timer; leaving it (with a running timer) opens the stop modal. An accidental touch-drag can therefore start or stop a real timer.
4. **Dialogs are desktop-centered.** `TaskFormDialog` and `TaskDetailSheet` are centered modals — usable but not mobile-native, and the create form is long.
5. **Redundant "what are you working on" prompt.** The generic `TimerStartModal` still shows the "תיאור" field (`"מה אתה עובד עליו?"`) even after a task is selected. Selecting a task already answers that question.

Beyond tasks, two list screens are not mobile-adapted:

- **`clients` and `projects`** render a raw `<table overflow-x-auto>` with **no mobile variant** → horizontal scroll on phones.
- `entries` already does it right (desktop `<table>` + a separate `md:hidden` card list) — **this is the pattern to copy**, not invent.

Reports/admin tables are inherently desktop-oriented and out of scope here (admin is admin-only; reports are wide by nature).

---

## 2. Chosen direction

**Tasks on mobile become a status-tabbed single-column list** (the proven pattern in Linear / Todoist / Height). The desktop Kanban board stays exactly as-is. Status changes on mobile happen via **explicit buttons in a bottom-sheet**, never drag — eliminating both the scroll/drag conflict and accidental timer triggers.

Guiding principle: **extract one shared core, vary only the presentation.** The timer side-effect logic must live in exactly one place so desktop drag and mobile tap behave identically.

---

## 3. Components & responsibilities

### 3.1 `useTasksBoard()` — shared hook
**New file:** `components/tasks/use-tasks-board.ts`

Extracts all data + mutation logic currently inlined in `KanbanBoard`:

- `state: { loading, error, tasks }`, `load()`
- `byStatus(status)` — filtered + position-sorted
- `moveTask(taskId, toStatus)` — the **single source of truth** for a status move. Internally:
  - computes target `position` (end of target column via `positionBetween`),
  - runs `moveEffect({ from, to, hasRunningTimer })`,
  - `"start_timer"` → `persistMove` then `refreshTimer()`,
  - `"open_stop_modal"` → subscribe to `onTimerStopped` (with the existing guard that ignores other timers), call `handleStopTimer(entryId)`, and only `persistMove` + `load()` after our entry actually stops,
  - `"plain"` → optimistic local update, `persistMove`, `load()` (rollback + toast on failure).

Both desktop drag-end and mobile buttons call `moveTask`. No behavior change for the desktop path — it is the same logic, relocated.

**What it depends on:** `useTimer()` (for `runningTimerForTask`, `handleStopTimer`, `onTimerStopped`, `refreshTimer`), `/api/tasks`, `/api/tasks/[id]/move`.

### 3.2 `app/tasks/page.tsx` — responsive split
- `lg+`: `<div className="hidden lg:block">` → `KanbanBoard`.
- `<lg`: `<div className="lg:hidden">` → `MobileTaskList`.

Each fetches via its own `useTasksBoard()` instance (only one is mounted per viewport because of the `hidden`/`lg:hidden` wrappers, so no double fetch). The existing `reloadKey` + create-dialog deep-link behavior is preserved and shared by both.

### 3.3 `KanbanBoard` (desktop) — refactor, not rewrite
Replace its inline `useState`/`load`/`handleDragEnd` data logic with `useTasksBoard()`. `handleDragEnd` resolves the target status/position and calls `moveTask(task.id, targetStatus)`. dnd-kit, columns, and the visual board are untouched.

### 3.4 `MobileTaskList` — new
**New file:** `components/tasks/mobile-task-list.tsx`

- **Segmented control** at top: `[חדש n] [בעבודה n] [הושלם n]`, counts from `byStatus`. Selected tab in local state. Default tab: `in_progress` if it has any tasks, else `todo`.
- **Vertical list** of the existing `TaskCard` for the selected status, full-width, vertical scroll only.
- **Four states:** loading skeleton (vertical bars), populated list, error + retry, and per-tab empty (`EMPTY_LABEL`).
- Tap a card → opens `TaskDetailSheet`.

Uses design tokens only (no raw colors), RTL logical properties, tap targets ≥44px, segmented control labels in Hebrew.

### 3.5 `TaskDetailSheet` — add status actions + sheet on mobile
- Rendered as `variant="sheet"` (bottom-sheet on mobile, centered on desktop).
- Add a **status-action row** that calls `moveTask(task.id, target)` then `onChanged()`:
  - `todo`: primary `[התחל ▶]` (→ in_progress, starts timer) · `[סמן כהושלם ✓]` (→ done)
  - `in_progress`: primary `[סיים ✓]` (→ done) · `[החזר לחדש]` (→ todo). If a timer runs, `moveTask` opens the stop modal first (existing behavior).
  - `done`: `[החזר לעבודה ▶]` (→ in_progress, starts timer) · `[החזר לחדש]` (→ todo)
- Existing edit / delete actions stay. Allowed transitions are derived from a small pure helper (see §3.8) so they are testable and consistent with the board.

### 3.6 `DialogContent` — `variant="sheet"` (CSS only)
**Edit:** `components/ui/dialog.tsx`

Add `variant?: "center" | "sheet"` (default `"center"`). `"center"` keeps current behavior exactly. `"sheet"`:
- mobile (`<sm`): pinned to bottom, full width (`max-w-full`), `rounded-t-[var(--radius-card)]` with square bottom, slide-in from bottom, `max-h-[85dvh]` with internal scroll, a centered grabber bar at top, `pb-[env(safe-area-inset-bottom)]`.
- `sm+`: reverts to the existing centered dialog classes.

No new dependency — Radix Dialog is already in use. Sheet positioning is achieved with responsive Tailwind classes and the existing Radix animation data-attributes.

### 3.7 `TaskFormDialog` — sheet + progressive disclosure
- Rendered as `variant="sheet"`.
- **Essentials always visible:** לקוח, פרויקט, תעריף, שם המשימה.
- **Collapsible "פרטים נוספים":** דחיפות, תאריך יעד, תגיות, הערות. Default open on `sm+` and when editing a task that already has any advanced value; default closed on mobile create. One code path with a responsive/conditional default-open.
- **Sticky footer** save bar inside the sheet so "שמור" is always reachable without scrolling.
- Validation, API calls, and submit logic unchanged.

### 3.8 Allowed-transitions helper (new pure module)
**New file:** `lib/tasks-transitions.ts`

A pure function returning the action buttons available from a given status (label, target status, whether it is the primary action). Consumed by `TaskDetailSheet`. Pure and unit-tested. Keeps mobile actions and board semantics in lockstep.

### 3.9 `TimerStartModal` — task implies description
**Edit:** `components/timer-start-modal.tsx` and `contexts/timer-context.tsx`

- When `selectedTask` is set, **hide the "תיאור" field entirely** — the task is the "what".
- In `handleStartTimer`, when a task is selected and `timerDescription` is empty, default `description` to the selected task's title (looked up from `timerTasks`) before POSTing to `/api/timer/start`. This matches what the `move` endpoint already does (it stores `task.title` as the entry description), so both start paths are consistent.
- No task selected → field shows as today.
- Client-side only; no API or schema change.

### 3.10 `clients` & `projects` lists — port the entries pattern
**Edit:** `app/clients/page.tsx`, `app/projects/page.tsx`

- Wrap the existing `<table>` in `hidden md:block`.
- Add a `md:hidden` card list rendering each row as a card with the key fields and the same action handlers (edit / delete / navigate) already wired for the table rows. No data, API, or behavior change — presentation only. Mirror the structure already proven in `app/entries/page.tsx` (lines ~1211 table / ~1314 mobile cards).

---

## 4. Data flow & invariants (unchanged)

- API surface unchanged: `GET /api/tasks`, `PATCH /api/tasks/[id]/move`, `POST/PATCH/DELETE /api/tasks[/id]`, `POST /api/timer/start`.
- No schema migration. No new npm dependency.
- All queries remain `user_id`-scoped; RLS untouched.
- Timer side-effects on a status change are identical whether triggered by desktop drag or mobile button (both go through `moveTask` → the `move` endpoint, which atomically updates status and starts the timer in one transaction).

---

## 5. UX states checklist

| Screen | loading | success | error | empty |
|---|---|---|---|---|
| MobileTaskList | skeleton bars | tabbed list | error + retry | per-tab empty copy |
| TaskDetailSheet | n/a (data in hand) | detail + actions | toast on action failure | n/a |
| TaskFormDialog | submit spinner on button | toast on save | toast + inline disabled submit | n/a |
| clients/projects mobile cards | existing | card list | existing | existing empty state |

Errors are user-readable Hebrew + `console.error` in English. No silent failures. Tap targets ≥44px. Inputs already forced to 16px under 640px (keep).

---

## 6. Testing

Custom tsx runner (`tests/unit/*.test.ts`), pure functions only:

- `tests/unit/tasks-transitions.test.ts` — allowed transitions per status, primary-action flagging.
- `tasks-move.test.ts` (existing) already covers `moveEffect`; no change.
- Default-tab selection in `MobileTaskList` — if extracted to a pure helper, unit-test it; otherwise verify manually (component tests are out of scope for this runner).

Manual verification: mobile viewport — tab switching, start/finish/return transitions (incl. running-timer → stop-modal path), bottom-sheet scroll + sticky footer, create with collapsed "פרטים נוספים", start-modal with a task selected (no description field, entry shows task title), clients/projects cards on phone, desktop Kanban unchanged.

---

## 7. Out of scope

- Desktop Kanban visual/interaction changes.
- Reports and admin tables.
- Any schema/API change, new dependency, or new timer endpoint.
- A separate mobile "+" FAB for new tasks (the header button is kept).

---

## 8. File touch list

**New:** `components/tasks/use-tasks-board.ts`, `components/tasks/mobile-task-list.tsx`, `lib/tasks-transitions.ts`, `tests/unit/tasks-transitions.test.ts`

**Edit:** `app/tasks/page.tsx`, `components/tasks/kanban-board.tsx`, `components/tasks/task-detail-sheet.tsx`, `components/tasks/task-form-dialog.tsx`, `components/ui/dialog.tsx`, `components/timer-start-modal.tsx`, `contexts/timer-context.tsx`, `app/clients/page.tsx`, `app/projects/page.tsx`
