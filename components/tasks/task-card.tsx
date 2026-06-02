"use client";

import { TASK_PRIORITY_LABEL, type TaskRecord } from "@/lib/tasks-types";

interface TaskCardProps {
  task: TaskRecord;
  isTimerRunning: boolean;
  onClick: () => void;
}

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
