import { createLogger } from "@/lib/logger";
const logger = createLogger("api:charge-documents:id:payments");
import { NextRequest, NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { getUser } from "@/lib/auth";
import { parseBody } from "@/lib/api-validation";
import { createPaymentSchema } from "@/lib/schemas/charge-documents";
import { documentMoney, outstanding, paymentStatus, type DiscountType } from "@/lib/charge-documents";
import { recomputeChargeStatus } from "@/lib/charge-documents-server";

type Ctx = { params: Promise<{ id: string }> };

/** GET — the document's payments + computed gross/paid/outstanding/status. */
export async function GET(_request: NextRequest, ctx: Ctx) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ success: false, error_code: "UNAUTHORIZED", message: "לא מחובר" }, { status: 401 });
    const { id } = await ctx.params;
    const { query } = await import("@/lib/db");

    const doc = await query(
      `SELECT total, discount_type, discount_value, vat_rate_snapshot
         FROM charge_documents WHERE id = $1 AND user_id = $2`,
      [id, user.id]
    );
    if (doc.rowCount === 0) return NextResponse.json({ success: false, error_code: "DOCUMENT_NOT_FOUND", message: "תעודה לא נמצאה" }, { status: 404 });
    const d = doc.rows[0] as { total: number | null; discount_type: DiscountType | null; discount_value: number | null; vat_rate_snapshot: number | null };

    const pays = await query(
      `SELECT id, amount, paid_at, method, note
         FROM charge_document_payments WHERE document_id = $1 AND user_id = $2
        ORDER BY paid_at, created_at`,
      [id, user.id]
    );
    const paidSum = pays.rows.reduce((s, p) => s + Number((p as { amount: number }).amount), 0);
    const { gross } = documentMoney({ total: d.total ?? 0, discountType: d.discount_type, discountValue: d.discount_value, vatRate: d.vat_rate_snapshot });

    return NextResponse.json({
      success: true,
      data: {
        payments: pays.rows,
        gross,
        paidSum,
        outstanding: outstanding(gross, paidSum),
        status: paymentStatus(gross, paidSum),
      },
    });
  } catch (error) {
    logger.error("GET payments failed:", error);
    return NextResponse.json({ success: false, error_code: "SERVER_ERROR", message: "שגיאה בטעינת תשלומים" }, { status: 500 });
  }
}

/** POST — record a payment, then recompute the document status. */
export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ success: false, error_code: "UNAUTHORIZED", message: "לא מחובר" }, { status: 401 });
    const { id } = await ctx.params;
    const parsed = await parseBody(request, createPaymentSchema);
    if (!parsed.ok) return parsed.response;
    const { amount, paidAt, method, note } = parsed.data;
    const { withTransaction } = await import("@/lib/db");

    await withTransaction(async (client: PoolClient) => {
      const doc = await client.query(
        `SELECT status FROM charge_documents WHERE id = $1 AND user_id = $2 FOR UPDATE`,
        [id, user.id]
      );
      if (doc.rowCount === 0) throw new Error("NOT_FOUND");
      if (doc.rows[0].status === "canceled") throw new Error("DOC_CANCELED");

      await client.query(
        `INSERT INTO charge_document_payments (id, user_id, document_id, amount, paid_at, method, note)
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6)`,
        [user.id, id, amount, paidAt, method ?? null, note ?? null]
      );
      await recomputeChargeStatus(client, id, user.id);
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    if (msg === "NOT_FOUND") return NextResponse.json({ success: false, error_code: "DOCUMENT_NOT_FOUND", message: "תעודה לא נמצאה" }, { status: 404 });
    if (msg === "DOC_CANCELED") return NextResponse.json({ success: false, error_code: "PAYMENT_DOC_CANCELED", message: "לא ניתן לרשום תשלום על תעודה מבוטלת" }, { status: 409 });
    logger.error("POST payment failed:", error);
    return NextResponse.json({ success: false, error_code: "SERVER_ERROR", message: "שגיאה ברישום תשלום" }, { status: 500 });
  }
}
