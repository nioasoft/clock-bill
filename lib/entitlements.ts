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
export type PlanRow = {
  subscription_tier: string | null;
  subscription_status: string | null;
  subscription_period_end: string | null;
  founding: boolean | null;
  trial_ends_at: string | null;
};

/**
 * Whether a stored paid tier still grants access, given the Polar status.
 * NULL status = tier set outside the webhook (manual grant) → keep it.
 * canceled/past_due keep access until the paid period ends (grace).
 */
export function isPaidEntitled(status: string | null, periodEnd: string | null, now: Date): boolean {
  if (status === null || status === "active" || status === "trialing") return true;
  if (status === "canceled" || status === "past_due") {
    return periodEnd !== null && new Date(periodEnd).getTime() > now.getTime();
  }
  return false; // revoked, unpaid, incomplete, incomplete_expired, unknown
}

/** Pure plan resolution: founding > paid (still entitled) > active trial > free. */
export function resolvePlan(row: PlanRow | undefined, now: Date): UserPlan {
  const status = row?.subscription_status ?? null;
  const periodEnd = row?.subscription_period_end ?? null;
  const founding = row?.founding ?? false;
  const make = (tier: PlanTier, trial: UserPlan["trial"]): UserPlan => ({
    tier, clientLimit: getClientLimit(tier), status, periodEnd, founding, trial,
  });

  if (founding) return make("unlimited", null);

  const rawTier = row?.subscription_tier ?? "free";
  if ((rawTier === "starter" || rawTier === "unlimited") && isPaidEntitled(status, periodEnd, now)) {
    return make(rawTier, null);
  }

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

/** The subscription a user's profile currently tracks. */
export interface StoredSubscription {
  subscriptionId: string | null;
  status: string | null;
}

/** A Polar webhook event, reduced to what ordering needs. */
export interface SubscriptionEvent {
  kind: "active" | "updated" | "order_paid" | "revoked";
  subscriptionId: string;
  status: string;
}

/**
 * Pure ordering guard for Polar webhooks (they can arrive late / out of order):
 * - nothing stored yet → apply;
 * - event for ANOTHER subscription → apply only if it is active (a new sub
 *   supersedes; a late revoke/update of an old sub after a plan switch is noise);
 * - same subscription already revoked → ignore (Polar never re-activates a revoked sub).
 */
export function subscriptionEventDecision(
  stored: StoredSubscription,
  event: SubscriptionEvent
): "apply" | "ignore" {
  if (!stored.subscriptionId) return "apply";
  if (stored.subscriptionId !== event.subscriptionId) {
    return event.status === "active" || event.status === "trialing" ? "apply" : "ignore";
  }
  return stored.status === "revoked" ? "ignore" : "apply";
}

/** Read the subscription a user's profile currently tracks (webhook context). */
export async function getStoredSubscription(userId: string): Promise<StoredSubscription | null> {
  const { query, setUserContext } = await import("@/lib/db");
  setUserContext(userId);
  const r = await query<{ polar_subscription_id: string | null; subscription_status: string | null }>(
    `SELECT polar_subscription_id, subscription_status FROM user_profiles WHERE user_id = $1`,
    [userId]
  );
  const row = r.rows[0];
  return row ? { subscriptionId: row.polar_subscription_id, status: row.subscription_status } : null;
}
