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
 * Pick the hourly rate to preselect: the one flagged default, else the first
 * hourly rate, else null (client has no hourly rates -> fall back to default_rate).
 */
export function pickDefaultHourlyRate(rates: ClientRate[]): ClientRate | null {
  const hourly = rates.filter((r) => r.kind === "hourly");
  return hourly.find((r) => r.isDefault) ?? hourly[0] ?? null;
}
