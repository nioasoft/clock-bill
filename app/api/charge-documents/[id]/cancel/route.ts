import { createLogger } from "@/lib/logger";
const logger = createLogger("api:charge-documents:id:cancel");
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
        `SELECT status, approved_at FROM charge_documents WHERE id = $1 AND user_id = $2 FOR UPDATE`,
        [id, user.id]
      );
      if (doc.rowCount === 0) throw new Error("NOT_FOUND");
      if (doc.rows[0].status !== "pending") throw new Error("BAD_STATE");
      if (doc.rows[0].approved_at) throw new Error("APPROVED");

      const pay = await client.query(
        `SELECT 1 FROM charge_document_payments WHERE document_id = $1 AND user_id = $2 LIMIT 1`,
        [id, user.id]
      );
      if (pay.rowCount && pay.rowCount > 0) throw new Error("HAS_PAYMENTS");

      await client.query(
        `UPDATE time_entries SET charge_document_id = NULL WHERE charge_document_id = $1 AND user_id = $2`,
        [id, user.id]
      );
      // Release the entry link on this doc's lines so the freed entries can be
      // re-billed without colliding with the unique index on time_entry_id. The
      // lines keep their amounts/labels as a historical record of the canceled doc.
      await client.query(
        `UPDATE charge_document_lines SET time_entry_id = NULL WHERE document_id = $1 AND user_id = $2`,
        [id, user.id]
      );
      await client.query(
        `UPDATE charge_documents
            SET status = 'canceled', canceled_at = NOW(),
                public_token = NULL, public_token_expires_at = NULL, updated_at = NOW()
          WHERE id = $1 AND user_id = $2`,
        [id, user.id]
      );
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    if (msg === "NOT_FOUND") return NextResponse.json({ success: false, error_code: "DOCUMENT_NOT_FOUND", message: "תעודה לא נמצאה" }, { status: 404 });
    if (msg === "BAD_STATE") return NextResponse.json({ success: false, error_code: "CANCEL_REQUIRES_PENDING", message: "ניתן לבטל רק תעודה ממתינה" }, { status: 409 });
    if (msg === "HAS_PAYMENTS") return NextResponse.json({ success: false, error_code: "CANCEL_HAS_PAYMENTS", message: "לא ניתן לבטל תעודה עם תשלומים רשומים — מחק קודם את התשלומים" }, { status: 409 });
    if (msg === "APPROVED") return NextResponse.json({ success: false, error_code: "CANCEL_REQUIRES_UNAPPROVED", message: "התעודה אושרה — בטל אישור לפני ביטול התעודה" }, { status: 409 });
    logger.error("POST cancel failed:", error);
    return NextResponse.json({ success: false, error_code: "SERVER_ERROR", message: "שגיאה בביטול תעודה" }, { status: 500 });
  }
}
