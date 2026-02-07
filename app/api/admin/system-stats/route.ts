/**
 * GET /api/admin/system-stats
 * Returns deep system analytics
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getAdminUser } from "@/lib/admin";

export async function GET(): Promise<NextResponse> {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json({ success: false, message: "אין הרשאה" }, { status: 403 });
    }

    const [
      topUsersResult,
      pricingModelResult,
      currencyResult,
      avgEntriesResult,
      logosResult,
    ] = await Promise.all([
      // Top 10 most active users by entry count
      query<{ user_id: string; email: string; entry_count: string }>(
        `SELECT u.id as user_id, u.email, COUNT(te.id) as entry_count
         FROM users u
         LEFT JOIN time_entries te ON u.id = te.user_id
         GROUP BY u.id, u.email
         ORDER BY entry_count DESC
         LIMIT 10`
      ),
      // Pricing model distribution
      query<{ pricing_model: string; count: string }>(
        `SELECT pricing_model, COUNT(*) as count
         FROM projects
         GROUP BY pricing_model
         ORDER BY count DESC`
      ),
      // Currency distribution
      query<{ currency: string; count: string }>(
        `SELECT currency, COUNT(*) as count
         FROM projects
         GROUP BY currency
         ORDER BY count DESC`
      ),
      // Average entries per user
      query<{ avg: string }>(
        `SELECT COALESCE(AVG(entry_count), 0) as avg
         FROM (
           SELECT COUNT(*) as entry_count
           FROM time_entries
           GROUP BY user_id
         ) sub`
      ),
      // Total logos uploaded
      query<{ count: string }>(
        "SELECT COUNT(*) as count FROM user_profiles WHERE logo_url IS NOT NULL AND logo_url != ''"
      ),
    ]);

    return NextResponse.json({
      success: true,
      stats: {
        topUsers: topUsersResult.rows.map((r) => ({
          userId: r.user_id,
          email: r.email,
          entryCount: parseInt(r.entry_count),
        })),
        pricingModels: pricingModelResult.rows.map((r) => ({
          model: r.pricing_model,
          count: parseInt(r.count),
        })),
        currencies: currencyResult.rows.map((r) => ({
          currency: r.currency,
          count: parseInt(r.count),
        })),
        avgEntriesPerUser: parseFloat(parseFloat(avgEntriesResult.rows[0]?.avg || "0").toFixed(1)),
        totalLogos: parseInt(logosResult.rows[0].count),
      },
    });
  } catch (error) {
    console.error("Admin system stats error:", error);
    return NextResponse.json({ success: false, message: "שגיאת שרת" }, { status: 500 });
  }
}
