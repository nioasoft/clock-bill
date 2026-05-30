/**
 * GET /api/admin/stats
 * Returns admin dashboard overview statistics
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

    const today = new Date().toISOString().split("T")[0];
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0];

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0];

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    const startOfMonthStr = startOfMonth.toISOString().split("T")[0];

    // Run all queries in parallel
    const [
      totalUsersResult,
      newTodayResult,
      totalEntriesResult,
      entriesTodayResult,
      activeTimersResult,
      newWeekResult,
      newMonthResult,
      totalProjectsResult,
      registrationTrendResult,
    ] = await Promise.all([
      query<{ count: string }>('SELECT COUNT(*) as count FROM "user"'),
      query<{ count: string }>('SELECT COUNT(*) as count FROM "user" WHERE created_at::date = $1', [today]),
      query<{ count: string }>("SELECT COUNT(*) as count FROM time_entries"),
      query<{ count: string }>("SELECT COUNT(*) as count FROM time_entries WHERE date = $1", [today]),
      query<{ count: string }>(
        "SELECT COUNT(*) as count FROM time_entries WHERE start_time IS NOT NULL AND end_time IS NULL"
      ),
      query<{ count: string }>('SELECT COUNT(*) as count FROM "user" WHERE created_at::date >= $1', [sevenDaysAgoStr]),
      query<{ count: string }>('SELECT COUNT(*) as count FROM "user" WHERE created_at::date >= $1', [startOfMonthStr]),
      query<{ count: string }>("SELECT COUNT(*) as count FROM projects"),
      query<{ day: string; count: string }>(
        `SELECT created_at::date as day, COUNT(*) as count
         FROM "user"
         WHERE created_at::date >= $1
         GROUP BY created_at::date
         ORDER BY day ASC`,
        [thirtyDaysAgoStr]
      ),
    ]);

    return NextResponse.json({
      success: true,
      stats: {
        totalUsers: parseInt(totalUsersResult.rows[0].count),
        newToday: parseInt(newTodayResult.rows[0].count),
        totalEntries: parseInt(totalEntriesResult.rows[0].count),
        entriesToday: parseInt(entriesTodayResult.rows[0].count),
        activeTimers: parseInt(activeTimersResult.rows[0].count),
        newThisWeek: parseInt(newWeekResult.rows[0].count),
        newThisMonth: parseInt(newMonthResult.rows[0].count),
        totalProjects: parseInt(totalProjectsResult.rows[0].count),
        registrationTrend: registrationTrendResult.rows.map((r) => ({
          day: r.day,
          count: parseInt(r.count),
        })),
      },
    }, {
      headers: {
        'Cache-Control': 'private, max-age=15, stale-while-revalidate=30'
      }
    });
  } catch (error) {
    console.error("Admin stats error:", error);
    return NextResponse.json({ success: false, message: "שגיאת שרת" }, { status: 500 });
  }
}
