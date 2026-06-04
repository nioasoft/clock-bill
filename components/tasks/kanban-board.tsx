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
