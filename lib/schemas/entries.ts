import { z } from "zod";

/**
 * Body schema for creating/updating a manual time entry. Shared by
 * POST /api/entries and PUT /api/entries/[id] so both validate identically.
 *
 * Billing rules:
 * - hourly lines use `duration` (minutes); item lines use `quantity` (duration 0).
 * - an item line must carry a name (`rateLabel`) and a unit price (`rate`), whether
 *   it's a catalog item or a typed ad-hoc one — so nothing unnamed/unpriced is billed.
 */
export const entryBodySchema = z
  .object({
    projectId: z.string({ message: "נא לבחור פרויקט" }).min(1, "נא לבחור פרויקט"),
    taskId: z.string().nullish(),
    date: z.string({ message: "נא לבחור תאריך" }).min(1, "נא לבחור תאריך"),
    duration: z.number({ message: "נא להזין משך זמן תקין" }).min(0),
    description: z
      .string({ message: "נא להזין תיאור" })
      .trim()
      .min(1, "נא להזין תיאור")
      .max(5000),
    notes: z.string().max(5000).nullish(),
    isBillable: z.boolean().nullish(),
    tags: z.array(z.string().max(100)).nullish(),
    billingKind: z.enum(["hourly", "item"]).nullish(),
    rate: z.number().min(0).nullish(),
    rateLabel: z.string().max(100).nullish(),
    quantity: z.number().min(0).nullish(),
  })
  .refine(
    (d) => (d.billingKind === "item" ? (d.quantity ?? 0) > 0 : d.duration > 0),
    { message: "נא להזין כמות לפריט או משך זמן לשעות", path: ["duration"] }
  )
  .refine(
    (d) => d.billingKind !== "item" || (typeof d.rateLabel === "string" && d.rateLabel.trim().length > 0),
    { message: "נא להזין שם פריט", path: ["rateLabel"] }
  )
  .refine(
    (d) => d.billingKind !== "item" || typeof d.rate === "number",
    { message: "נא להזין מחיר ליחידה", path: ["rate"] }
  );

export type EntryBody = z.infer<typeof entryBodySchema>;
