import type { TaskStatus } from "./tasks-types";

/** What the client/server should do as a result of a drag move. */
export type MoveEffect = "start_timer" | "open_stop_modal" | "plain";

export interface MoveInput {
  from: TaskStatus;
  to: TaskStatus;
  /** Whether a timer is currently running for THIS task. */
  hasRunningTimer: boolean;
}

/**
 * Decide the side effect of a Kanban move:
 * - Entering "in_progress" from another column → start a timer.
 * - Leaving "in_progress" while a timer runs → open the stop modal (status is
 *   committed only after the stop is confirmed by the caller).
 * - Everything else (reorders, todo↔done, leaving in_progress with no timer) → plain.
 */
export function moveEffect({ from, to, hasRunningTimer }: MoveInput): MoveEffect {
  if (to === "in_progress" && from !== "in_progress") return "start_timer";
  if (from === "in_progress" && to !== "in_progress" && hasRunningTimer) return "open_stop_modal";
  return "plain";
}
