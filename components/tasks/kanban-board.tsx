"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  // Holds the pending unsubscribe for an in-flight "drag out of in_progress → stop
  // timer" subscription, so a new drag can replace a lingering (cancelled) one.
  const pendingStopUnsubRef = useRef<(() => void) | null>(null);

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

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const task = state.tasks.find((t) => t.id === active.id);
    if (!task) return;

    const overId = String(over.id);
    const targetStatus: TaskStatus = (TASK_STATUSES as readonly string[]).includes(overId)
      ? (overId as TaskStatus)
      : state.tasks.find((t) => t.id === overId)?.status ?? task.status;

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
        // Drop any lingering subscription from a previous (cancelled) stop-drag.
        if (pendingStopUnsubRef.current) {
          pendingStopUnsubRef.current();
          pendingStopUnsubRef.current = null;
        }
        const unsub = onTimerStopped(async () => {
          // Guard: onTimerStopped fires for ANY stopped timer. If OUR entry is
          // still running, some other timer stopped — keep waiting (don't unsub).
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
          onClose={() => setSelected(null)}
          onChanged={() => { setSelected(null); load(); }}
        />
      )}
    </>
  );
}
