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
  return NextResponse.json({
    success: true,
    plan: {
      tier: plan.tier,
      status: plan.status,
      periodEnd: plan.periodEnd,
      founding: plan.founding,
    },
  });
}
