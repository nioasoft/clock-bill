import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getUser } from "@/lib/auth";

/**
 * GET /api/timer/running
 * Returns the currently running timer entry (if any)
 */
export async function GET(_request: NextRequest) {
  try {
    // Get authenticated user
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ success: false, error_code: "UNAUTHORIZED", message: "לא מחובר" }, { status: 401 });
    }

    const userId = user.id;

    // Get ALL running timer entries (multiple concurrent timers are allowed).
    const result = await query<{
      id: string;
      project_id: string;
      task_id: string | null;
      description: string;
      notes: string | null;
      start_time: string;
      paused_at: string | null;
      total_paused_time: number;
    }>(
      `SELECT id, project_id, task_id, description, notes, start_time, paused_at, total_paused_time
       FROM time_entries
       WHERE user_id = $1 AND start_time IS NOT NULL AND end_time IS NULL
       ORDER BY start_time DESC`,
      [userId]
    );

    const now = new Date();
    const timers = result.rows.map((entry) => {
      let elapsedMs = now.getTime() - new Date(entry.start_time).getTime();
      // Subtract accumulated paused time, plus the current open pause (if any).
      if (entry.total_paused_time) {
        elapsedMs -= entry.total_paused_time;
      }
      if (entry.paused_at) {
        elapsedMs -= now.getTime() - new Date(entry.paused_at).getTime();
      }
      if (elapsedMs < 0) elapsedMs = 0;

      return {
        id: entry.id,
        projectId: entry.project_id,
        taskId: entry.task_id,
        description: entry.description,
        notes: entry.notes,
        startTime: entry.start_time,
        pausedAt: entry.paused_at,
        elapsedMinutes: Math.floor(elapsedMs / 1000 / 60),
        elapsedSeconds: Math.floor((elapsedMs / 1000) % 60),
      };
    });

    return NextResponse.json(
      { success: true, timers },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error("Error fetching running timer:", error);
    return NextResponse.json(
      { success: false, error_code: "SERVER_ERROR", message: "שגיאה בטעינת הטיימר" },
      { status: 500 }
    );
  }
}
