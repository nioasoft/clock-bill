import { createLogger } from "@/lib/logger";
const logger = createLogger("api:charge-documents:id:payments:paymentId");
import { NextRequest, NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { getUser } from "@/lib/auth";
import { parseBody } from "@/lib/api-validation";
import { updatePaymentSchema } from "@/lib/schemas/charge-documents";
import { recomputeChargeStatus } from "@/lib/charge-documents-server";

type Ctx = { params: Promise<{ id: string; paymentId: string }> };

/** PATCH — edit a payment (ownership: payment belongs to the user's doc). */
export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ success: false, error_code: "UNAUTHORIZED", message: "לא מחובר" }, { status: 401 });
    const { id, paymentId } = await ctx.params;
    const parsed = await parseBody(request, updatePaymentSchema);
    if (!parsed.ok) return parsed.response;
    const { amount, paidAt, method, note } = parsed.data;
    const { withTransaction } = await import("@/lib/db");

    await withTransaction(async (client: PoolClient) => {
      // Lock the parent doc; verify the payment belongs to this doc + user.
      const doc = await client.query(
        `SELECT id FROM charge_documents WHERE id = $1 AND user_id = $2 FOR UPDATE`,
        [id, user.id]
      );
      if (doc.rowCount === 0) throw new Error("NOT_FOUND");
      const pay = await client.query(
        `SELECT id FROM charge_document_payments WHERE id = $1 AND document_id = $2 AND user_id = $3`,
        [paymentId, id, user.id]
      );
      if (pay.rowCount === 0) throw new Error("PAYMENT_NOT_FOUND");

      await client.query(
        `UPDATE charge_document_payments
            SET amount  = COALESCE($1, amount),
                paid_at = COALESCE($2, paid_at),
                method  = $3,
                note    = $4,
                updated_at = NOW()
          WHERE id = $5 AND document_id = $6 AND user_id = $7`,
        [
          amount ?? null,
          paidAt ?? null,
          method === undefined ? null : method,
          note === undefined ? null : note,
          paymentId, id, user.id,
        ]
      );
      await recomputeChargeStatus(client, id, user.id);
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    if (msg === "NOT_FOUND") return NextResponse.json({ success: false, error_code: "DOCUMENT_NOT_FOUND", message: "תעודה לא נמצאה" }, { status: 404 });
    if (msg === "PAYMENT_NOT_FOUND") return NextResponse.json({ success: false, error_code: "PAYMENT_NOT_FOUND", message: "תשלום לא נמצא" }, { status: 404 });
    logger.error("PATCH payment failed:", error);
    return NextResponse.json({ success: false, error_code: "SERVER_ERROR", message: "שגיאה בעדכון תשלום" }, { status: 500 });
  }
}

/** DELETE — remove a payment, then recompute status. */
export async function DELETE(_request: NextRequest, ctx: Ctx) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ success: false, error_code: "UNAUTHORIZED", message: "לא מחובר" }, { status: 401 });
    const { id, paymentId } = await ctx.params;
    const { withTransaction } = await import("@/lib/db");

    await withTransaction(async (client: PoolClient) => {
      const doc = await client.query(
        `SELECT id FROM charge_documents WHERE id = $1 AND user_id = $2 FOR UPDATE`,
        [id, user.id]
      );
      if (doc.rowCount === 0) throw new Error("NOT_FOUND");
      const del = await client.query(
        `DELETE FROM charge_document_payments WHERE id = $1 AND document_id = $2 AND user_id = $3 RETURNING id`,
        [paymentId, id, user.id]
      );
      if (del.rowCount === 0) throw new Error("PAYMENT_NOT_FOUND");
      await recomputeChargeStatus(client, id, user.id);
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    if (msg === "NOT_FOUND") return NextResponse.json({ success: false, error_code: "DOCUMENT_NOT_FOUND", message: "תעודה לא נמצאה" }, { status: 404 });
    if (msg === "PAYMENT_NOT_FOUND") return NextResponse.json({ success: false, error_code: "PAYMENT_NOT_FOUND", message: "תשלום לא נמצא" }, { status: 404 });
    logger.error("DELETE payment failed:", error);
    return NextResponse.json({ success: false, error_code: "SERVER_ERROR", message: "שגיאה במחיקת תשלום" }, { status: 500 });
  }
}
