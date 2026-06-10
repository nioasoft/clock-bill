import { z } from "zod";

export type RateKind = "hourly" | "item";
export type BillingKind = "hourly" | "item";

export interface ClientRateInput {
  kind: RateKind;
  name: string;
  rate: number;
  isDefault: boolean;
  /** Per-unit noun for an item rate ("פגישה"/"מילה"). Hourly rows leave it unset. */
  unit?: string | null;
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
  unit: z.string().trim().max(30, "שם היחידה ארוך מדי").nullish(),
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
  unit: z.string().trim().max(30, "שם היחידה ארוך מדי").nullish(),
});

/**
 * Pick the hourly rate to preselect: the one flagged default, else the first
 * hourly rate, else null (client has no hourly rates -> fall back to default_rate).
 */
export function pickDefaultHourlyRate(rates: ClientRate[]): ClientRate | null {
  const hourly = rates.filter((r) => r.kind === "hourly");
  return hourly.find((r) => r.isDefault) ?? hourly[0] ?? null;
}

/**
 * Normalize a rates array before saving: drop rows with an empty name, trim
 * names, allow only hourly rows to be default, and guarantee exactly one
 * default hourly (promote the first hourly if none is flagged). Returns a new
 * array — the input is never mutated.
 */
export function cleanClientRates(rates: ClientRateInput[]): ClientRateInput[] {
  const base = rates
    .filter((r) => r.name.trim() !== "")
    .map((r) => ({
      kind: r.kind,
      name: r.name.trim(),
      rate: r.rate,
      isDefault: r.kind === "hourly" && r.isDefault,
      unit: r.kind === "item" ? r.unit?.trim() || null : null,
    }));
  const hasDefault = base.some((r) => r.kind === "hourly" && r.isDefault);
  let promoted = false;
  return base.map((r) => {
    if (!hasDefault && !promoted && r.kind === "hourly") {
      promoted = true;
      return { ...r, isDefault: true };
    }
    return r;
  });
}
