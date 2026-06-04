# Mobile Tasks Redesign + General Mobile Pass — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the touch-hostile horizontal Kanban with a status-tabbed mobile list, turn task dialogs into mobile bottom-sheets, stop the timer-start modal from re-asking "what are you working on" when a task is chosen, and give the clients/projects tables a mobile card view.

**Architecture:** Extract all task data + the timer-aware status-move logic into one shared hook (`useTasksBoard`) owned by the tasks page. Desktop renders the existing Kanban; mobile renders a new tabbed list. Both call the hook's `moveTask` so timer side-effects are identical. Status changes on mobile happen via buttons in a bottom-sheet, never drag. Dialog bottom-sheet behavior is a CSS-only variant on the existing Radix `DialogContent` — no new dependency.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4 (`@theme inline` tokens), Radix Dialog, dnd-kit (desktop only), custom tsx unit-test runner.

---

## Reference design

Spec: `docs/superpowers/specs/2026-06-04-mobile-tasks-and-mobile-pass-design.md`

**Refinement over spec §3.2:** the spec said each view owns its own `useTasksBoard()`. This plan instead calls `useTasksBoard()` once in `app/tasks/page.tsx` and passes the result to both views as a `board` prop. Reason: `app-layout.tsx` renders `{children}` twice (a `hidden lg:flex` desktop branch and a `lg:hidden` mobile branch), so a single shared hook keeps fetches at one per page-mount instead of multiplying them. Behavior is otherwise exactly as specced.

## File structure

**New files**
- `lib/tasks-transitions.ts` — pure: allowed status-change buttons per status.
- `tests/unit/tasks-transitions.test.ts` — unit tests for the above.
- `components/tasks/use-tasks-board.ts` — shared data + `moveTask` hook.
- `components/tasks/mobile-task-list.tsx` — mobile tabbed list view.

**Modified files**
- `components/ui/dialog.tsx` — add `variant="sheet"`.
- `components/tasks/kanban-board.tsx` — consume `board` prop instead of internal state.
- `components/tasks/task-detail-sheet.tsx` — sheet variant + status-action buttons.
- `components/tasks/task-form-dialog.tsx` — sheet variant + "פרטים נוספים" collapsible.
- `app/tasks/page.tsx` — own the shared hook, render both views responsively.
- `components/timer-start-modal.tsx` — hide "תיאור" when a task is selected.
- `contexts/timer-context.tsx` — default description to task title when a task is selected.
- `app/clients/page.tsx` — desktop table wrapped `hidden md:block` + mobile card list.
- `app/projects/page.tsx` — same.

---

## Task 1: Pure status-transition helper

**Files:**
- Create: `lib/tasks-transitions.ts`
- Test: `tests/unit/tasks-transitions.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/tasks-transitions.test.ts`:

```typescript
/** Unit tests for lib/tasks-transitions.ts — the per-status action buttons. */
import { allowedTransitions } from "../../lib/tasks-transitions";
import { TASK_STATUSES } from "../../lib/tasks-types";

class TestRunner {
  private tests: Array<{ name: string; fn: () => void }> = [];
  private passed = 0; private failed = 0;
  test(name: string, fn: () => void) { this.tests.push({ name, fn }); }
  async run() {
    console.log("🧪 Running tasks-transitions.ts tests...\n");
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

runner.test("todo offers exactly 2 transitions, primary is in_progress", () => {
  const t = allowedTransitions("todo");
  assertEqual(t.length, 2);
  assertEqual(t[0].to, "in_progress");
  assertEqual(t[0].primary, true);
  assertEqual(t[0].label, "התחל");
  assertEqual(t[1].to, "done");
});
runner.test("in_progress offers done (primary) + todo", () => {
  const t = allowedTransitions("in_progress");
  assertEqual(t.length, 2);
  assertEqual(t[0].to, "done");
  assertEqual(t[0].primary, true);
  assertEqual(t[0].label, "סיים");
  assertEqual(t[1].to, "todo");
});
runner.test("done offers in_progress (primary) + todo", () => {
  const t = allowedTransitions("done");
  assertEqual(t.length, 2);
  assertEqual(t[0].to, "in_progress");
  assertEqual(t[0].primary, true);
  assertEqual(t[1].to, "todo");
});
runner.test("no transition targets its own status", () => {
  for (const s of TASK_STATUSES) {
    for (const tr of allowedTransitions(s)) {
      if (tr.to === s) throw new Error(`status ${s} has a self-transition`);
    }
  }
});

runner.run().then((ok) => process.exit(ok ? 0 : 1));
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `npx tsx tests/unit/tasks-transitions.test.ts`
Expected: FAIL — module `lib/tasks-transitions` not found (cannot resolve import).

- [ ] **Step 3: Write the implementation**

Create `lib/tasks-transitions.ts`:

```typescript
/** Pure helper: which status-change buttons a task offers from its current status. */
import type { TaskStatus } from "./tasks-types";

export interface TaskTransition {
  /** Target status this button moves the task to. */
  to: TaskStatus;
  /** Hebrew button label. */
  label: string;
  /** Whether this is the primary (accent) action. */
  primary: boolean;
}

const TRANSITIONS: Record<TaskStatus, TaskTransition[]> = {
  todo: [
    { to: "in_progress", label: "התחל", primary: true },
    { to: "done", label: "סמן כהושלם", primary: false },
  ],
  in_progress: [
    { to: "done", label: "סיים", primary: true },
    { to: "todo", label: "החזר לחדש", primary: false },
  ],
  done: [
    { to: "in_progress", label: "החזר לעבודה", primary: true },
    { to: "todo", label: "החזר לחדש", primary: false },
  ],
};

/** The ordered list of status-change actions available from `status`. */
export function allowedTransitions(status: TaskStatus): TaskTransition[] {
  return TRANSITIONS[status];
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `npx tsx tests/unit/tasks-transitions.test.ts`
Expected: PASS — `4 passed, 0 failed`.

- [ ] **Step 5: Run the full suite + lint**

Run: `npm test && npm run lint`
Expected: all test files pass; lint clean (zero warnings — the repo enforces a zero-warning gate).

- [ ] **Step 6: Commit**

```bash
git add lib/tasks-transitions.ts tests/unit/tasks-transitions.test.ts
git commit -m "feat(tasks): add pure status-transition helper + tests"
```

---

## Task 2: Bottom-sheet variant on DialogContent

**Files:**
- Modify: `components/ui/dialog.tsx`

- [ ] **Step 1: Replace the `DialogContent` definition**

In `components/ui/dialog.tsx`, replace the whole `DialogContent` forwardRef block (currently lines ~32–60) with this version. It adds a `variant` prop; `"center"` keeps the exact current classes, `"sheet"` is a bottom-sheet on mobile that reverts to centered at `sm+`, and renders a grabber bar on mobile.

```tsx
const CENTER_CLASSES =
  "fixed left-[50%] top-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] sm:max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto translate-x-[-50%] translate-y-[-50%] gap-4 border border-border bg-card p-5 sm:p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] rounded-[var(--radius-card)]"

const SHEET_CLASSES =
  // Mobile: bottom sheet. sm+: identical to centered dialog.
  "fixed inset-x-0 bottom-0 z-50 grid w-full max-h-[85dvh] overflow-y-auto gap-4 border-t border-border bg-card p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] shadow-lg duration-200 rounded-t-[var(--radius-card)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom " +
  "sm:inset-x-auto sm:bottom-auto sm:left-[50%] sm:top-[50%] sm:max-w-lg sm:max-h-[calc(100dvh-2rem)] sm:w-full sm:max-w-[calc(100%-2rem)] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-[var(--radius-card)] sm:border sm:p-6 sm:pb-6 sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95 sm:data-[state=closed]:slide-out-to-left-1/2 sm:data-[state=open]:slide-in-from-left-1/2"

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    showCloseButton?: boolean
    variant?: "center" | "sheet"
  }
>(({ className, children, showCloseButton = true, variant = "center", ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(variant === "sheet" ? SHEET_CLASSES : CENTER_CLASSES, className)}
      {...props}
    >
      {variant === "sheet" && (
        <div className="mx-auto h-1 w-10 shrink-0 rounded-full bg-border sm:hidden" aria-hidden />
      )}
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close className="absolute end-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-muted data-[state=open]:text-muted-foreground">
          <X className="h-4 w-4" />
          <span className="sr-only">סגור</span>
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName
```

- [ ] **Step 2: Verify nothing else changed**

The `sm:max-w-lg` then `sm:max-w-[calc(100%-2rem)]` ordering in `SHEET_CLASSES` is intentional: the later utility wins, matching the centered dialog's mobile-gutter behavior at `sm`. Leave as written.

- [ ] **Step 3: Build + lint**

Run: `npm run lint && npm run build`
Expected: clean. All existing `DialogContent` usages still compile (the new prop is optional, default `"center"` = current behavior).

- [ ] **Step 4: Commit**

```bash
git add components/ui/dialog.tsx
git commit -m "feat(ui): add bottom-sheet variant to DialogContent (mobile)"
```

---

## Task 3: Shared `useTasksBoard` hook

**Files:**
- Create: `components/tasks/use-tasks-board.ts`

This relocates the data + move logic currently inline in `kanban-board.tsx`, unchanged in behavior, and exposes a single `moveTask(taskId, toStatus)` entry point.

- [ ] **Step 1: Create the hook**

Create `components/tasks/use-tasks-board.ts`:

```typescript
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTimer } from "@/contexts/timer-context";
import { showErrorToast } from "@/lib/toast";
import { positionBetween } from "@/lib/tasks-order";
import { moveEffect } from "@/lib/tasks-move";
import type { TaskRecord, TaskStatus } from "@/lib/tasks-types";

export interface BoardState {
  loading: boolean;
  error: boolean;
  tasks: TaskRecord[];
}

export interface UseTasksBoardReturn {
  state: BoardState;
  load: () => Promise<void>;
  byStatus: (status: TaskStatus) => TaskRecord[];
  /** Move a task to a new status (append to end of target column), applying the
   *  same timer side-effects as a desktop drag. */
  moveTask: (taskId: string, toStatus: TaskStatus) => Promise<void>;
}

/** Shared task board data + timer-aware status moves. Consumed by both the
 *  desktop Kanban and the mobile list so side-effects stay identical. */
export function useTasksBoard(): UseTasksBoardReturn {
  const { refreshTimer, runningTimerForTask, handleStopTimer, onTimerStopped } = useTimer();
  const [state, setState] = useState<BoardState>({ loading: true, error: false, tasks: [] });
  // Pending unsubscribe for an in-flight "drag/move out of in_progress → stop
  // timer" subscription, so a new move can replace a lingering (cancelled) one.
  const pendingStopUnsubRef = useRef<(() => void) | null>(null);

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

  // Initial board fetch. `load` sets state synchronously on resolve; that's the
  // intended one-time data load, not a render-driven cascade.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);
  useEffect(() => onTimerStopped(() => load()), [onTimerStopped, load]);

  const byStatus = useCallback(
    (status: TaskStatus) =>
      state.tasks.filter((t) => t.status === status).sort((a, b) => a.position - b.position),
    [state.tasks]
  );

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

  const moveTask = useCallback(async (taskId: string, targetStatus: TaskStatus) => {
    const task = state.tasks.find((t) => t.id === taskId);
    if (!task) return;
    if (task.status === targetStatus) return;

    const column = byStatus(targetStatus).filter((t) => t.id !== task.id);
    const last = column[column.length - 1]?.position ?? null;
    const position = positionBetween(last, null);

    const effect = moveEffect({
      from: task.status,
      to: targetStatus,
      hasRunningTimer: Boolean(runningTimerForTask(task.id)),
    });

    if (effect === "open_stop_modal") {
      const entryId = runningTimerForTask(task.id);
      if (entryId) {
        if (pendingStopUnsubRef.current) {
          pendingStopUnsubRef.current();
          pendingStopUnsubRef.current = null;
        }
        const unsub = onTimerStopped(async () => {
          // onTimerStopped fires for ANY stopped timer. If OUR entry is still
          // running, some other timer stopped — keep waiting (don't unsub).
          if (runningTimerForTask(task.id) === entryId) return;
          unsub();
          pendingStopUnsubRef.current = null;
          try { await persistMove(task.id, targetStatus, position); await load(); }
          catch { showErrorToast("שגיאה בעדכון המשימה"); }
        });
        pendingStopUnsubRef.current = unsub;
        handleStopTimer(entryId);
      }
      return;
    }

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
      await load();
    }
  }, [state.tasks, byStatus, runningTimerForTask, persistMove, load, refreshTimer, handleStopTimer, onTimerStopped]);

  return { state, load, byStatus, moveTask };
}
```

- [ ] **Step 2: Build + lint**

Run: `npm run lint && npm run build`
Expected: clean (the hook is not yet consumed; this just confirms it compiles).

- [ ] **Step 3: Commit**

```bash
git add components/tasks/use-tasks-board.ts
git commit -m "feat(tasks): extract shared useTasksBoard hook (data + moveTask)"
```

---

## Task 4: Refactor KanbanBoard to consume the hook

**Files:**
- Modify: `components/tasks/kanban-board.tsx`

Make the board a presentation component that receives the `board` object and a `moveTask`-aware detail sheet. No behavior change for desktop.

- [ ] **Step 1: Replace the file contents**

Replace `components/tasks/kanban-board.tsx` with:

```tsx
"use client";

import { useCallback, useState } from "react";
import { DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, closestCorners, type DragEndEvent } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTimer } from "@/contexts/timer-context";
import { TASK_STATUSES, type TaskRecord, type TaskStatus } from "@/lib/tasks-types";
import { TaskCard } from "./task-card";
import { KanbanColumn } from "./kanban-column";
import { TaskDetailSheet } from "./task-detail-sheet";
import type { UseTasksBoardReturn } from "./use-tasks-board";

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

export function KanbanBoard({ board }: { board: UseTasksBoardReturn }) {
  const { runningTimerForTask } = useTimer();
  const { state, load, byStatus, moveTask } = board;
  const [selected, setSelected] = useState<TaskRecord | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const task = state.tasks.find((t) => t.id === active.id);
    if (!task) return;

    const overId = String(over.id);
    const targetStatus: TaskStatus = (TASK_STATUSES as readonly string[]).includes(overId)
      ? (overId as TaskStatus)
      : state.tasks.find((t) => t.id === overId)?.status ?? task.status;

    void moveTask(task.id, targetStatus);
  }, [state.tasks, moveTask]);

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
          moveTask={moveTask}
          onClose={() => setSelected(null)}
          onChanged={() => { setSelected(null); load(); }}
        />
      )}
    </>
  );
}
```

Note: `KanbanColumn` imports `SortableTaskCard` from this file — that export is preserved, so no change there.

- [ ] **Step 2: Build (expected to fail on TaskDetailSheet prop, and on page.tsx)**

Run: `npm run build`
Expected: TS errors — `TaskDetailSheet` does not yet accept `moveTask`, and `app/tasks/page.tsx` still renders `<KanbanBoard />` without the `board` prop. These are fixed in Tasks 6 and 8. Do **not** commit yet; continue.

---

## Task 5: MobileTaskList component

**Files:**
- Create: `components/tasks/mobile-task-list.tsx`

- [ ] **Step 1: Create the component**

Create `components/tasks/mobile-task-list.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import { useTimer } from "@/contexts/timer-context";
import { TASK_STATUSES, TASK_STATUS_LABEL, type TaskRecord, type TaskStatus } from "@/lib/tasks-types";
import { TaskCard } from "./task-card";
import { TaskDetailSheet } from "./task-detail-sheet";
import type { UseTasksBoardReturn } from "./use-tasks-board";

const EMPTY_LABEL: Record<TaskStatus, string> = {
  todo: "אין משימות חדשות",
  in_progress: "אין משימות בעבודה",
  done: "אין משימות שהושלמו",
};

export function MobileTaskList({ board }: { board: UseTasksBoardReturn }) {
  const { runningTimerForTask } = useTimer();
  const { state, load, byStatus, moveTask } = board;
  // null = "follow the default tab"; a value = user's explicit choice.
  const [active, setActive] = useState<TaskStatus | null>(null);
  const [selected, setSelected] = useState<TaskRecord | null>(null);

  // Default tab: in_progress if anything is in progress, else todo.
  const defaultTab: TaskStatus = useMemo(
    () => (state.tasks.some((t) => t.status === "in_progress") ? "in_progress" : "todo"),
    [state.tasks]
  );
  const tab = active ?? defaultTab;

  if (state.loading) {
    return (
      <div className="space-y-3">
        <div className="h-12 animate-pulse rounded-[var(--radius)] bg-surface" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-[var(--radius-card)] border border-border bg-surface" />
        ))}
      </div>
    );
  }
  if (state.error) {
    return (
      <div className="rounded-[var(--radius-card)] border border-border bg-card p-8 text-center">
        <p className="text-foreground">שגיאה בטעינת המשימות</p>
        <button onClick={load} className="mt-3 min-h-[44px] rounded-[var(--radius)] bg-primary px-4 py-2 text-primary-foreground">נסה שוב</button>
      </div>
    );
  }
  if (state.tasks.length === 0) {
    return (
      <div className="rounded-[var(--radius-card)] border border-border bg-card p-10 text-center">
        <p className="text-foreground">אין עדיין משימות</p>
        <p className="mt-1 text-sm text-muted-foreground">צור את המשימה הראשונה כדי להתחיל</p>
      </div>
    );
  }

  const tasks = byStatus(tab);

  return (
    <>
      <div role="tablist" aria-label="סינון משימות לפי סטטוס" className="mb-4 grid grid-cols-3 gap-1 rounded-[var(--radius)] border border-border bg-surface p-1">
        {TASK_STATUSES.map((s) => {
          const isActive = s === tab;
          return (
            <button
              key={s}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(s)}
              className={`min-h-[44px] rounded-[var(--radius)] px-2 py-2 text-sm font-medium transition-colors ${
                isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {TASK_STATUS_LABEL[s]}{" "}
              <span className="tabular-nums">{byStatus(s).length}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-2">
        {tasks.length === 0 ? (
          <p className="px-2 py-10 text-center text-sm text-muted-foreground">{EMPTY_LABEL[tab]}</p>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              isTimerRunning={Boolean(runningTimerForTask(task.id))}
              onClick={() => setSelected(task)}
            />
          ))
        )}
      </div>

      {selected && (
        <TaskDetailSheet
          task={selected}
          moveTask={moveTask}
          onClose={() => setSelected(null)}
          onChanged={() => { setSelected(null); load(); }}
        />
      )}
    </>
  );
}
```

- [ ] **Step 2: Build (still expected to fail until Task 6)**

Run: `npm run build`
Expected: same `TaskDetailSheet` prop error as Task 4 — fixed next. Continue without committing.

---

## Task 6: TaskDetailSheet — sheet variant + status actions

**Files:**
- Modify: `components/tasks/task-detail-sheet.tsx`

- [ ] **Step 1: Update the props type and imports**

In `components/tasks/task-detail-sheet.tsx`, add the import and extend the props:

Add to the imports near the top (after the existing `TASK_PRIORITY_LABEL` import line):

```tsx
import { allowedTransitions } from "@/lib/tasks-transitions";
import type { TaskStatus } from "@/lib/tasks-types";
```

Replace the `TaskDetailSheetProps` interface with:

```tsx
interface TaskDetailSheetProps {
  task: TaskRecord;
  moveTask: (taskId: string, toStatus: TaskStatus) => Promise<void>;
  onClose: () => void;
  onChanged: () => void;
}
```

Update the component signature line:

```tsx
export function TaskDetailSheet({ task, moveTask, onClose, onChanged }: TaskDetailSheetProps) {
```

- [ ] **Step 2: Add a moving state + handler**

Inside the component, after the existing `const [deleting, setDeleting] = useState(false);` line, add:

```tsx
  const [moving, setMoving] = useState(false);

  const handleMove = async (toStatus: TaskStatus) => {
    setMoving(true);
    try {
      await moveTask(task.id, toStatus);
      // moveTask updates the board itself; just close the sheet. (For the
      // running-timer case it opens the stop modal and commits after stop.)
      onClose();
    } finally {
      setMoving(false);
    }
  };
```

- [ ] **Step 3: Switch to the sheet variant + add the status-action row**

Change the `<DialogContent>` opening tag to:

```tsx
      <DialogContent variant="sheet">
```

Then, inside the `<div className="space-y-4">`, immediately after the `isTimerRunning` banner block (the `{isTimerRunning && (...)}` expression) and before the `<div className="grid grid-cols-2 gap-4">`, insert the status actions:

```tsx
          <div className="flex flex-wrap gap-2">
            {allowedTransitions(task.status).map((tr) => (
              <button
                key={tr.to}
                type="button"
                onClick={() => handleMove(tr.to)}
                disabled={moving}
                className={`min-h-[44px] flex-1 rounded-[var(--radius)] px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${
                  tr.primary
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "border border-border text-foreground hover:bg-muted"
                }`}
              >
                {tr.label}
              </button>
            ))}
          </div>
```

- [ ] **Step 4: Pass the sheet variant through edit mode**

The edit branch returns a `TaskFormDialog`. No change needed here — Task 7 sets that dialog to the sheet variant itself.

- [ ] **Step 5: Build + lint**

Run: `npm run lint && npm run build`
Expected: still ONE remaining error — `app/tasks/page.tsx` renders `<KanbanBoard />` with no `board` prop. Fixed in Task 8. Continue.

---

## Task 7: TaskFormDialog — sheet + "פרטים נוספים" collapsible

**Files:**
- Modify: `components/tasks/task-form-dialog.tsx`

- [ ] **Step 1: Add the advanced-disclosure state**

In `components/tasks/task-form-dialog.tsx`, after the existing `const [submitting, setSubmitting] = useState(false);` line, add:

```tsx
  // Mobile progressive disclosure: advanced fields collapse on mobile create.
  // On sm+ they're always shown via CSS; this state only gates the mobile view.
  const hasAdvancedValues = Boolean(
    task?.dueDate || (task?.tags && task.tags.length > 0) || task?.notes || (task?.priority && task.priority !== "normal")
  );
  const [showAdvanced, setShowAdvanced] = useState<boolean>(isEdit && hasAdvancedValues);
```

- [ ] **Step 2: Switch the dialog to the sheet variant**

Change the `<DialogContent>` opening tag to:

```tsx
      <DialogContent variant="sheet">
```

- [ ] **Step 3: Remove דחיפות from the top grid (it becomes an advanced field)**

In the top `<div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">`, delete the entire דחיפות `<div>` block (the one containing `<label htmlFor="task-priority" ...>` and its `<select id="task-priority" ...>`). The grid now holds client, project, rate (3 items). Leave the שם המשימה (`task-title`) block where it is, directly after the grid.

- [ ] **Step 4: Wrap advanced fields in the collapsible section**

The fields currently rendered after שם המשימה are: תאריך יעד (`task-due`), תגיות (`task-tags`), הערות (`task-notes`). Wrap those three blocks — plus the דחיפות block you removed in Step 3 (re-add it here as the first advanced field) — inside a single disclosure section.

Replace the sequence from just after the title `<div>` up to (but not including) the footer `<div className="flex justify-end gap-3 border-t border-border pt-4">` with:

```tsx
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="sm:hidden text-sm font-medium text-primary"
            aria-expanded={showAdvanced}
          >
            {showAdvanced ? "הסתר פרטים נוספים" : "+ פרטים נוספים"}
          </button>

          <div className={`${showAdvanced ? "" : "hidden"} sm:block space-y-4`}>
            <div>
              <label htmlFor="task-priority" className={labelClass}>דחיפות</label>
              <select
                id="task-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className={fieldClass(false)}
                disabled={submitting}
              >
                {TASK_PRIORITIES.map((p) => (
                  <option key={p} value={p}>{TASK_PRIORITY_LABEL[p]}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="task-due" className={labelClass}>תאריך יעד</label>
              <input
                id="task-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={`${fieldClass(false)} font-mono`}
                disabled={submitting}
              />
            </div>

            <div>
              <label htmlFor="task-tags" className={labelClass}>תגיות</label>
              {tags.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {tags.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 rounded-[var(--radius)] border border-border bg-background px-2 py-1 text-xs text-foreground"
                    >
                      {t}
                      <button
                        type="button"
                        onClick={() => setTags((prev) => prev.filter((x) => x !== t))}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label={`הסר תגית ${t}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <input
                id="task-tags"
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                onBlur={addTag}
                className={fieldClass(false)}
                disabled={submitting}
                placeholder="הקלד תגית ולחץ Enter"
              />
            </div>

            <div>
              <label htmlFor="task-notes" className={labelClass}>הערות</label>
              <textarea
                id="task-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className={`${fieldClass(false)} resize-y`}
                disabled={submitting}
                placeholder="מידע נוסף על המשימה (אופציונלי)"
              />
            </div>
          </div>
```

- [ ] **Step 5: Make the footer sticky**

Change the footer `<div>` opening tag from:

```tsx
          <div className="flex justify-end gap-3 border-t border-border pt-4">
```

to:

```tsx
          <div className="sticky bottom-0 z-10 -mx-5 -mb-5 flex justify-end gap-3 border-t border-border bg-card px-5 py-4 sm:-mx-6 sm:-mb-6 sm:px-6">
```

(The negative margins let the sticky bar span the sheet's padding and sit flush at the bottom edge; `bg-card` keeps scrolled content from showing through.)

- [ ] **Step 6: Build + lint**

Run: `npm run lint && npm run build`
Expected: still the single `app/tasks/page.tsx` `board`-prop error from Task 4. Continue.

---

## Task 8: Wire the responsive split in the tasks page

**Files:**
- Modify: `app/tasks/page.tsx`

- [ ] **Step 1: Replace the file contents**

Replace `app/tasks/page.tsx` with:

```tsx
"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@/components/app-layout";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { KanbanBoard } from "@/components/tasks/kanban-board";
import { MobileTaskList } from "@/components/tasks/mobile-task-list";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import { useTasksBoard } from "@/components/tasks/use-tasks-board";

export default function TasksPage() {
  const [creating, setCreating] = useState(false);
  const board = useTasksBoard();

  // Auto-open the create dialog when arriving via /tasks?create=true (e.g. the
  // dashboard "+ משימה חדשה" quick action). Reading the param off window avoids
  // the Suspense boundary that useSearchParams would require.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("create") === "true") {
      // One-time deep-link handling on mount; safe to set state synchronously here.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCreating(true);
      window.history.replaceState(null, "", "/tasks");
    }
  }, []);

  return (
    <AppLayout>
      <PageContainer>
        <PageHeader title="משימות">
          <button
            onClick={() => setCreating(true)}
            className="min-h-[44px] rounded-[var(--radius-card)] bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary/90"
          >
            + משימה חדשה
          </button>
        </PageHeader>

        <div className="hidden lg:block">
          <KanbanBoard board={board} />
        </div>
        <div className="lg:hidden">
          <MobileTaskList board={board} />
        </div>

        {creating && (
          <TaskFormDialog
            mode="create"
            onClose={() => setCreating(false)}
            onSaved={() => { setCreating(false); board.load(); }}
          />
        )}
      </PageContainer>
    </AppLayout>
  );
}
```

- [ ] **Step 2: Build + lint (now fully green)**

Run: `npm run lint && npm run build`
Expected: clean — no TS errors. All task-board wiring now resolves.

- [ ] **Step 3: Manual verification (mobile + desktop)**

Run: `npm run dev`. In the browser devtools device toolbar:
- Mobile width (<1024px): tabs render with counts; default tab is "בעבודה" when something is in progress, else "חדש"; tapping a tab switches the list; tapping a card opens a bottom-sheet; the action buttons move the task between statuses; moving to "בעבודה" starts a timer (check the persistent timer bar); moving a running task out of "בעבודה" opens the stop modal and the move commits only after confirming the stop.
- Desktop width (≥1024px): the Kanban board behaves exactly as before (drag between columns, timer start/stop).

- [ ] **Step 4: Run tests + commit the whole tasks-mobile feature**

Run: `npm test`
Expected: all pass.

```bash
git add components/tasks/kanban-board.tsx components/tasks/mobile-task-list.tsx components/tasks/task-detail-sheet.tsx components/tasks/task-form-dialog.tsx app/tasks/page.tsx
git commit -m "feat(tasks): mobile status-tabbed list + bottom-sheet dialogs"
```

---

## Task 9: Timer-start modal — task implies the description

**Files:**
- Modify: `contexts/timer-context.tsx`
- Modify: `components/timer-start-modal.tsx`

- [ ] **Step 1: Default the description to the task title in `handleStartTimer`**

In `contexts/timer-context.tsx`, inside `handleStartTimer`, replace the `body: JSON.stringify({ ... })` object passed to `/api/timer/start` so the description falls back to the selected task's title. Change:

```tsx
        body: JSON.stringify({
          projectId: selectedProject,
          taskId: selectedTask || null,
          description: timerDescription || null,
          rate: timerRates.find((r) => r.id === selectedRateId)?.rate ?? null,
          rateLabel: timerRates.find((r) => r.id === selectedRateId)?.name ?? null,
        }),
```

to:

```tsx
        body: JSON.stringify({
          projectId: selectedProject,
          taskId: selectedTask || null,
          // A selected task IS the "what am I working on" — default the
          // description to its title (matches the Kanban move-to-in_progress path).
          description:
            timerDescription ||
            (selectedTask ? timerTasks.find((t) => t.id === selectedTask)?.name ?? null : null),
          rate: timerRates.find((r) => r.id === selectedRateId)?.rate ?? null,
          rateLabel: timerRates.find((r) => r.id === selectedRateId)?.name ?? null,
        }),
```

Then add `timerTasks` to the `handleStartTimer` `useCallback` dependency array (currently `[selectedProject, selectedTask, timerDescription, timerRates, selectedRateId, fetchRunningTimer]`):

```tsx
  }, [selectedProject, selectedTask, timerDescription, timerTasks, timerRates, selectedRateId, fetchRunningTimer]);
```

- [ ] **Step 2: Hide the "תיאור" field when a task is selected**

In `components/timer-start-modal.tsx`, wrap the description field block so it only renders when no task is selected. Replace:

```tsx
              <div>
                <label
                  htmlFor="timer-description"
                  className="block text-sm font-medium text-foreground mb-1"
                >
                  תיאור
                </label>
                <input
                  type="text"
                  id="timer-description"
                  value={timerDescription}
                  onChange={(e) => setTimerDescription(e.target.value)}
                  placeholder="מה אתה עובד עליו?"
                  className="w-full rounded-[var(--radius)] border border-border bg-background px-3 py-2.5 text-sm shadow-sm focus:border-primary focus:ring-1 focus:ring-primary"
                  disabled={startingTimer}
                />
              </div>
```

with:

```tsx
              {!selectedTask && (
                <div>
                  <label
                    htmlFor="timer-description"
                    className="block text-sm font-medium text-foreground mb-1"
                  >
                    תיאור
                  </label>
                  <input
                    type="text"
                    id="timer-description"
                    value={timerDescription}
                    onChange={(e) => setTimerDescription(e.target.value)}
                    placeholder="מה אתה עובד עליו?"
                    className="w-full rounded-[var(--radius)] border border-border bg-background px-3 py-2.5 text-sm shadow-sm focus:border-primary focus:ring-1 focus:ring-primary"
                    disabled={startingTimer}
                  />
                </div>
              )}
```

- [ ] **Step 3: Build + lint**

Run: `npm run lint && npm run build`
Expected: clean.

- [ ] **Step 4: Manual verification**

Run: `npm run dev`. Open the start-timer modal (press `t` or the FAB). Pick a project, then a task → the "תיאור" field disappears. Start the timer → the new running entry's description equals the task title (verify in the persistent timer bar / `/entries`). With no task selected, the description field is present as before.

- [ ] **Step 5: Commit**

```bash
git add contexts/timer-context.tsx components/timer-start-modal.tsx
git commit -m "feat(timer): a selected task is the description (hide redundant field)"
```

---

## Task 10: Clients list — mobile card view

**Files:**
- Modify: `app/clients/page.tsx`

- [ ] **Step 1: Gate the table to desktop**

In `app/clients/page.tsx`, change the table wrapper from:

```tsx
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border">
```

to:

```tsx
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-border">
```

- [ ] **Step 2: Add the mobile card list**

Directly after the closing `</table>` + its wrapping `</div>` (the `hidden md:block` div), and still inside the `clients.length === 0 ? (...) : (...)` populated branch, add a sibling mobile list:

```tsx
            <div className="md:hidden divide-y divide-border">
              {clients.map((client) => (
                <div key={client.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={`/clients/${client.id}`}
                      className="text-sm font-semibold text-primary hover:text-primary/90"
                    >
                      {client.name}
                    </Link>
                    {client.isActive ? (
                      <span className="inline-flex shrink-0 rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-semibold text-success">פעיל</span>
                    ) : (
                      <span className="inline-flex shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">לא פעיל</span>
                    )}
                  </div>

                  {(client.contactName || client.email || client.phone) && (
                    <div className="mt-1 space-y-0.5 text-sm text-muted-foreground">
                      {client.contactName && <div>{client.contactName}</div>}
                      {client.email && <div className="truncate">{client.email}</div>}
                      {client.phone && <div className="tabular-nums">{client.phone}</div>}
                    </div>
                  )}

                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    <span className="text-muted-foreground">
                      תעריף:{" "}
                      <span className="text-foreground">
                        {client.defaultRate ? `${CURRENCY_SYMBOLS[client.currency] || "₪"}${client.defaultRate}/שעה` : "-"}
                      </span>
                    </span>
                    <span className="text-muted-foreground">
                      חויב:{" "}
                      <span className="font-medium text-foreground">
                        {Number(client.totalBilled) > 0 ? `₪${Number(client.totalBilled).toFixed(2)}` : "₪0"}
                      </span>
                    </span>
                    <span className="text-muted-foreground">
                      שעות:{" "}
                      <span className="text-foreground tabular-nums">
                        {Number(client.totalHours) > 0 ? `${Number(client.totalHours).toFixed(1)}` : "0"}
                      </span>
                    </span>
                  </div>

                  <div className="mt-3">
                    <button
                      onClick={() => handleEdit(client)}
                      className="min-h-[44px] rounded-[var(--radius)] border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface"
                    >
                      ערוך
                    </button>
                  </div>
                </div>
              ))}
            </div>
```

- [ ] **Step 3: Build + lint**

Run: `npm run lint && npm run build`
Expected: clean. (`CURRENCY_SYMBOLS`, `Link`, and `handleEdit` are already imported/defined in this file — confirmed by the existing table code that uses them.)

- [ ] **Step 4: Manual verification**

`npm run dev`, open `/clients` at mobile width — clients render as cards (no horizontal scroll); "ערוך" opens the edit form; the name links to the client page. At `md+` the table is unchanged.

- [ ] **Step 5: Commit**

```bash
git add app/clients/page.tsx
git commit -m "feat(clients): mobile card list (no horizontal scroll)"
```

---

## Task 11: Projects list — mobile card view

**Files:**
- Modify: `app/projects/page.tsx`

- [ ] **Step 1: Gate the table to desktop**

In `app/projects/page.tsx`, change:

```tsx
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border">
```

to:

```tsx
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-border">
```

- [ ] **Step 2: Add the mobile card list**

After the table's closing `</table></div>` (the `hidden md:block` wrapper), still inside the populated branch, add:

```tsx
            <div className="md:hidden divide-y divide-border">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="cursor-pointer p-4"
                  onClick={() => router.push(`/projects/${project.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") router.push(`/projects/${project.id}`); }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-semibold text-primary">{project.name}</div>
                    {project.status === "active" ? (
                      <span className="inline-flex shrink-0 rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-semibold text-success">{getStatusLabel(project.status)}</span>
                    ) : project.status === "completed" ? (
                      <span className="inline-flex shrink-0 rounded-full bg-secondary/10 px-2.5 py-0.5 text-xs font-semibold text-secondary">{getStatusLabel(project.status)}</span>
                    ) : project.status === "paused" ? (
                      <span className="inline-flex shrink-0 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-700">{getStatusLabel(project.status)}</span>
                    ) : (
                      <span className="inline-flex shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">{getStatusLabel(project.status)}</span>
                    )}
                  </div>

                  <div className="mt-1 text-sm text-muted-foreground">{project.clientName}</div>

                  <div className="mt-1 text-xs text-muted-foreground">
                    {project.startDate ? new Date(project.startDate).toLocaleDateString("he-IL") : "-"}
                    {" - "}
                    {project.endDate ? new Date(project.endDate).toLocaleDateString("he-IL") : "ללא תאריך סיום"}
                  </div>

                  {statusFilter === "archived" && (
                    <div className="mt-3">
                      <button
                        onClick={(e) => handleRestore(project.id, e)}
                        className="min-h-[44px] rounded-[var(--radius)] border border-border px-4 py-2 text-sm font-medium text-success transition-colors hover:bg-surface"
                      >
                        שחזר
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
```

- [ ] **Step 3: Build + lint**

Run: `npm run lint && npm run build`
Expected: clean. (`router`, `getStatusLabel`, `handleRestore`, `statusFilter` are already defined/used in this file's table code.)

- [ ] **Step 4: Manual verification**

`npm run dev`, open `/projects` at mobile width — projects render as tappable cards (navigate to the project page); the status pill matches the table; in the "archived" filter the "שחזר" button restores without navigating (the existing `handleRestore` calls `e.stopPropagation`). At `md+` the table is unchanged.

- [ ] **Step 5: Commit**

```bash
git add app/projects/page.tsx
git commit -m "feat(projects): mobile card list (no horizontal scroll)"
```

---

## Final verification

- [ ] **Full suite + lint + build**

Run: `npm test && npm run lint && npm run build`
Expected: all unit tests pass, lint clean (zero warnings), build succeeds.

- [ ] **Cross-screen manual smoke (mobile width)**

- `/tasks`: tabs, card tap → bottom-sheet, status buttons, timer start/stop, create with collapsed "פרטים נוספים", edit.
- Start-timer modal with a task selected: no description field; entry takes the task title.
- `/clients`, `/projects`: card lists, no horizontal scroll, actions work.
- Desktop width: Kanban drag, dialogs centered, tables present — all unchanged.

---

## Self-review notes (already reconciled against the spec)

- **Spec coverage:** §3.1 hook → Task 3; §3.2 responsive split → Task 8 (refined to a single shared hook, documented above); §3.3 KanbanBoard refactor → Task 4; §3.4 MobileTaskList → Task 5; §3.5 detail sheet actions → Task 6; §3.6 dialog sheet variant → Task 2; §3.7 form disclosure → Task 7; §3.8 transitions helper → Task 1; §3.9 timer-start description → Task 9; §3.10 clients/projects cards → Tasks 10–11.
- **Type consistency:** `UseTasksBoardReturn` (Task 3) is the prop type used in Tasks 4, 5, 6. `moveTask(taskId, toStatus)` and `allowedTransitions(status) → TaskTransition[]` signatures match across tasks. `variant="sheet"` (Task 2) is consumed in Tasks 6 and 7.
- **No placeholders:** every code step contains the full code to paste.
- **Build-order note:** Tasks 4–7 intentionally leave the build red until Task 8 wires the page; each step states the expected remaining error so the implementer isn't surprised. Commits happen at green points (Tasks 1, 2, 3, 8, 9, 10, 11).
