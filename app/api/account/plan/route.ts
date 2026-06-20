import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";

/** GET /api/account/plan — the authenticated user's current subscription plan. */
export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ success: false, error_code: "UNAUTHORIZED", message: "לא מחובר" }, { status: 401 });
  }
  const { getUserPlan } = await import("@/lib/entitlements");
  const plan = await getUserPlan(user.id);
  const { query } = await import("@/lib/db");
  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*)::int AS count FROM clients WHERE user_id = $1 AND is_active = TRUE`,
    [user.id]
  );
  const activeClientCount = Number(countResult.rows[0]?.count ?? 0);
  return NextResponse.json({
    success: true,
    plan: { tier: plan.tier, status: plan.status, periodEnd: plan.periodEnd, founding: plan.founding, trial: plan.trial },
    activeClientCount,
  });
}
