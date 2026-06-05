/** Shared task types used by API routes and board UI. */

export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "normal" | "high" | "urgent";

export const TASK_STATUSES: readonly TaskStatus[] = ["todo", "in_progress", "done"];
export const TASK_PRIORITIES: readonly TaskPriority[] = ["normal", "high", "urgent"];

// Labels live in the message catalogs (`Tasks.status.*`, `Tasks.priority.*`).
// A status/priority value IS its own message key, so resolve at the call site
// with `useTranslations("Tasks.status")(status)` / `("Tasks.priority")(priority)`.

/** A task row as returned to the client by /api/tasks. */
export interface TaskRecord {
  id: string;
  clientId: string;
  clientName: string;
  projectId: string;
  projectName: string;
  rateId: string | null;
  rate: number | null;
  rateLabel: string | null;
  title: string;
  notes: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null; // ISO date (YYYY-MM-DD) or null
  position: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}
