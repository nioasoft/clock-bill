import { createLogger } from "@/lib/logger";
const logger = createLogger("api:charge-documents:id:approve");
import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST — mark the document approved by the owner ("the client approved").
 * Approval is an orthogonal lock (approved_at/approved_by), not a status value:
 * the payment-derived status keeps recomputing underneath it. Idempotent.
 */
export async function POST(_request: NextRequest, ctx: Ctx) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ success: false, error_code: "UNAUTHORIZED", message: "לא מחובר" }, { status: 401 });
    const { id } = await ctx.params;
    const { query, adminQuery } = await import("@/lib/db");

    const updated = await query(
      `UPDATE charge_documents
          SET approved_at = NOW(), approved_by = 'owner', updated_at = NOW()
        WHERE id = $1 AND user_id = $2 AND approved_at IS NULL AND status IN ('pending', 'partial')
        RETURNING doc_number, approved_at, approved_by`,
      [id, user.id]
    );

    if (updated.rowCount === 0) {
      const existing = await query(
        `SELECT status, approved_at, approved_by FROM charge_documents WHERE id = $1 AND user_id = $2`,
        [id, user.id]
      );
      if (existing.rowCount === 0) {
        return NextResponse.json({ success: false, error_code: "DOCUMENT_NOT_FOUND", message: "תעודה לא נמצאה" }, { status: 404 });
      }
      if (existing.rows[0].approved_at) {
        // Already approved (double-click / client approved concurrently) — success no-op.
        return NextResponse.json({
          success: true,
          data: { approvedAt: existing.rows[0].approved_at, approvedBy: existing.rows[0].approved_by, alreadyApproved: true },
        });
      }
      return NextResponse.json({ success: false, error_code: "APPROVE_REQUIRES_ACTIVE", message: "ניתן לאשר רק תעודה פעילה שטרם שולמה" }, { status: 409 });
    }

    await adminQuery(
      `INSERT INTO audit_events (id, actor_id, action, target_type, target_id, metadata)
       VALUES (gen_random_uuid()::text, $1, 'charge_document.approved', 'charge_document', $2, $3)`,
      [user.id, id, JSON.stringify({ docNumber: updated.rows[0].doc_number, by: "owner" })]
    );

    return NextResponse.json({
      success: true,
      data: { approvedAt: updated.rows[0].approved_at, approvedBy: updated.rows[0].approved_by },
    });
  } catch (error) {
    logger.error("POST approve failed:", error);
    return NextResponse.json({ success: false, error_code: "SERVER_ERROR", message: "שגיאה באישור התעודה" }, { status: 500 });
  }
}

/**
 * DELETE — remove approval (reopen for editing). Blocked once the document is
 * paid or canceled: "approved then paid" is a historical record.
 */
export async function DELETE(_request: NextRequest, ctx: Ctx) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ success: false, error_code: "UNAUTHORIZED", message: "לא מחובר" }, { status: 401 });
    const { id } = await ctx.params;
    const { query, adminQuery } = await import("@/lib/db");

    const updated = await query(
      `UPDATE charge_documents
          SET approved_at = NULL, approved_by = NULL, updated_at = NOW()
        WHERE id = $1 AND user_id = $2 AND approved_at IS NOT NULL AND status IN ('pending', 'partial')
        RETURNING doc_number`,
      [id, user.id]
    );

    if (updated.rowCount === 0) {
      const existing = await query(
        `SELECT status, approved_at FROM charge_documents WHERE id = $1 AND user_id = $2`,
        [id, user.id]
      );
      if (existing.rowCount === 0) {
        return NextResponse.json({ success: false, error_code: "DOCUMENT_NOT_FOUND", message: "תעודה לא נמצאה" }, { status: 404 });
      }
      if (!existing.rows[0].approved_at) {
        // Not approved — removing approval is a no-op.
        return NextResponse.json({ success: true, data: { alreadyUnapproved: true } });
      }
      return NextResponse.json({ success: false, error_code: "UNAPPROVE_REQUIRES_UNPAID", message: "לא ניתן לבטל אישור בתעודה ששולמה או בוטלה" }, { status: 409 });
    }

    await adminQuery(
      `INSERT INTO audit_events (id, actor_id, action, target_type, target_id, metadata)
       VALUES (gen_random_uuid()::text, $1, 'charge_document.approval_removed', 'charge_document', $2, $3)`,
      [user.id, id, JSON.stringify({ docNumber: updated.rows[0].doc_number })]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("DELETE approve failed:", error);
    return NextResponse.json({ success: false, error_code: "SERVER_ERROR", message: "שגיאה בביטול האישור" }, { status: 500 });
  }
}
