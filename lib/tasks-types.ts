/** Shared task types used by API routes and board UI. */

export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "normal" | "high" | "urgent";

export const TASK_STATUSES: readonly TaskStatus[] = ["todo", "in_progress", "done"];
export const TASK_PRIORITIES: readonly TaskPriority[] = ["normal", "high", "urgent"];

/** Hebrew column labels, in board (RTL) order. */
export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "חדש",
  in_progress: "בעבודה",
  done: "הושלם",
};

export const TASK_PRIORITY_LABEL: Record<TaskPriority, string> = {
  normal: "רגילה",
  high: "גבוהה",
  urgent: "דחוף",
};

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
