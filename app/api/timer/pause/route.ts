import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getUser } from "@/lib/auth";

/**
 * POST /api/timer/pause
 * Pauses a running timer by setting paused_at timestamp
 */
export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const userId = user.id;

    // Get the running timer entry
    const entryResult = await query<{
      id: string;
      paused_at: string | null;
    }>(
      `SELECT id, paused_at
       FROM time_entries
       WHERE user_id = $1 AND start_time IS NOT NULL AND end_time IS NULL
       ORDER BY start_time DESC
       LIMIT 1`,
      [userId]
    );

    if (entryResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: "אין טיימר פעיל" },
        { status: 404 }
      );
    }

    const entry = entryResult.rows[0];

    // Check if already paused
    if (entry.paused_at) {
      return NextResponse.json(
        { success: false, message: "הטיימר כבר מושהה" },
        { status: 400 }
      );
    }

    // Set paused_at to current time
    await query(
      `UPDATE time_entries
       SET paused_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [entry.id]
    );

    return NextResponse.json({
      success: true,
      entry: {
        id: entry.id,
        pausedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error("Error pausing timer:", error);
    return NextResponse.json(
      { success: false, message: "שגיאה בהשהיית הטיימר" },
      { status: 500 }
    );
  }
}
