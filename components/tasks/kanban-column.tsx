"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { type TaskRecord, type TaskStatus } from "@/lib/tasks-types";
import { SortableTaskCard } from "./kanban-board";

interface KanbanColumnProps {
  status: TaskStatus;
  tasks: TaskRecord[];
  runningTimerForTask: (taskId: string) => string | null;
  onCardClick: (task: TaskRecord) => void;
  onCreate?: () => void;
}

export function KanbanColumn({ status, tasks, runningTimerForTask, onCardClick, onCreate }: KanbanColumnProps) {
  const tStatus = useTranslations("Tasks.status");
  const tEmpty = useTranslations("Tasks.empty");
  const tBoard = useTranslations("Tasks.board");
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div className="flex min-w-72 flex-1 flex-col">
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="font-sans font-medium text-foreground">{tStatus(status)}</span>
          <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground tabular-nums">
            {tasks.length}
          </span>
        </div>
        {status === "todo" && onCreate ? (
          <button
            type="button"
            onClick={onCreate}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[var(--radius)] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={tBoard("newTask")}
            title={tBoard("newTask")}
          >
            <Plus className="h-5 w-5" aria-hidden="true" />
          </button>
        ) : null}
      </div>
      <div
        ref={setNodeRef}
        className={`flex min-h-32 flex-col gap-2 rounded-[var(--radius-card)] border border-border p-2 transition-colors ${isOver ? "bg-card-elevated" : "bg-surface"}`}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">{tEmpty(status)}</p>
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
