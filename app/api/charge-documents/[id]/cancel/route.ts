import { NextRequest, NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { getUser } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

/** POST — cancel a non-paid document and return its entries to unbilled. */
export async function POST(_request: NextRequest, ctx: Ctx) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ success: false, error_code: "UNAUTHORIZED", message: "לא מחובר" }, { status: 401 });
    const { id } = await ctx.params;
    const { withTransaction } = await import("@/lib/db");

    await withTransaction(async (client: PoolClient) => {
      const doc = await client.query(
        `SELECT status FROM charge_documents WHERE id = $1 AND user_id = $2 FOR UPDATE`,
        [id, user.id]
      );
      if (doc.rowCount === 0) throw new Error("NOT_FOUND");
      if (doc.rows[0].status !== "pending") throw new Error("BAD_STATE");

      await client.query(
        `UPDATE time_entries SET charge_document_id = NULL WHERE charge_document_id = $1 AND user_id = $2`,
        [id, user.id]
      );
      await client.query(
        `UPDATE charge_documents SET status = 'canceled', canceled_at = NOW(), updated_at = NOW()
          WHERE id = $1 AND user_id = $2`,
        [id, user.id]
      );
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    if (msg === "NOT_FOUND") return NextResponse.json({ success: false, error_code: "DOCUMENT_NOT_FOUND", message: "תעודה לא נמצאה" }, { status: 404 });
    if (msg === "BAD_STATE") return NextResponse.json({ success: false, error_code: "CANCEL_REQUIRES_PENDING", message: "ניתן לבטל רק תעודה ממתינה" }, { status: 409 });
    console.error("POST cancel failed:", error);
    return NextResponse.json({ success: false, error_code: "SERVER_ERROR", message: "שגיאה בביטול תעודה" }, { status: 500 });
  }
}
