import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getUser } from "@/lib/auth";

/**
 * GET /api/timer/running
 * Returns the currently running timer entry (if any)
 */
export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const userId = user.id;

    // Get running timer entry
    const result = await query<{
      id: string;
      project_id: string;
      description: string;
      start_time: string;
    }>(
      `SELECT id, project_id, description, start_time
       FROM time_entries
       WHERE user_id = $1 AND start_time IS NOT NULL AND end_time IS NULL
       ORDER BY start_time DESC
       LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: true,
        running: null
      });
    }

    const entry = result.rows[0];
    const startTime = new Date(entry.start_time);
    const now = new Date();
    const elapsedMs = now.getTime() - startTime.getTime();
    const elapsedMinutes = Math.floor(elapsedMs / 1000 / 60);

    return NextResponse.json({
      success: true,
      running: {
        id: entry.id,
        projectId: entry.project_id,
        description: entry.description,
        startTime: entry.start_time,
        elapsedMinutes,
        elapsedSeconds: Math.floor((elapsedMs / 1000) % 60)
      }
    });
  } catch (error) {
    console.error("Error fetching running timer:", error);
    return NextResponse.json(
      { success: false, message: "שגיאה בטעינת הטיימר" },
      { status: 500 }
    );
  }
}
