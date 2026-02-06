import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getUser } from "@/lib/auth";

/**
 * POST /api/timer/resume
 * Resumes a paused timer by calculating paused time and clearing paused_at
 */
export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const userId = user.id;

    // Get the paused timer entry
    const entryResult = await query<{
      id: string;
      paused_at: string;
      total_paused_time: number;
    }>(
      `SELECT id, paused_at, total_paused_time
       FROM time_entries
       WHERE user_id = $1 AND start_time IS NOT NULL AND end_time IS NULL AND paused_at IS NOT NULL
       ORDER BY start_time DESC
       LIMIT 1`,
      [userId]
    );

    if (entryResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: "אין טיימר מושהה" },
        { status: 404 }
      );
    }

    const entry = entryResult.rows[0];
    const pausedAt = new Date(entry.paused_at);
    const now = new Date();

    // Calculate how long it was paused (in milliseconds)
    const pausedDurationMs = now.getTime() - pausedAt.getTime();
    const newTotalPausedTime = (entry.total_paused_time || 0) + pausedDurationMs;

    // Clear paused_at and update total_paused_time
    await query(
      `UPDATE time_entries
       SET paused_at = NULL, total_paused_time = $1, updated_at = NOW()
       WHERE id = $2`,
      [newTotalPausedTime, entry.id]
    );

    return NextResponse.json({
      success: true,
      entry: {
        id: entry.id,
        totalPausedTime: newTotalPausedTime
      }
    });
  } catch (error) {
    console.error("Error resuming timer:", error);
    return NextResponse.json(
      { success: false, message: "שגיאה בחידוש הטיימר" },
      { status: 500 }
    );
  }
}
