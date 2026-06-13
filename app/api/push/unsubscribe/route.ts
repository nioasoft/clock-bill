import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { createLogger } from "@/lib/logger";

const logger = createLogger("api:push:unsubscribe");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/push/unsubscribe
 * Removes the caller's push subscription for the given endpoint. RLS scopes the
 * delete to the caller, so a stray endpoint can only ever remove the user's own.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error_code: "UNAUTHORIZED", message: "לא מחובר" },
        { status: 401 }
      );
    }

    const { endpoint } = (await request.json().catch(() => ({}))) as { endpoint?: string };
    if (!endpoint) {
      return NextResponse.json(
        { success: false, error_code: "INVALID_INPUT", message: "endpoint חסר" },
        { status: 400 }
      );
    }

    await query(`DELETE FROM push_subscriptions WHERE endpoint = $1 AND user_id = $2`, [
      endpoint,
      user.id,
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Failed to remove push subscription", error);
    return NextResponse.json(
      { success: false, error_code: "SERVER_ERROR", message: "שגיאה בביטול ההרשמה להתראות" },
      { status: 500 }
    );
  }
}
