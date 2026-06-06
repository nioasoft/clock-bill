/** Pure helper: which status-change buttons a task offers from its current status. */
import type { TaskStatus } from "./tasks-types";

/** Message key under the `Tasks.transitions` namespace. */
export type TransitionLabelKey =
  | "start"
  | "markDone"
  | "finish"
  | "backToTodo"
  | "backToInProgress";

export interface TaskTransition {
  /** Target status this button moves the task to. */
  to: TaskStatus;
  /** Message key under `Tasks.transitions` — resolve with `t(labelKey)`. */
  labelKey: TransitionLabelKey;
  /** Whether this is the primary (accent) action. */
  primary: boolean;
}

const TRANSITIONS: Record<TaskStatus, TaskTransition[]> = {
  todo: [
    { to: "in_progress", labelKey: "start", primary: true },
    { to: "done", labelKey: "markDone", primary: false },
  ],
  in_progress: [
    { to: "done", labelKey: "finish", primary: true },
    { to: "todo", labelKey: "backToTodo", primary: false },
  ],
  done: [
    { to: "in_progress", labelKey: "backToInProgress", primary: true },
    { to: "todo", labelKey: "backToTodo", primary: false },
  ],
};

/** The ordered list of status-change actions available from `status`. */
export function allowedTransitions(status: TaskStatus): TaskTransition[] {
  return TRANSITIONS[status];
}
