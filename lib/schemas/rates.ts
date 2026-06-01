import { z } from "zod";

export type RateKind = "hourly" | "item";
export type BillingKind = "hourly" | "item";

export interface ClientRateInput {
  kind: RateKind;
  name: string;
  rate: number;
  isDefault: boolean;
}
export interface ClientRate extends ClientRateInput {
  id: string;
}

/** One rate/item row as accepted from the client on a client save. */
export const clientRateSchema: z.ZodType<ClientRateInput> = z.object({
  kind: z.enum(["hourly", "item"]),
  name: z.string().trim().min(1, "יש להזין שם לתעריף").max(100, "שם התעריף ארוך מדי"),
  rate: z.number().min(0, "התעריף לא יכול להיות שלילי"),
  isDefault: z.boolean(),
});

/** The full list sent on a client save (may be empty for a brand-new client). */
export const clientRatesSchema = z.array(clientRateSchema).max(100, "יותר מדי תעריפים");

/**
 * One item appended to a client from a time entry's "save to client" action
 * (POST /api/clients/[id]/rates). kind is forced to 'item' server-side.
 */
export const addClientItemSchema = z.object({
  name: z.string({ message: "נא להזין שם פריט" }).trim().min(1, "נא להזין שם פריט").max(100, "שם הפריט ארוך מדי"),
  rate: z.number({ message: "נא להזין מחיר ליחידה" }).min(0, "המחיר לא יכול להיות שלילי"),
});

/**
 * Pick the hourly rate to preselect: the one flagged default, else the first
 * hourly rate, else null (client has no hourly rates -> fall back to default_rate).
 */
export function pickDefaultHourlyRate(rates: ClientRate[]): ClientRate | null {
  const hourly = rates.filter((r) => r.kind === "hourly");
  return hourly.find((r) => r.isDefault) ?? hourly[0] ?? null;
}
