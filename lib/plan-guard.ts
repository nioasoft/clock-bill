/**
 * Plan-lock enforcement for the client-count cap. When a user's effective tier
 * caps active clients (free=1, starter=5), clients beyond the cap are
 * "plan-locked": billable writes are rejected (402) until the user upgrades or
 * switches which client is active. Reads/deletes/archiving stay allowed.
 */
import { NextResponse } from "next/server";
import { getUserPlan } from "@/lib/entitlements";

/**
 * Given active client ids already ordered by rank DESC (most-active first) and
 * the tier's client limit, return the ids that are locked (the over-limit tail).
 * A non-finite limit (unlimited) locks nothing.
 */
export function computeLockedClientIds(rankedActiveIds: string[], clientLimit: number): string[] {
  if (!Number.isFinite(clientLimit)) return [];
  return rankedActiveIds.slice(clientLimit);
}

/** The set of plan-locked client ids for a user (empty when unlimited/under cap). */
export async function getLockedClientIds(userId: string): Promise<Set<string>> {
  const plan = await getUserPlan(userId);
  if (!Number.isFinite(plan.clientLimit)) return new Set();
  const { query } = await import("@/lib/db");
  const result = await query<{ id: string }>(
    `SELECT c.id
       FROM clients c
       LEFT JOIN projects p ON p.client_id = c.id AND p.user_id = c.user_id
       LEFT JOIN time_entries te ON te.project_id = p.id AND te.user_id = c.user_id
      WHERE c.user_id = $1 AND c.is_active = TRUE
      GROUP BY c.id
      ORDER BY GREATEST(
        COALESCE(c.plan_priority_at, c.created_at),
        COALESCE(MAX(te.created_at), c.created_at)
      ) DESC`,
    [userId]
  );
  const ranked = result.rows.map((r) => r.id);
  return new Set(computeLockedClientIds(ranked, plan.clientLimit));
}

/** Standard 402 response for a blocked write to a plan-locked client. */
export function lockedClientResponse(): NextResponse {
  return NextResponse.json(
    { success: false, error_code: "CLIENT_PLAN_LOCKED", message: "הלקוח נעול. שדרג את המסלול או הפוך אותו ללקוח הפעיל." },
    { status: 402 }
  );
}
