import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { calculateFixedMonthlyCharges } from "@/lib/fixed-charges";
import { addDays, appDateBoundaries } from "@/lib/dates";

/**
 * GET /api/dashboard/stats
 * Returns dashboard statistics for the authenticated user
 */
export async function GET(_request: NextRequest) {
  try {
    // Get authenticated user
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ success: false, message: "לא מחובר" }, { status: 401 });
    }

    const userId = user.id;

    // Get current date info — all boundaries computed in the app timezone
    // (Asia/Jerusalem) so "today"/"week"/"month" match the user's calendar.
    const now = new Date();
    const {
      today,
      startOfWeek: startOfWeekStr,
      startOfMonth: startOfMonthStr,
      endOfMonth: endOfMonthStr,
    } = appDateBoundaries(now);

    // Get upcoming deadlines date range
    const thirtyDaysStr = addDays(today, 30);

    // Run all independent queries in parallel. Several have been merged to cut
    // DB round-trips (same response shape):
    //  - the three time-period sums → one FILTER aggregate (one index scan)
    //  - clients + projects counts → one row of scalar subqueries
    //  - the user's default currency rides along on the earnings query
    const [
      timeSumsResult,
      countsResult,
      earningsResult,
      recentEntriesResult,
      upcomingDeadlinesResult,
      fixedProjectsResult,
      monthlyEarningsResult,
      projectHoursResult,
    ] = await Promise.all([
      query<{ today: string; week: string; month: string }>(
        `SELECT
            COALESCE(SUM(duration) FILTER (WHERE date = $2), 0) AS today,
            COALESCE(SUM(duration) FILTER (WHERE date >= $3), 0) AS week,
            COALESCE(SUM(duration) FILTER (WHERE date >= $4), 0) AS month
         FROM time_entries
         WHERE user_id = $1 AND date >= LEAST($3::date, $4::date)`,
        [userId, today, startOfWeekStr, startOfMonthStr]
      ),
      query<{ clients: string; projects: string }>(
        `SELECT
            (SELECT COUNT(*) FROM clients  WHERE user_id = $1 AND is_active = TRUE)   AS clients,
            (SELECT COUNT(*) FROM projects WHERE user_id = $1 AND status = 'active')  AS projects`,
        [userId]
      ),
      query<{ hours_total: string; items_total: string; default_currency: string | null }>(
        // Split monthly revenue by billing kind so the dashboard can show
        // hours vs. items separately. Hourly lines use the per-entry snapshot
        // rate; rows with NULL rate fall back to the client's CURRENT default
        // hourly rate from client_rates (the single source of truth — not the
        // legacy clients.default_rate mirror), so it agrees with the records list.
        `SELECT
           COALESCE(SUM(CASE WHEN te.billing_kind = 'item' THEN 0
                ELSE (te.duration / 60.0) * COALESCE(te.rate, crd.rate, 0) END), 0) AS hours_total,
           COALESCE(SUM(CASE WHEN te.billing_kind = 'item'
                THEN COALESCE(te.quantity, 0) * COALESCE(te.rate, 0) ELSE 0 END), 0) AS items_total,
           (SELECT default_currency FROM user_profiles WHERE user_id = $1) AS default_currency
         FROM time_entries te
         JOIN projects p ON te.project_id = p.id
         LEFT JOIN LATERAL (
           SELECT cr.rate FROM client_rates cr
           WHERE cr.client_id = p.client_id AND cr.user_id = $1
             AND cr.kind = 'hourly' AND cr.is_default
           LIMIT 1
         ) crd ON TRUE
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
        billing_kind: string;
        item_amount: string;
      }>(
        // Running timers (end_time NULL) are excluded — they'd show as 0:00.
        // item_amount lets the dashboard show a price for item entries, which
        // have no duration.
        `SELECT id, description, date, duration, project_id, billing_kind,
                CASE WHEN billing_kind = 'item'
                     THEN COALESCE(quantity, 0) * COALESCE(rate, 0)
                     ELSE 0 END AS item_amount
         FROM time_entries
         WHERE user_id = $1
           AND NOT (start_time IS NOT NULL AND end_time IS NULL)
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
      // Monthly earnings for the chart (last 12 months) — folded in from the old
      // /api/dashboard/earnings-chart endpoint so the dashboard loads in one call.
      query<{ month: string; total: string }>(
        // Same billing-kind split as the headline figure so the chart agrees
        // with the "סך הכנסות" card (counts items, not just hours). Hourly NULL
        // rates fall back to the client's current default rate from client_rates.
        `SELECT
           TO_CHAR(te.date, 'YYYY-MM') as month,
           COALESCE(SUM(CASE WHEN te.billing_kind = 'item'
                THEN COALESCE(te.quantity, 0) * COALESCE(te.rate, 0)
                ELSE (te.duration / 60.0) * COALESCE(te.rate, crd.rate, 0) END), 0) as total
         FROM time_entries te
         JOIN projects p ON te.project_id = p.id
         LEFT JOIN LATERAL (
           SELECT cr.rate FROM client_rates cr
           WHERE cr.client_id = p.client_id AND cr.user_id = $1
             AND cr.kind = 'hourly' AND cr.is_default
           LIMIT 1
         ) crd ON TRUE
         WHERE te.user_id = $1
           AND te.is_billable = TRUE
           AND te.date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '11 months')
         GROUP BY TO_CHAR(te.date, 'YYYY-MM')
         ORDER BY month ASC`,
        [userId]
      ),
      // Hours by project this month (folded in from /api/dashboard/project-hours).
      query<{ project_id: string; project_name: string; total_minutes: string }>(
        `SELECT
           p.id as project_id,
           p.name as project_name,
           COALESCE(SUM(te.duration), 0) as total_minutes
         FROM projects p
         LEFT JOIN time_entries te ON te.project_id = p.id
           AND te.user_id = $1
           AND te.date >= $2
         WHERE p.user_id = $1
           AND p.status = 'active'
         GROUP BY p.id, p.name
         ORDER BY total_minutes DESC`,
        [userId, startOfMonthStr]
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

    const userCurrency = earningsResult.rows[0]?.default_currency || 'ILS';

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

    const fixedEarnings = fixedEarningsByCurrency[userCurrency] || 0;
    // Fold fixed monthly charges into the hours bucket (a retainer is
    // time-based work) so hours + items === total exactly.
    const itemsRevenue = parseFloat(earningsResult.rows[0]?.items_total || '0');
    const hoursRevenue = parseFloat(earningsResult.rows[0]?.hours_total || '0') + fixedEarnings;
    const totalEarnings = hoursRevenue + itemsRevenue;

    // Add cache headers for better performance
    // Cache for 30 seconds since this is real-time data that changes frequently
    return NextResponse.json({
      success: true,
      stats: {
        today: {
          hours: parseFloat(timeSumsResult.rows[0]?.today || '0') / 60,
          formatted: formatHours(parseFloat(timeSumsResult.rows[0]?.today || '0'))
        },
        week: {
          hours: parseFloat(timeSumsResult.rows[0]?.week || '0') / 60,
          formatted: formatHours(parseFloat(timeSumsResult.rows[0]?.week || '0'))
        },
        month: {
          hours: parseFloat(timeSumsResult.rows[0]?.month || '0') / 60,
          formatted: formatHours(parseFloat(timeSumsResult.rows[0]?.month || '0'))
        },
        clientsCount: parseInt(countsResult.rows[0]?.clients || '0'),
        projectsCount: parseInt(countsResult.rows[0]?.projects || '0'),
        earnings: {
          amount: totalEarnings,
          formatted: `${getCurrencySymbol(userCurrency)}${totalEarnings.toFixed(2)}`,
          byHours: {
            amount: hoursRevenue,
            formatted: `${getCurrencySymbol(userCurrency)}${hoursRevenue.toFixed(2)}`
          },
          byItems: {
            amount: itemsRevenue,
            formatted: `${getCurrencySymbol(userCurrency)}${itemsRevenue.toFixed(2)}`
          },
          currency: userCurrency
        }
      },
      recentEntries: recentEntriesResult.rows.map(entry => ({
        id: entry.id,
        description: entry.description,
        date: entry.date,
        duration: entry.duration,
        // Item entries have no duration — show their price instead of 0:00.
        formattedDuration: entry.billing_kind === 'item'
          ? `${getCurrencySymbol(userCurrency)}${parseFloat(entry.item_amount || '0').toFixed(2)}`
          : formatHours(entry.duration),
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
      })),
      // Chart datasets (same shapes the old earnings-chart/project-hours routes returned)
      monthlyEarnings: monthlyEarningsResult.rows.map(row => {
        const amount = parseFloat(row.total || '0');
        return {
          month: row.month,
          amount,
          formatted: `${getCurrencySymbol(userCurrency)}${amount.toFixed(0)}`
        };
      }),
      projectHours: projectHoursResult.rows.map(row => {
        const minutes = parseFloat(row.total_minutes || '0');
        return {
          projectId: row.project_id,
          projectName: row.project_name,
          totalMinutes: minutes,
          totalHours: minutes / 60,
          formatted: formatHours(minutes)
        };
      })
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
