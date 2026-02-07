import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getUser } from "@/lib/auth";

/**
 * GET /api/dashboard/stats
 * Returns dashboard statistics for the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ success: false, message: "לא מחובר" }, { status: 401 });
    }

    const userId = user.id;

    // Get current date info
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
    const startOfWeekStr = startOfWeek.toISOString().split('T')[0];
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfMonthStr = startOfMonth.toISOString().split('T')[0];

    // Get upcoming deadlines date range
    const thirtyDaysFromNow = new Date(now);
    thirtyDaysFromNow.setDate(now.getDate() + 30);
    const thirtyDaysStr = thirtyDaysFromNow.toISOString().split('T')[0];

    // Run all independent queries in parallel
    const [
      todayResult,
      weekResult,
      monthResult,
      clientsResult,
      projectsResult,
      currencyResult,
      earningsResult,
      recentEntriesResult,
      upcomingDeadlinesResult,
    ] = await Promise.all([
      query<{ total: string }>(
        `SELECT COALESCE(SUM(duration), 0) as total
         FROM time_entries
         WHERE user_id = $1 AND date = $2`,
        [userId, today]
      ),
      query<{ total: string }>(
        `SELECT COALESCE(SUM(duration), 0) as total
         FROM time_entries
         WHERE user_id = $1 AND date >= $2`,
        [userId, startOfWeekStr]
      ),
      query<{ total: string }>(
        `SELECT COALESCE(SUM(duration), 0) as total
         FROM time_entries
         WHERE user_id = $1 AND date >= $2`,
        [userId, startOfMonthStr]
      ),
      query<{ count: string }>(
        `SELECT COUNT(*) as count
         FROM clients
         WHERE user_id = $1 AND is_active = TRUE`,
        [userId]
      ),
      query<{ count: string }>(
        `SELECT COUNT(*) as count
         FROM projects
         WHERE user_id = $1 AND status = 'active'`,
        [userId]
      ),
      query<{ default_currency: string }>(
        `SELECT default_currency FROM user_profiles WHERE user_id = $1`,
        [userId]
      ),
      query<{ total: string }>(
        `SELECT COALESCE(SUM(
             (te.duration / 60.0) * COALESCE(p.hourly_rate, 0)
           ), 0) as total
         FROM time_entries te
         JOIN projects p ON te.project_id = p.id
         WHERE te.user_id = $1
           AND te.date >= $2
           AND te.is_billable = TRUE`,
        [userId, startOfMonthStr]
      ),
      query<{
        id: string;
        description: string;
        date: string;
        duration: number;
        project_id: string;
      }>(
        `SELECT id, description, date, duration, project_id
         FROM time_entries
         WHERE user_id = $1
         ORDER BY date DESC, created_at DESC
         LIMIT 5`,
        [userId]
      ),
      query<{
        id: string;
        name: string;
        end_date: string;
        client_id: string;
        client_name: string;
        status: string;
      }>(
        `SELECT p.id, p.name, p.end_date, p.client_id, c.name as client_name, p.status
         FROM projects p
         JOIN clients c ON p.client_id = c.id
         WHERE p.user_id = $1
           AND p.end_date IS NOT NULL
           AND p.end_date >= $2
           AND p.end_date <= $3
           AND p.status != 'completed'
         ORDER BY p.end_date ASC
         LIMIT 10`,
        [userId, today, thirtyDaysStr]
      ),
    ]);

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

    // Format duration as hours (convert from minutes)
    const formatHours = (minutes: number) => {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `${hours}:${mins.toString().padStart(2, '0')}`;
    };

    // Add cache headers for better performance
    // Cache for 30 seconds since this is real-time data that changes frequently
    return NextResponse.json({
      success: true,
      stats: {
        today: {
          hours: parseFloat(todayResult.rows[0]?.total || '0') / 60,
          formatted: formatHours(parseFloat(todayResult.rows[0]?.total || '0'))
        },
        week: {
          hours: parseFloat(weekResult.rows[0]?.total || '0') / 60,
          formatted: formatHours(parseFloat(weekResult.rows[0]?.total || '0'))
        },
        month: {
          hours: parseFloat(monthResult.rows[0]?.total || '0') / 60,
          formatted: formatHours(parseFloat(monthResult.rows[0]?.total || '0'))
        },
        clientsCount: parseInt(clientsResult.rows[0]?.count || '0'),
        projectsCount: parseInt(projectsResult.rows[0]?.count || '0'),
        earnings: {
          amount: parseFloat(earningsResult.rows[0]?.total || '0'),
          formatted: `${getCurrencySymbol(userCurrency)}${parseFloat(earningsResult.rows[0]?.total || '0').toFixed(2)}`,
          currency: userCurrency
        }
      },
      recentEntries: recentEntriesResult.rows.map(entry => ({
        id: entry.id,
        description: entry.description,
        date: entry.date,
        duration: entry.duration,
        formattedDuration: formatHours(entry.duration),
        projectId: entry.project_id
      })),
      upcomingDeadlines: upcomingDeadlinesResult.rows.map(project => ({
        id: project.id,
        name: project.name,
        endDate: project.end_date,
        clientId: project.client_id,
        clientName: project.client_name,
        status: project.status,
        daysUntilDeadline: Math.ceil((new Date(project.end_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      }))
    }, {
      headers: {
        'Cache-Control': 'private, max-age=30, stale-while-revalidate=60'
      }
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return NextResponse.json(
      { success: false, message: "שגיאה בטעינת הנתונים" },
      { status: 500 }
    );
  }
}
