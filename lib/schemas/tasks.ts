import { z } from "zod";
import { TASK_STATUSES, TASK_PRIORITIES } from "../tasks-types";

const titleField = z
  .string({ message: "נא להזין שם משימה" })
  .trim()
  .min(1, "נא להזין שם משימה")
  .max(500, "שם המשימה ארוך מדי");

const priorityField = z.enum(
  TASK_PRIORITIES as unknown as [string, ...string[]],
  { message: "רמת דחיפות לא תקינה" }
);

const statusField = z.enum(
  TASK_STATUSES as unknown as [string, ...string[]],
  { message: "סטטוס לא תקין" }
);

const tagsField = z.array(z.string().trim().min(1).max(50)).max(50).default([]);

/** Create: client + project + rate are all required (the auto-timer needs them). */
export const createTaskSchema = z.object({
  clientId: z.string({ message: "נא לבחור לקוח" }).min(1, "נא לבחור לקוח"),
  projectId: z.string({ message: "נא לבחור פרויקט" }).min(1, "נא לבחור פרויקט"),
  rateId: z.string({ message: "נא לבחור תעריף" }).min(1, "נא לבחור תעריף"),
  title: titleField,
  notes: z.string().max(5000).nullish(),
  priority: priorityField.default("normal"),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "תאריך לא תקין").nullish(),
  tags: tagsField,
});

/** Update: any subset of editable fields. */
export const updateTaskSchema = z.object({
  clientId: z.string().min(1).optional(),
  projectId: z.string().min(1).optional(),
  rateId: z.string().min(1).optional(),
  title: titleField.optional(),
  notes: z.string().max(5000).nullish(),
  priority: priorityField.optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "תאריך לא תקין").nullish(),
  tags: z.array(z.string().trim().min(1).max(50)).max(50).optional(),
});

/** Move: target column + new fractional position. */
export const moveTaskSchema = z.object({
  status: statusField,
  position: z.number().finite(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type MoveTaskInput = z.infer<typeof moveTaskSchema>;
