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
