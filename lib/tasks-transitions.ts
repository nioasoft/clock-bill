/** Pure helper: which status-change buttons a task offers from its current status. */
import type { TaskStatus } from "./tasks-types";

export interface TaskTransition {
  /** Target status this button moves the task to. */
  to: TaskStatus;
  /** Hebrew button label. */
  label: string;
  /** Whether this is the primary (accent) action. */
  primary: boolean;
}

const TRANSITIONS: Record<TaskStatus, TaskTransition[]> = {
  todo: [
    { to: "in_progress", label: "התחל", primary: true },
    { to: "done", label: "סמן כהושלם", primary: false },
  ],
  in_progress: [
    { to: "done", label: "סיים", primary: true },
    { to: "todo", label: "החזר לחדש", primary: false },
  ],
  done: [
    { to: "in_progress", label: "החזר לעבודה", primary: true },
    { to: "todo", label: "החזר לחדש", primary: false },
  ],
};

/** The ordered list of status-change actions available from `status`. */
export function allowedTransitions(status: TaskStatus): TaskTransition[] {
  return TRANSITIONS[status];
}
