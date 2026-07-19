import { createLogger } from "@/lib/logger";
const logger = createLogger("api:settlements:due");
import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { hasReachedBillingDay, effectiveBillingDay } from "@/lib/settlements";
import { formatCurrency } from "@/lib/currency";

/**
 * GET /api/settlements/due
 * The caller's clients that are due for settlement: a settlement_billing_day is
 * set, today (user-local) has reached the effective billing day, and unbilled
 * billable work exists. Used by the dashboard "settlements due" section.
 */
export async function GET(_request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ success: false, error_code: "UNAUTHORIZED", message: "לא מחובר" }, { status: 401 });
    }
    const { query } = await import("@/lib/db");

    // The user's local date (their stored timezone) — used for the billing-day
    // comparison so "today" matches the user, not the server.
    const profRes = await query<{ local_year: number; local_month: number; local_day: number; locale: string | null }>(
      `SELECT EXTRACT(YEAR  FROM (now() AT TIME ZONE COALESCE(timezone,'Asia/Jerusalem')))::int AS local_year,
              EXTRACT(MONTH FROM (now() AT TIME ZONE COALESCE(timezone,'Asia/Jerusalem')))::int AS local_month,
              EXTRACT(DAY   FROM (now() AT TIME ZONE COALESCE(timezone,'Asia/Jerusalem')))::int AS local_day,
              locale
         FROM user_profiles WHERE user_id = $1`,
      [user.id]
    );
    const today = profRes.rows[0] ?? { local_year: new Date().getUTCFullYear(), local_month: new Date().getUTCMonth() + 1, local_day: new Date().getUTCDate(), locale: "he" };
    const locale = today.locale === "en" ? "en" : "he";

    // Clients with a billing day + their unbilled billable total. Scoped by user.
    const rows = await query<{
      client_id: string; client_name: string; currency: string;
      settlement_billing_day: number; unbilled_total: number;
    }>(
      `SELECT c.id AS client_id, c.name AS client_name, COALESCE(c.currency,'ILS') AS currency,
              c.settlement_billing_day,
              COALESCE(SUM(
                (CASE WHEN te.billing_kind = 'item'
                     THEN COALESCE(te.quantity, 0) * COALESCE(te.rate, 0)
                     ELSE (te.duration / 60.0) * COALESCE(te.rate, 0)
                END) * (1 - COALESCE(te.discount_percent, 0) / 100.0)
              ), 0) AS unbilled_total
         FROM clients c
         JOIN projects p ON p.client_id = c.id
         JOIN time_entries te ON te.project_id = p.id
        WHERE c.user_id = $1
          AND c.settlement_billing_day IS NOT NULL
          AND c.is_active = true
          AND te.charge_document_id IS NULL
          AND te.is_billable = true
          AND te.written_off_at IS NULL
        GROUP BY c.id, c.name, c.currency, c.settlement_billing_day`,
      [user.id]
    );
    // NOTE: time_entries has no `amount` column. This SUM is an APPROXIMATE
    // unbilled total (duration is in MINUTES → /60 = hours × rate; items =
    // quantity × rate). It equals the exact charge for the common case
    // (no billing-rounding configured); with rounding it slightly under-states.
    // The INNER JOIN guarantees each returned client has ≥1 unbilled billable
    // entry, so no HAVING is needed — the amount is display-only.

    const clients = rows.rows
      .filter((r) =>
        hasReachedBillingDay(today.local_day, r.settlement_billing_day, today.local_year, today.local_month)
      )
      .map((r) => ({
        clientId: r.client_id,
        clientName: r.client_name,
        currency: r.currency,
        unbilledTotal: r.unbilled_total,
        amountLabel: formatCurrency(r.unbilled_total, r.currency, locale),
        billingDay: r.settlement_billing_day,
        daysOverdue: Math.max(0, today.local_day - effectiveBillingDay(r.settlement_billing_day, today.local_year, today.local_month)),
      }));

    return NextResponse.json({ success: true, data: { clients } });
  } catch (error) {
    logger.error("GET /api/settlements/due failed:", error);
    return NextResponse.json({ success: false, error_code: "SERVER_ERROR", message: "שגיאה בטעינת התחשבנויות" }, { status: 500 });
  }
}
