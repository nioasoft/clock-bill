import { z } from "zod";

const optionalText = z.string().trim().max(5000).nullable().optional();

export const createWorkTemplateSchema = z.object({
  clientId: z.string().min(1).max(128),
  projectId: z.string().min(1).max(128),
  rateId: z.string().min(1).max(128).nullable().optional(),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(500),
  notes: optionalText,
  billingKind: z.enum(["hourly", "item"]),
  duration: z.number().int().min(0).max(1440).nullable().optional(),
  quantity: z.number().min(0).max(1_000_000).nullable().optional(),
  rate: z.number().min(0).max(1_000_000_000).nullable().optional(),
  rateLabel: z.string().trim().max(120).nullable().optional(),
  unit: z.string().trim().max(60).nullable().optional(),
  isBillable: z.boolean().default(true),
  discountPercent: z.number().min(0).max(100).nullable().optional(),
});

export type CreateWorkTemplateInput = z.infer<typeof createWorkTemplateSchema>;
