import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getUser } from "@/lib/auth";

/**
 * GET /api/dashboard/earnings-chart
 * Returns monthly earnings data for the last 12 months
 */
export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ success: false, message: "לא מחובר" }, { status: 401 });
    }

    const userId = user.id;

    // Get user's default currency
    const currencyResult = await query<{ default_currency: string }>(
      `SELECT default_currency FROM user_profiles WHERE user_id = $1`,
      [userId]
    );
    const userCurrency = currencyResult.rows[0]?.default_currency || 'ILS';

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

    // Get earnings for the last 12 months
    const earningsResult = await query<{
      month: string;
      total: string;
    }>(
      `SELECT
         TO_CHAR(te.date, 'YYYY-MM') as month,
         COALESCE(SUM(
           (te.duration / 60.0) * COALESCE(p.hourly_rate, 0)
         ), 0) as total
       FROM time_entries te
       JOIN projects p ON te.project_id = p.id
       WHERE te.user_id = $1
         AND te.is_billable = TRUE
         AND te.date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '11 months')
       GROUP BY TO_CHAR(te.date, 'YYYY-MM')
       ORDER BY month ASC`,
      [userId]
    );

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
