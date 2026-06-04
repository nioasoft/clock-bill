"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useTimer } from "@/contexts/timer-context";
import { showSuccessToast, showErrorToast } from "@/lib/toast";
import { TASK_PRIORITY_LABEL, type TaskRecord } from "@/lib/tasks-types";
import { allowedTransitions } from "@/lib/tasks-transitions";
import type { TaskStatus } from "@/lib/tasks-types";
import { TaskFormDialog } from "./task-form-dialog";

interface TaskDetailSheetProps {
  task: TaskRecord;
  moveTask: (taskId: string, toStatus: TaskStatus) => Promise<void>;
  onClose: () => void;
  onChanged: () => void;
}

const rowLabelClass = "text-xs font-semibold uppercase tracking-widest text-muted-foreground";

export function TaskDetailSheet({ task, moveTask, onClose, onChanged }: TaskDetailSheetProps) {
  const { runningTimerForTask } = useTimer();
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
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

  const isTimerRunning = Boolean(runningTimerForTask(task.id));

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        showSuccessToast("המשימה נמחקה בהצלחה");
        onChanged();
      } else {
        showErrorToast(data.message || "שגיאה במחיקת המשימה");
      }
    } catch (error) {
      console.error("Error deleting task:", error);
      showErrorToast("שגיאה במחיקת המשימה");
    } finally {
      setDeleting(false);
    }
  };

  // While editing, render the edit form instead of the detail view.
  if (editing) {
    return (
      <TaskFormDialog
        mode="edit"
        task={task}
        onClose={() => setEditing(false)}
        onSaved={onChanged}
      />
    );
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent variant="sheet">
        <DialogHeader>
          <DialogTitle>{task.title}</DialogTitle>
          <DialogDescription>
            {task.clientName} · {task.projectName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isTimerRunning && (
            <div className="rounded-[var(--radius)] bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">
              טיימר רץ למשימה זו
            </div>
          )}

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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className={rowLabelClass}>תעריף</p>
              <p className="mt-1 text-sm text-foreground">
                {task.rateLabel ?? <span className="text-destructive">חסר תעריף</span>}
              </p>
            </div>
            <div>
              <p className={rowLabelClass}>דחיפות</p>
              <p className="mt-1 text-sm text-foreground">{TASK_PRIORITY_LABEL[task.priority]}</p>
            </div>
            <div>
              <p className={rowLabelClass}>תאריך יעד</p>
              <p className="mt-1 text-sm text-foreground">{task.dueDate ?? "—"}</p>
            </div>
            <div>
              <p className={rowLabelClass}>תגיות</p>
              {task.tags.length > 0 ? (
                <div className="mt-1 flex flex-wrap gap-2">
                  {task.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-[var(--radius)] border border-border px-1.5 py-0.5 text-xs text-foreground"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-sm text-foreground">—</p>
              )}
            </div>
          </div>

          <div>
            <p className={rowLabelClass}>הערות</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
              {task.notes?.trim() ? task.notes : "—"}
            </p>
          </div>

          {confirmingDelete ? (
            <div className="rounded-[var(--radius)] border border-destructive/30 bg-destructive/10 p-4">
              <p className="text-sm text-foreground">האם למחוק את המשימה?</p>
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  disabled={deleting}
                  className="rounded-[var(--radius)] border border-border px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                >
                  ביטול
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="rounded-[var(--radius)] bg-destructive px-4 py-2 text-sm text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50"
                >
                  {deleting ? "מוחק..." : "מחק"}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex justify-end gap-3 border-t border-border pt-4">
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="rounded-[var(--radius)] border border-destructive/30 px-4 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10"
              >
                מחיקה
              </button>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="rounded-[var(--radius)] bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                עריכה
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
