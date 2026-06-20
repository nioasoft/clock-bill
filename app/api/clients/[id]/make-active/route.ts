import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { createLogger } from "@/lib/logger";

const logger = createLogger("clients:make-active");

/**
 * POST /api/clients/[id]/make-active
 * Bumps the client's plan_priority_at to NOW() so it becomes the kept-active
 * client under the plan cap (and the previously-active one locks). Free action,
 * allowed even while the client is plan-locked.
 */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ success: false, error_code: "UNAUTHORIZED", message: "לא מחובר" }, { status: 401 });
    }
    const { id } = await context.params;
    const { query } = await import("@/lib/db");
    const result = await query(
      `UPDATE clients SET plan_priority_at = NOW() WHERE id = $1 AND user_id = $2`,
      [id, user.id]
    );
    if (result.rowCount === 0) {
      return NextResponse.json({ success: false, error_code: "NOT_FOUND", message: "לקוח לא נמצא" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("make-active failed", error);
    return NextResponse.json({ success: false, error_code: "SERVER_ERROR", message: "שגיאת שרת" }, { status: 500 });
  }
}
