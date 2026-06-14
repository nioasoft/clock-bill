"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useTimer } from "@/contexts/timer-context";
import { TASK_STATUSES, type TaskRecord, type TaskStatus } from "@/lib/tasks-types";
import { Tabs } from "@/components/ui/tabs";
import { TaskCard } from "./task-card";
import { TaskDetailSheet } from "./task-detail-sheet";
import type { UseTasksBoardReturn } from "./use-tasks-board";

export function MobileTaskList({ board }: { board: UseTasksBoardReturn }) {
  const tStatus = useTranslations("Tasks.status");
  const tEmpty = useTranslations("Tasks.empty");
  const t = useTranslations("Tasks.board");
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

  const tasks = byStatus(tab);

  return (
    <>
      <Tabs
        className="mb-4"
        ariaLabel={t("filterByStatus")}
        active={tab}
        onChange={(k) => setActive(k as TaskStatus)}
        tabs={TASK_STATUSES.map((s) => ({
          key: s,
          label: tStatus(s),
          count: byStatus(s).length,
        }))}
      />

      <div role="tabpanel" className="flex flex-col gap-2">
        {tasks.length === 0 ? (
          <p className="px-2 py-10 text-center text-sm text-muted-foreground">{tEmpty(tab)}</p>
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
