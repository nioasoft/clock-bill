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

/** Length of the free Unlimited trial for new accounts, in days. */
export const TRIAL_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Trial end = start + TRIAL_DAYS (returns a new Date; does not mutate). */
export function computeTrialEnd(start: Date): Date {
  return new Date(start.getTime() + TRIAL_DAYS * DAY_MS);
}

/** True while the trial is still running (end in the future). */
export function isTrialActive(endsAt: Date | null, now: Date): boolean {
  return endsAt !== null && now.getTime() < endsAt.getTime();
}

/** Whole days remaining, ceil'd, never below 0. */
export function trialDaysLeft(endsAt: Date, now: Date): number {
  return Math.max(0, Math.ceil((endsAt.getTime() - now.getTime()) / DAY_MS));
}
