/**
 * DB-backed entitlement reads. Resolves a user's effective plan from
 * user_profiles and counts their active clients. `founding` accounts are
 * always 'unlimited'. See lib/plans.ts for the pure caps.
 */
import {
  getClientLimit,
  isTrialActive,
  trialDaysLeft,
  type PlanTier,
} from "@/lib/plans";

export interface UserPlan {
  tier: PlanTier;
  clientLimit: number;
  status: string | null;
  periodEnd: string | null;
  founding: boolean;
  trial: { active: boolean; endsAt: string | null; daysLeft: number | null } | null;
}

/** Raw user_profiles columns needed to resolve a plan. */
export interface PlanRow {
  subscription_tier: string | null;
  subscription_status: string | null;
  subscription_period_end: string | null;
  founding: boolean | null;
  trial_ends_at: string | null;
}

/** Pure plan resolution: founding > paid > active trial > free. */
export function resolvePlan(row: PlanRow | undefined, now: Date): UserPlan {
  const status = row?.subscription_status ?? null;
  const periodEnd = row?.subscription_period_end ?? null;
  const founding = row?.founding ?? false;
  const make = (tier: PlanTier, trial: UserPlan["trial"]): UserPlan => ({
    tier, clientLimit: getClientLimit(tier), status, periodEnd, founding, trial,
  });

  if (founding) return make("unlimited", null);

  const rawTier = row?.subscription_tier ?? "free";
  if (rawTier === "starter" || rawTier === "unlimited") return make(rawTier, null);

  const endsAt = row?.trial_ends_at ? new Date(row.trial_ends_at) : null;
  if (isTrialActive(endsAt, now) && endsAt) {
    return make("unlimited", { active: true, endsAt: endsAt.toISOString(), daysLeft: trialDaysLeft(endsAt, now) });
  }
  if (endsAt) return make("free", { active: false, endsAt: endsAt.toISOString(), daysLeft: 0 });
  return make("free", null);
}

/** Resolve the effective plan for a user. Missing profile row => 'free'. */
export async function getUserPlan(userId: string): Promise<UserPlan> {
  const { query } = await import("@/lib/db");
  const result = await query<PlanRow>(
    `SELECT subscription_tier, subscription_status, subscription_period_end, founding, trial_ends_at
     FROM user_profiles WHERE user_id = $1`,
    [userId]
  );
  return resolvePlan(result.rows[0], new Date());
}

/** Subscription columns derived from a Polar webhook event. */
export interface EntitlementUpdate {
  tier: PlanTier;
  status: string | null;
  periodEnd: string | null; // ISO timestamp or null
  polarSubscriptionId: string | null;
}

/**
 * Upsert a user's subscription columns from a Polar event. Sets provider='polar'.
 * Binds the RLS tenant context first since webhooks carry no session.
 */
export async function applyPolarEntitlement(
  userId: string,
  u: EntitlementUpdate
): Promise<void> {
  const { query, setUserContext } = await import("@/lib/db");
  setUserContext(userId); // bind RLS tenant context (webhook has no session)
  await query(
    `UPDATE user_profiles
       SET subscription_tier = $2, subscription_status = $3, subscription_period_end = $4,
           polar_subscription_id = $5, billing_provider = 'polar', updated_at = NOW()
     WHERE user_id = $1`,
    [userId, u.tier, u.status, u.periodEnd, u.polarSubscriptionId]
  );
}

/** Drop a user back to free (subscription revoked/ended). */
export async function revokeEntitlement(userId: string): Promise<void> {
  const { query, setUserContext } = await import("@/lib/db");
  setUserContext(userId);
  await query(
    `UPDATE user_profiles
       SET subscription_tier = 'free', subscription_status = 'revoked', updated_at = NOW()
     WHERE user_id = $1`,
    [userId]
  );
}
