import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

/** POST — reopen a paid document for editing. */
export async function POST(_request: NextRequest, ctx: Ctx) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ success: false, message: "לא מחובר" }, { status: 401 });
    const { id } = await ctx.params;
    const { query } = await import("@/lib/db");
    const r = await query(
      `UPDATE charge_documents SET status = 'pending', paid_at = NULL, updated_at = NOW()
        WHERE id = $1 AND user_id = $2 AND status = 'paid' RETURNING id`,
      [id, user.id]
    );
    if (r.rowCount === 0) return NextResponse.json({ success: false, message: "לא ניתן לבטל תשלום (התעודה אינה משולמת)" }, { status: 409 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST unpay failed:", error);
    return NextResponse.json({ success: false, message: "שגיאה בביטול תשלום" }, { status: 500 });
  }
}
