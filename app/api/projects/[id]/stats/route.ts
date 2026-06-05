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
        { success: false, error_code: "UNAUTHORIZED", message: "לא מחובר" },
        { status: 401 }
      );
    }

    const { query } = await import("@/lib/db");
    const { id: projectId } = await params;

    // One query: ownership (project row) + aggregates over its entries. A missing
    // or non-owned project yields zero rows (→ 404); an owned project with no
    // entries yields one row with 0/0.
    const result = await query<{ total_minutes: number | null; count: string }>(
      `SELECT COALESCE(SUM(te.duration), 0) AS total_minutes, COUNT(te.id) AS count
       FROM projects p
       LEFT JOIN time_entries te ON te.project_id = p.id AND te.user_id = $2
       WHERE p.id = $1 AND p.user_id = $2
       GROUP BY p.id`,
      [projectId, user.id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error_code: "PROJECT_NOT_FOUND", message: "הפרויקט לא נמצא" },
        { status: 404 }
      );
    }

    const totalMinutes = result.rows[0].total_minutes || 0;
    const totalHours = totalMinutes / 60; // Convert to hours
    const entryCount = parseInt(result.rows[0].count, 10) || 0;

    return NextResponse.json({
      success: true,
      stats: {
        totalMinutes,
        totalHours,
        entryCount,
      },
    }, {
      headers: {
        'Cache-Control': 'private, max-age=30, stale-while-revalidate=60'
      }
    });
  } catch (error) {
    console.error("Error fetching project stats:", error);
    return NextResponse.json(
      { success: false, error_code: "SERVER_ERROR", message: "שגיאה בטעינת נתוני הפרויקט" },
      { status: 500 }
    );
  }
}
