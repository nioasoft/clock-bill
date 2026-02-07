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
      return NextResponse.json({ success: false, message: "לא מחובר" }, { status: 401 });
    }

    const userId = user.id;

    // Get running timer entry
    const result = await query<{
      id: string;
      project_id: string;
      description: string;
      start_time: string;
      paused_at: string | null;
      total_paused_time: number;
    }>(
      `SELECT id, project_id, description, start_time, paused_at, total_paused_time
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
    let elapsedMs = now.getTime() - startTime.getTime();

    // Subtract total paused time if exists
    if (entry.total_paused_time) {
      elapsedMs -= entry.total_paused_time;
    }

    // If currently paused, subtract the current pause duration
    if (entry.paused_at) {
      const pausedAt = new Date(entry.paused_at);
      const currentPauseMs = now.getTime() - pausedAt.getTime();
      elapsedMs -= currentPauseMs;
    }

    const elapsedMinutes = Math.floor(elapsedMs / 1000 / 60);

    return NextResponse.json({
      success: true,
      running: {
        id: entry.id,
        projectId: entry.project_id,
        description: entry.description,
        startTime: entry.start_time,
        pausedAt: entry.paused_at,
        elapsedMinutes,
        elapsedSeconds: Math.floor((elapsedMs / 1000) % 60)
      }
    }, {
      headers: {
        'Cache-Control': 'no-store'
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
