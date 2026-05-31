import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getUser } from "@/lib/auth";

/**
 * GET /api/dashboard/project-hours
 * Returns hours breakdown by project for the current month
 */
export async function GET(_request: NextRequest) {
  try {
    // Get authenticated user
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ success: false, message: "לא מחובר" }, { status: 401 });
    }

    const userId = user.id;

    // Get start of current month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfMonthStr = startOfMonth.toISOString().split('T')[0];

    // Get hours by project for current month
    const projectHoursResult = await query<{
      project_id: string;
      project_name: string;
      total_minutes: string;
    }>(
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
    );

    // Format the data
    const projectHours = projectHoursResult.rows.map(row => {
      const minutes = parseFloat(row.total_minutes || '0');
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;

      return {
        projectId: row.project_id,
        projectName: row.project_name,
        totalMinutes: minutes,
        totalHours: minutes / 60,
        formatted: `${hours}:${mins.toString().padStart(2, '0')}`
      };
    });

    return NextResponse.json({
      success: true,
      projectHours
    }, {
      headers: {
        'Cache-Control': 'private, max-age=60, stale-while-revalidate=120'
      }
    });
  } catch (error) {
    console.error("Error fetching project hours data:", error);
    return NextResponse.json(
      { success: false, message: "שגיאה בטעינת נתוני השעות" },
      { status: 500 }
    );
  }
}
