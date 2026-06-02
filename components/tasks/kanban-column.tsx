"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { TASK_STATUS_LABEL, type TaskRecord, type TaskStatus } from "@/lib/tasks-types";
import { SortableTaskCard } from "./kanban-board";

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
