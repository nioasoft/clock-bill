import { z } from "zod";

const PERIOD_MONTH = /^\d{4}-\d{2}$/;
export const KNOWN_TEMPLATES = ["modern", "classic", "bold", "elegant", "nature", "ocean"] as const;

/** Hard caps on a single charge document's inputs (DoS / absurd-value guard).
 *  amount is also re-validated server-side against real fees. */
const MAX_LINE_AMOUNT = 10_000_000;
const MAX_TIME_ENTRIES = 5000;
const MAX_COMPUTED_LINES = 500;

/** A computed (non-time-entry) line the client chose to include. */
export const computedLineSchema = z.object({
  sourceType: z.enum(["fixed_monthly", "retainer"]),
  periodMonth: z.string().regex(PERIOD_MONTH, "חודש לא תקין"),
  label: z.string().min(1).max(200),
  amount: z.number().min(0, "סכום לא תקין").max(MAX_LINE_AMOUNT, "סכום לא תקין"),
});

/** POST /api/charge-documents body. */
export const createChargeDocumentSchema = z
  .object({
    clientId: z.string({ message: "נא לבחור לקוח" }).min(1, "נא לבחור לקוח"),
    pdfTemplate: z.enum(KNOWN_TEMPLATES).default("modern"),
    notes: z.string().max(2000).nullish(),
    timeEntryIds: z.array(z.string().min(1)).max(MAX_TIME_ENTRIES).default([]),
    computedLines: z.array(computedLineSchema).max(MAX_COMPUTED_LINES).default([]),
  })
  .refine((d) => d.timeEntryIds.length + d.computedLines.length > 0, {
    message: "נא לבחור לפחות פריט אחד לחיוב",
    path: ["timeEntryIds"],
  });

/** PATCH a single line on a pending document (edit text). */
export const patchChargeLineSchema = z.object({
  lineId: z.string().min(1),
  description: z.string().max(5000).optional(),
  notes: z.string().max(5000).optional(),
});

/** PATCH document-level fields / line operations. */
export const patchChargeDocumentSchema = z
  .object({
    notes: z.string().max(2000).optional(),
    editLine: patchChargeLineSchema.optional(),
    removeLineId: z.string().min(1).optional(),
    addTimeEntryId: z.string().min(1).optional(),
    // Summary grouping: 'project' | 'type' | null (null = no summary block).
    summaryMode: z.enum(["project", "type"]).nullable().optional(),
  })
  .refine(
    (d) =>
      d.notes !== undefined ||
      d.editLine !== undefined ||
      d.removeLineId !== undefined ||
      d.addTimeEntryId !== undefined ||
      d.summaryMode !== undefined,
    { message: "נא לספק לפחות שדה אחד לעדכון" }
  );

export type CreateChargeDocumentBody = z.infer<typeof createChargeDocumentSchema>;
export type PatchChargeDocumentBody = z.infer<typeof patchChargeDocumentSchema>;
