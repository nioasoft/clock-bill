/**
 * Polar SDK client + pure product→tier mapping. The client talks to the Polar
 * API (test mode runs on the production host; "test mode" is an org state). The
 * tier map is env-configured so product ids are never hardcoded.
 */
import { Polar } from "@polar-sh/sdk";
import type { PlanTier } from "@/lib/plans";

/** True when a Polar token is configured (gate the plugin like emailEnabled). */
export const polarEnabled = Boolean(process.env.POLAR_API_KEY);

let _client: Polar | null = null;
/** Lazy singleton Polar client. Throws if called without POLAR_API_KEY. */
export function getPolar(): Polar {
  if (!_client) {
    const accessToken = process.env.POLAR_API_KEY;
    if (!accessToken) throw new Error("POLAR_API_KEY is not configured");
    const server = process.env.POLAR_SERVER === "sandbox" ? "sandbox" : "production";
    _client = new Polar({ accessToken, server });
  }
  return _client;
}

/** Build the productId→tier map from env (the 4 configured products). */
export function getProductTierMap(): Record<string, PlanTier> {
  const map: Record<string, PlanTier> = {};
  const add = (id: string | undefined, tier: PlanTier) => { if (id) map[id] = tier; };
  add(process.env.POLAR_PRODUCT_STARTER_MONTHLY, "starter");
  add(process.env.POLAR_PRODUCT_STARTER_ANNUAL, "starter");
  add(process.env.POLAR_PRODUCT_UNLIMITED_MONTHLY, "unlimited");
  add(process.env.POLAR_PRODUCT_UNLIMITED_ANNUAL, "unlimited");
  return map;
}

/** Pure: resolve a tier from a product id given a map. Unknown/null → null. */
export function tierForProductId(
  productId: string | null | undefined,
  map: Record<string, PlanTier>
): PlanTier | null {
  if (!productId) return null;
  return map[productId] ?? null;
}
