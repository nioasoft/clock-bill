import { z } from "zod";

/** A single entry can't bill more than 24h. */
const MAX_ENTRY_MINUTES = 24 * 60;
/** Generous upper bound for a unit price / item quantity (stops absurd values). */
const MAX_MONEY = 1_000_000;
const MAX_QUANTITY = 1_000_000;

/** Calendar date within a sane window: ~2 years back to +1 day (timezone slack),
 *  so entries can't be parked in arbitrary past/future VAT periods. */
export const entryDate = z
  .string({ message: "נא לבחור תאריך" })
  .regex(/^\d{4}-\d{2}-\d{2}$/, "תאריך לא תקין")
  .refine((d) => {
    const t = Date.parse(`${d}T00:00:00Z`);
    if (Number.isNaN(t)) return false;
    const now = Date.now();
    return t >= now - 2 * 365 * 24 * 60 * 60 * 1000 && t <= now + 24 * 60 * 60 * 1000;
  }, "התאריך מחוץ לטווח המותר");

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
    date: entryDate,
    duration: z.number({ message: "נא להזין משך זמן תקין" }).min(0).max(MAX_ENTRY_MINUTES),
    description: z
      .string({ message: "נא להזין תיאור" })
      .trim()
      .min(1, "נא להזין תיאור")
      .max(5000),
    notes: z.string().max(5000).nullish(),
    isBillable: z.boolean().nullish(),
    tags: z.array(z.string().max(100)).nullish(),
    billingKind: z.enum(["hourly", "item"]).nullish(),
    rate: z.number().min(0).max(MAX_MONEY).nullish(),
    rateLabel: z.string().max(100).nullish(),
    unit: z.string().trim().max(30).nullish(),
    quantity: z.number().min(0).max(MAX_QUANTITY).nullish(),
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

/**
 * PATCH /api/entries/[id] — write-off toggle only. `true` marks the entry
 * "agreed not to bill" (excluded from the billable pool); `false` restores it.
 * Deliberately separate from the full PUT body: the toggle must not require
 * re-sending the whole entry.
 */
export const entryWriteOffSchema = z.object({
  writtenOff: z.boolean({ message: "ערך לא תקין" }),
});
export type EntryWriteOffBody = z.infer<typeof entryWriteOffSchema>;
