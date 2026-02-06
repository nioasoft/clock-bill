import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";

/**
 * GET /api/projects/[id]/stats
 * Get statistics for a specific project
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, message: "לא מחובר" },
        { status: 401 }
      );
    }

    const { query } = await import("@/lib/db");
    const { id: projectId } = await params;

    // Verify project exists and belongs to user
    const projectCheck = await query<{ exists: boolean }>(
      `SELECT EXISTS(SELECT 1 FROM projects WHERE id = $1 AND user_id = $2) as exists`,
      [projectId, user.id]
    );

    if (!projectCheck.rows[0].exists) {
      return NextResponse.json(
        { success: false, message: "הפרויקט לא נמצא" },
        { status: 404 }
      );
    }

    // Get total duration (in minutes) for all time entries in this project
    const durationResult = await query<{ total_minutes: number | null }>(
      `SELECT COALESCE(SUM(duration), 0) as total_minutes
       FROM time_entries
       WHERE project_id = $1 AND user_id = $2`,
      [projectId, user.id]
    );

    const totalMinutes = durationResult.rows[0].total_minutes || 0;
    const totalHours = totalMinutes / 60; // Convert to hours

    // Get entry count
    const countResult = await query<{ count: number }>(
      `SELECT COUNT(*) as count
       FROM time_entries
       WHERE project_id = $1 AND user_id = $2`,
      [projectId, user.id]
    );

    const entryCount = countResult.rows[0].count;

    return NextResponse.json({
      success: true,
      stats: {
        totalMinutes,
        totalHours,
        entryCount,
      },
    });
  } catch (error) {
    console.error("Error fetching project stats:", error);
    return NextResponse.json(
      { success: false, message: "שגיאה בטעינת נתוני הפרויקט" },
      { status: 500 }
    );
  }
}
