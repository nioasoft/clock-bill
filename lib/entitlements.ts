/**
 * DB-backed entitlement reads. Resolves a user's effective plan from
 * user_profiles and counts their active clients. `founding` accounts are
 * always 'unlimited'. See lib/plans.ts for the pure caps.
 */
import { getClientLimit, isPlanTier, type PlanTier } from "@/lib/plans";

export interface UserPlan {
  tier: PlanTier;
  clientLimit: number;
  status: string | null;
  periodEnd: string | null;
  founding: boolean;
}

/** Resolve the effective plan for a user. Missing profile row => 'free'. */
export async function getUserPlan(userId: string): Promise<UserPlan> {
  const { query } = await import("@/lib/db");
  const result = await query<{
    subscription_tier: string | null;
    subscription_status: string | null;
    subscription_period_end: string | null;
    founding: boolean | null;
  }>(
    `SELECT subscription_tier, subscription_status, subscription_period_end, founding
     FROM user_profiles WHERE user_id = $1`,
    [userId]
  );
  const row = result.rows[0];
  const founding = row?.founding ?? false;
  const rawTier = row?.subscription_tier ?? "free";
  const tier: PlanTier = founding
    ? "unlimited"
    : isPlanTier(rawTier ?? "free")
      ? (rawTier as PlanTier)
      : "free";
  return {
    tier,
    clientLimit: getClientLimit(tier),
    status: row?.subscription_status ?? null,
    periodEnd: row?.subscription_period_end ?? null,
    founding,
  };
}

/** Count active (is_active = TRUE) clients for a user. */
export async function countActiveClients(userId: string): Promise<number> {
  const { query } = await import("@/lib/db");
  const result = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM clients WHERE user_id = $1 AND is_active = TRUE`,
    [userId]
  );
  return parseInt(result.rows[0]?.count ?? "0", 10);
}
