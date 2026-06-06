import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

/** POST — mark a pending document paid (locks it). */
export async function POST(_request: NextRequest, ctx: Ctx) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ success: false, error_code: "UNAUTHORIZED", message: "לא מחובר" }, { status: 401 });
    const { id } = await ctx.params;
    const { query } = await import("@/lib/db");
    const r = await query(
      `UPDATE charge_documents SET status = 'paid', paid_at = NOW(), updated_at = NOW()
        WHERE id = $1 AND user_id = $2 AND status = 'pending' RETURNING id`,
      [id, user.id]
    );
    if (r.rowCount === 0) return NextResponse.json({ success: false, error_code: "PAY_REQUIRES_PENDING", message: "לא ניתן לסמן כשולם (התעודה אינה ממתינה)" }, { status: 409 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST pay failed:", error);
    return NextResponse.json({ success: false, error_code: "SERVER_ERROR", message: "שגיאה בסימון תשלום" }, { status: 500 });
  }
}
