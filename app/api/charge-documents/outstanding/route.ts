import { createLogger } from "@/lib/logger";
const logger = createLogger("api:charge-documents:outstanding");
import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { documentMoney, outstanding, type DiscountType } from "@/lib/charge-documents";
import { formatCurrency } from "@/lib/currency";

/**
 * GET /api/charge-documents/outstanding
 * Per-currency sum of outstanding amounts across the caller's non-canceled
 * documents. Powers the dashboard "open for collection" section.
 */
export async function GET(_request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ success: false, error_code: "UNAUTHORIZED", message: "לא מחובר" }, { status: 401 });
    const { query } = await import("@/lib/db");

    const prof = await query<{ locale: string | null }>(
      `SELECT locale FROM user_profiles WHERE user_id = $1`,
      [user.id]
    );
    const locale = prof.rows[0]?.locale === "en" ? "en" : "he";

    const rows = await query<{
      currency: string; total: number | null;
      discount_type: DiscountType | null; discount_value: number | null;
      vat_rate_snapshot: number | null; paid_sum: number;
    }>(
      `SELECT d.currency, d.total, d.discount_type, d.discount_value, d.vat_rate_snapshot,
              COALESCE((SELECT SUM(amount) FROM charge_document_payments p
                         WHERE p.document_id = d.id AND p.user_id = d.user_id), 0) AS paid_sum
         FROM charge_documents d
        WHERE d.user_id = $1 AND d.status <> 'canceled'`,
      [user.id]
    );

    const byCurrency = new Map<string, number>();
    for (const r of rows.rows) {
      const { gross } = documentMoney({
        total: r.total ?? 0, discountType: r.discount_type,
        discountValue: r.discount_value, vatRate: r.vat_rate_snapshot,
      });
      const open = outstanding(gross, Number(r.paid_sum));
      if (open <= 0) continue;
      const cur = r.currency || "ILS";
      byCurrency.set(cur, (byCurrency.get(cur) ?? 0) + open);
    }

    const totals = [...byCurrency.entries()].map(([currency, amount]) => ({
      currency,
      outstanding: amount,
      amountLabel: formatCurrency(amount, currency, locale),
    }));

    return NextResponse.json({ success: true, data: { totals } });
  } catch (error) {
    logger.error("GET outstanding failed:", error);
    return NextResponse.json({ success: false, error_code: "SERVER_ERROR", message: "שגיאה בטעינת פתוח לגבייה" }, { status: 500 });
  }
}
