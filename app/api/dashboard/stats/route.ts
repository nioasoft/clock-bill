import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { calculateFixedMonthlyCharges } from "@/lib/fixed-charges";

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
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const endOfMonthStr = endOfMonth.toISOString().split('T')[0];

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
      fixedProjectsResult,
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
             (te.duration / 60.0) * COALESCE(c.default_rate, 0)
           ), 0) as total
         FROM time_entries te
         JOIN projects p ON te.project_id = p.id
         JOIN clients c ON p.client_id = c.id
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
      query<{
        project_id: string;
        project_name: string;
        client_id: string;
        client_name: string;
        currency: string;
        fixed_monthly_fee: number;
        fixed_monthly_start_date: string | null;
        fixed_monthly_end_date: string | null;
      }>(
        `SELECT
          p.id as project_id,
          p.name as project_name,
          c.id as client_id,
          c.name as client_name,
          c.currency,
          p.fixed_monthly_fee,
          p.fixed_monthly_start_date,
          p.fixed_monthly_end_date
         FROM projects p
         JOIN clients c ON p.client_id = c.id
         WHERE p.user_id = $1
           AND p.fixed_monthly_enabled = TRUE
           AND COALESCE(p.fixed_monthly_fee, 0) > 0`,
        [userId]
      ),
    ]);

    const fixedCharges = calculateFixedMonthlyCharges(
      fixedProjectsResult.rows.map((p) => ({
        projectId: p.project_id,
        projectName: p.project_name,
        clientId: p.client_id,
        clientName: p.client_name,
        currency: p.currency || "ILS",
        fixedMonthlyFee: p.fixed_monthly_fee,
        fixedMonthlyStartDate: p.fixed_monthly_start_date,
        fixedMonthlyEndDate: p.fixed_monthly_end_date,
      })),
      startOfMonthStr,
      endOfMonthStr
    );

    const fixedEarningsByCurrency = fixedCharges.reduce((acc, line) => {
      if (!acc[line.currency]) {
        acc[line.currency] = 0;
      }
      acc[line.currency] += line.amount;
      return acc;
    }, {} as Record<string, number>);

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

    const timeEarnings = parseFloat(earningsResult.rows[0]?.total || '0');
    const fixedEarnings = fixedEarningsByCurrency[userCurrency] || 0;
    const totalEarnings = timeEarnings + fixedEarnings;

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
          amount: totalEarnings,
          formatted: `${getCurrencySymbol(userCurrency)}${totalEarnings.toFixed(2)}`,
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
