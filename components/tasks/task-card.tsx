"use client";

import { useTranslations } from "next-intl";
import { type TaskRecord } from "@/lib/tasks-types";
import { appToday } from "@/lib/dates";

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

// Prominent badge next to the title. urgent = solid red, high = yellow outline
// (matches the existing high=bg-primary side bar; stays on design tokens).
const priorityBadge: Record<TaskRecord["priority"], string | null> = {
  normal: null,
  high: "border border-primary/60 text-primary",
  urgent: "bg-destructive text-destructive-foreground",
};

// Whole-card tint so an urgent task reads at a glance (subtle, tokens only).
const cardTone: Record<TaskRecord["priority"], string> = {
  normal: "border-border bg-card",
  high: "border-border bg-card",
  urgent: "border-destructive/40 bg-destructive/5",
};

function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false;
  // App-timezone day: the UTC day would flag a task due today as overdue
  // between local midnight and 03:00.
  return dueDate < appToday();
}

export function TaskCard({ task, isTimerRunning, onClick }: TaskCardProps) {
  const tPriority = useTranslations("Tasks.priority");
  const t = useTranslations("Tasks.card");
  // A completed task is no longer urgent — drop the priority badge/tint on "done"
  // (calm the card once it's finished).
  const priority = task.status === "done" ? "normal" : task.priority;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-start rounded-[var(--radius-card)] border p-3 transition-colors hover:bg-card-elevated ${cardTone[priority]}`}
    >
      <div className="flex items-start gap-2">
        <span className={`mt-1 h-full w-1 shrink-0 rounded-full ${priorityBar[priority]}`} aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              {priorityBadge[priority] && (
                <span className={`shrink-0 rounded-[var(--radius)] px-1.5 py-0.5 text-xs font-semibold ${priorityBadge[priority]}`}>
                  {tPriority(priority)}
                </span>
              )}
              <span className="truncate font-sans font-medium text-foreground">{task.title}</span>
            </div>
            {isTimerRunning && (
              <span className="shrink-0 rounded-[var(--radius)] bg-primary px-1.5 py-0.5 text-xs text-primary-foreground">
                {t("timerRunning")}
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
              <span className="text-destructive">{t("missingRate")}</span>
            )}
            {task.dueDate && (
              isOverdue(task.dueDate) ? (
                <span className="rounded-[var(--radius)] bg-destructive px-1.5 py-0.5 text-destructive-foreground">
                  {t("due", { date: task.dueDate })}
                </span>
              ) : (
                <span>{t("due", { date: task.dueDate })}</span>
              )
            )}
            {task.tags.map((t) => (
              <span key={t} className="rounded-[var(--radius)] border border-border px-1.5 py-0.5">{t}</span>
            ))}
          </div>
        </div>
      </div>
    </button>
  );
}
