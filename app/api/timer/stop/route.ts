import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getUser } from "@/lib/auth";

/**
 * POST /api/timer/stop
 * Stops a running timer by setting end_time and calculating duration
 */
export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ success: false, message: "לא מחובר" }, { status: 401 });
    }

    const userId = user.id;

    // Parse request body
    const body = await request.json();
    const { entryId, description, duration: customDuration } = body;

    // Get the running entry
    const entryResult = await query<{
      id: string;
      start_time: string;
      description: string;
      total_paused_time: number;
      paused_at: string | null;
    }>(
      `SELECT id, start_time, description, total_paused_time, paused_at
       FROM time_entries
       WHERE id = $1 AND user_id = $2 AND start_time IS NOT NULL AND end_time IS NULL`,
      [entryId, userId]
    );

    if (entryResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: "הטיימר לא נמצא או כבר הופסק" },
        { status: 404 }
      );
    }

    const entry = entryResult.rows[0];
    const endTime = new Date();

    let durationMinutes: number;

    // If custom duration is provided, use it; otherwise calculate from start time
    if (customDuration !== undefined && customDuration !== null) {
      durationMinutes = customDuration;
    } else {
      const startTime = new Date(entry.start_time);
      let durationMs = endTime.getTime() - startTime.getTime();

      // Subtract total paused time if exists
      if (entry.total_paused_time) {
        durationMs -= entry.total_paused_time;
      }

      // If currently paused, subtract the current pause duration
      if (entry.paused_at) {
        const pausedAt = new Date(entry.paused_at);
        const currentPauseMs = endTime.getTime() - pausedAt.getTime();
        durationMs -= currentPauseMs;
      }

      durationMinutes = Math.floor(durationMs / 1000 / 60);
    }

    // Update the entry with end_time, duration, and optionally description
    await query(
      `UPDATE time_entries
       SET end_time = $1, duration = $2, description = COALESCE($3, description), paused_at = NULL, updated_at = NOW()
       WHERE id = $4`,
      [endTime.toISOString(), durationMinutes, description || null, entryId]
    );

    return NextResponse.json({
      success: true,
      entry: {
        id: entryId,
        duration: durationMinutes,
        endTime: endTime.toISOString()
      }
    });
  } catch (error) {
    console.error("Error stopping timer:", error);
    return NextResponse.json(
      { success: false, message: "שגיאה בעצירת הטיימר" },
      { status: 500 }
    );
  }
}
