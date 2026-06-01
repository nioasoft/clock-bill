import { z } from "zod";

const PERIOD_MONTH = /^\d{4}-\d{2}$/;
const KNOWN_TEMPLATES = ["modern", "classic", "bold", "elegant", "nature", "ocean"] as const;

/** A computed (non-time-entry) line the client chose to include. */
export const computedLineSchema = z.object({
  sourceType: z.enum(["fixed_monthly", "retainer"]),
  periodMonth: z.string().regex(PERIOD_MONTH, "חודש לא תקין"),
  label: z.string().min(1).max(200),
  amount: z.number(),
});

/** POST /api/charge-documents body. */
export const createChargeDocumentSchema = z
  .object({
    clientId: z.string({ message: "נא לבחור לקוח" }).min(1, "נא לבחור לקוח"),
    pdfTemplate: z.enum(KNOWN_TEMPLATES).default("modern"),
    notes: z.string().max(2000).nullish(),
    timeEntryIds: z.array(z.string().min(1)).default([]),
    computedLines: z.array(computedLineSchema).default([]),
  })
  .refine((d) => d.timeEntryIds.length + d.computedLines.length > 0, {
    message: "נא לבחור לפחות פריט אחד לחיוב",
    path: ["timeEntryIds"],
  });

/** PATCH a single line on a pending document (edit text). */
export const patchChargeLineSchema = z.object({
  lineId: z.string().min(1),
  description: z.string().max(5000).nullish(),
  notes: z.string().max(5000).nullish(),
});

/** PATCH document-level fields / line operations. */
export const patchChargeDocumentSchema = z.object({
  notes: z.string().max(2000).nullish(),
  editLine: patchChargeLineSchema.nullish(),
  removeLineId: z.string().min(1).nullish(),
  addTimeEntryId: z.string().min(1).nullish(),
});

export type CreateChargeDocumentBody = z.infer<typeof createChargeDocumentSchema>;
export type PatchChargeDocumentBody = z.infer<typeof patchChargeDocumentSchema>;
