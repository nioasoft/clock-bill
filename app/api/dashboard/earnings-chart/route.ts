import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getUser } from "@/lib/auth";

/**
 * GET /api/dashboard/earnings-chart
 * Returns monthly earnings data for the last 12 months
 */
export async function GET(_request: NextRequest) {
  try {
    // Get authenticated user
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ success: false, message: "לא מחובר" }, { status: 401 });
    }

    const userId = user.id;

    // Get currency symbol
    const getCurrencySymbol = (currency: string) => {
      const symbols: Record<string, string> = {
        'ILS': '₪',
        'USD': '$',
        'USDT': '₮',
        'BTC': '₿',
        'ETH': 'Ξ'
      };
      return symbols[currency] || currency;
    };

    // Earnings for the last 12 months + the user's default currency in one query
    // (the currency rides along on each row; on an empty result there's nothing to
    // format anyway, so losing it is harmless).
    const earningsResult = await query<{
      month: string;
      total: string;
      currency: string | null;
    }>(
      `SELECT m.month, m.total,
              (SELECT default_currency FROM user_profiles WHERE user_id = $1) AS currency
       FROM (
         SELECT
           TO_CHAR(te.date, 'YYYY-MM') as month,
           COALESCE(SUM(
             (te.duration / 60.0) * COALESCE(c.default_rate, 0)
           ), 0) as total
         FROM time_entries te
         JOIN projects p ON te.project_id = p.id
         JOIN clients c ON p.client_id = c.id
         WHERE te.user_id = $1
           AND te.is_billable = TRUE
           AND te.date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '11 months')
         GROUP BY TO_CHAR(te.date, 'YYYY-MM')
       ) m
       ORDER BY m.month ASC`,
      [userId]
    );

    const userCurrency = earningsResult.rows[0]?.currency || 'ILS';

    // Format the data
    const monthlyEarnings = earningsResult.rows.map(row => {
      const amount = parseFloat(row.total || '0');
      return {
        month: row.month,
        amount: amount,
        formatted: `${getCurrencySymbol(userCurrency)}${amount.toFixed(0)}`
      };
    });

    return NextResponse.json({
      success: true,
      monthlyEarnings
    }, {
      headers: {
        'Cache-Control': 'private, max-age=60, stale-while-revalidate=120'
      }
    });
  } catch (error) {
    console.error("Error fetching earnings chart data:", error);
    return NextResponse.json(
      { success: false, message: "שגיאה בטעינת נתוני ההכנסות" },
      { status: 500 }
    );
  }
}
