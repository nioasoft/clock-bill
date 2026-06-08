/**
 * Subscription tiers and the active-client cap per tier.
 * Single source of truth — imported by server gates and (future) Polar webhook.
 * Pure module: no DB, no I/O. See lib/entitlements.ts for the DB-backed reads.
 */

export const PLAN_TIERS = ["free", "starter", "unlimited"] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];

/** Max active (is_active = TRUE) clients per tier. Infinity = unlimited. */
export const CLIENT_LIMITS: Record<PlanTier, number> = {
  free: 1,
  starter: 5,
  unlimited: Infinity,
};

export function getClientLimit(tier: PlanTier): number {
  return CLIENT_LIMITS[tier] ?? CLIENT_LIMITS.free;
}

/** Can a user on `tier` with `activeCount` active clients add one more? */
export function canAddClient(tier: PlanTier, activeCount: number): boolean {
  return activeCount < getClientLimit(tier);
}

export function isPlanTier(value: string): value is PlanTier {
  return (PLAN_TIERS as readonly string[]).includes(value);
}
