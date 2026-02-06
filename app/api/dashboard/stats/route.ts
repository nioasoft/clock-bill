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
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
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

    // Get total hours for today
    const todayResult = await query<{ total: string }>(
      `SELECT COALESCE(SUM(duration), 0) as total
       FROM time_entries
       WHERE user_id = $1 AND date = $2`,
      [userId, today]
    );

    // Get total hours for this week
    const weekResult = await query<{ total: string }>(
      `SELECT COALESCE(SUM(duration), 0) as total
       FROM time_entries
       WHERE user_id = $1 AND date >= $2`,
      [userId, startOfWeekStr]
    );

    // Get total hours for this month
    const monthResult = await query<{ total: string }>(
      `SELECT COALESCE(SUM(duration), 0) as total
       FROM time_entries
       WHERE user_id = $1 AND date >= $2`,
      [userId, startOfMonthStr]
    );

    // Get total clients count
    const clientsResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count
       FROM clients
       WHERE user_id = $1 AND is_active = TRUE`,
      [userId]
    );

    // Get total projects count
    const projectsResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count
       FROM projects
       WHERE user_id = $1 AND status = 'active'`,
      [userId]
    );

    // Get recent time entries (last 5)
    const recentEntriesResult = await query<{
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
    );

    // Format duration as hours (convert from minutes)
    const formatHours = (minutes: number) => {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `${hours}:${mins.toString().padStart(2, '0')}`;
    };

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
        projectsCount: parseInt(projectsResult.rows[0]?.count || '0')
      },
      recentEntries: recentEntriesResult.rows.map(entry => ({
        id: entry.id,
        description: entry.description,
        date: entry.date,
        duration: entry.duration,
        formattedDuration: formatHours(entry.duration),
        projectId: entry.project_id
      }))
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return NextResponse.json(
      { success: false, message: "שגיאה בטעינת הנתונים" },
      { status: 500 }
    );
  }
}
