import { z } from "zod";
import { PAYMENT_METHODS } from "@/lib/charge-documents";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_AMOUNT = 10_000_000;

function isRealIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

export const reconciliationMatchSchema = z.object({
  documentId: z.string().min(1).max(100),
  amount: z.number().positive().max(MAX_AMOUNT),
  paidAt: z.string().refine(isRealIsoDate, "Invalid payment date"),
  method: z.enum(PAYMENT_METHODS).default("bank_transfer"),
  note: z.string().max(500).nullish(),
  reconciliationKey: z.string().min(8).max(200),
});

export const applyReconciliationSchema = z.object({
  confirmed: z.literal(true),
  matches: z.array(reconciliationMatchSchema).min(1).max(100),
}).superRefine(({ matches }, ctx) => {
  const keys = new Set<string>();
  for (const [index, match] of matches.entries()) {
    if (keys.has(match.reconciliationKey)) {
      ctx.addIssue({
        code: "custom",
        path: ["matches", index, "reconciliationKey"],
        message: "Duplicate reconciliation key",
      });
    }
    keys.add(match.reconciliationKey);
  }
});

export type ApplyReconciliationBody = z.infer<typeof applyReconciliationSchema>;
