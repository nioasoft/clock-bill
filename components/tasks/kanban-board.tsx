"use client";

import { useCallback, useState } from "react";
import { DndContext, DragOverlay, PointerSensor, KeyboardSensor, useSensor, useSensors, closestCorners, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("Tasks.board");
  const { runningTimerForTask } = useTimer();
  const { state, load, byStatus, moveTask } = board;
  const [selected, setSelected] = useState<TaskRecord | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeTask = activeId ? state.tasks.find((t) => t.id === activeId) ?? null : null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveId(null);
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

  // Only the very first load shows the skeleton; background refetches (moves,
  // creates, timer stops) keep the current cards visible and swap in place.
  if (state.loading && state.tasks.length === 0) {
    return <div className="flex gap-4">{TASK_STATUSES.map((s) => (
      <div key={s} className="min-w-72 flex-1 animate-pulse rounded-[var(--radius-card)] border border-border bg-surface h-64" />
    ))}</div>;
  }
  if (state.error) {
    return (
      <div className="rounded-[var(--radius-card)] border border-border bg-card p-8 text-center">
        <p className="text-foreground">{t("loadError")}</p>
        <button onClick={load} className="mt-3 min-h-[44px] rounded-[var(--radius)] bg-primary px-4 py-2 text-primary-foreground">{t("retry")}</button>
      </div>
    );
  }
  if (state.tasks.length === 0) {
    return (
      <div className="rounded-[var(--radius-card)] border border-border bg-card p-10 text-center">
        <p className="text-foreground">{t("emptyTitle")}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t("emptyHint")}</p>
      </div>
    );
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
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
        {/* Ghost that follows the pointer while dragging (smooth feel). */}
        <DragOverlay>
          {activeTask ? (
            <TaskCard
              task={activeTask}
              isTimerRunning={Boolean(runningTimerForTask(activeTask.id))}
              onClick={() => {}}
            />
          ) : null}
        </DragOverlay>
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
