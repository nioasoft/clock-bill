import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { calculateFixedMonthlyCharges, type FixedChargeProject } from "@/lib/fixed-charges";
import { resolveRounding } from "@/lib/rounding";

/**
 * GET /api/charge-documents/billable?clientId=&periodMonth=YYYY-MM
 * Returns the client's unbilled, billable time entries plus the computed
 * fixed-monthly/retainer charge for the chosen month, each flagged if that
 * month is already covered by a non-canceled document (soft warning).
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ success: false, message: "לא מחובר" }, { status: 401 });
    }
    const { query } = await import("@/lib/db");
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId");
    const periodMonth = searchParams.get("periodMonth"); // YYYY-MM

    if (!clientId) {
      return NextResponse.json({ success: false, message: "נא לבחור לקוח" }, { status: 400 });
    }

    const entriesRaw = await query<{
      id: string; description: string; notes: string | null; date: string;
      billing_kind: string | null; duration: number; quantity: number | null;
      rate: number | null; rate_label: string | null; item_ref: number | null;
      project_name: string; currency: string;
      project_rounding: string | null; client_rounding: string | null;
    }>(
      `SELECT te.id, te.description, te.notes, te.date, te.billing_kind, te.duration,
              te.quantity, te.rate, te.rate_label, te.item_ref,
              p.name AS project_name, c.currency,
              p.billing_rounding AS project_rounding, c.billing_rounding AS client_rounding
         FROM time_entries te
         JOIN projects p ON te.project_id = p.id
         JOIN clients  c ON p.client_id = c.id
        WHERE te.user_id = $1
          AND c.id = $2
          AND te.charge_document_id IS NULL
          AND te.is_billable = true
        ORDER BY te.date DESC, te.created_at DESC`,
      [user.id, clientId]
    );
    // Expose the resolved hourly rounding mode per entry so the client preview
    // bills the same minutes the server will when the document is issued.
    const entries = {
      rows: entriesRaw.rows.map(({ project_rounding, client_rounding, ...e }) => ({
        ...e,
        billing_rounding: resolveRounding(project_rounding, client_rounding),
      })),
    };

    let computedLines: Array<{ sourceType: string; periodMonth: string; label: string; amount: number; currency: string; alreadyBilled: boolean }> = [];
    if (periodMonth && /^\d{4}-\d{2}$/.test(periodMonth)) {
      const [my, mm] = periodMonth.split("-").map(Number);
      const lastDay = new Date(my, mm, 0).getDate(); // mm is 1-based; day 0 of month mm = last day of the target month
      const monthStart = `${periodMonth}-01`;
      const monthEnd = `${periodMonth}-${String(lastDay).padStart(2, "0")}`;
      const projects = await query<FixedChargeProject & Record<string, unknown>>(
        `SELECT p.id AS "projectId", p.name AS "projectName", c.id AS "clientId",
                c.name AS "clientName", c.currency AS currency,
                p.fixed_monthly_fee AS "fixedMonthlyFee",
                p.fixed_monthly_start_date AS "fixedMonthlyStartDate",
                p.fixed_monthly_end_date AS "fixedMonthlyEndDate"
           FROM projects p
           JOIN clients c ON p.client_id = c.id
          WHERE p.user_id = $1 AND c.id = $2 AND p.fixed_monthly_enabled = true`,
        [user.id, clientId]
      );
      const lines = calculateFixedMonthlyCharges(projects.rows, monthStart, monthEnd);

      const billed = await query<{ period_month: string }>(
        `SELECT DISTINCT l.period_month
           FROM charge_document_lines l
           JOIN charge_documents d ON l.document_id = d.id
          WHERE l.user_id = $1 AND d.client_id = $2 AND d.status <> 'canceled'
            AND l.period_month IS NOT NULL`,
        [user.id, clientId]
      );
      const billedSet = new Set(billed.rows.map((r) => r.period_month));
      computedLines = lines.map((l) => ({
        sourceType: "fixed_monthly",
        periodMonth: l.month,
        label: `${l.projectName} — חיוב חודשי ${l.month}`,
        amount: l.amount,
        currency: l.currency,
        alreadyBilled: billedSet.has(l.month),
      }));
    }

    return NextResponse.json({ success: true, data: { entries: entries.rows, computedLines } });
  } catch (error) {
    console.error("GET /api/charge-documents/billable failed:", error);
    return NextResponse.json({ success: false, message: "שגיאה בטעינת פריטים לחיוב" }, { status: 500 });
  }
}
