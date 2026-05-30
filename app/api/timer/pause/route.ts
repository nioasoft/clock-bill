import { NextRequest, NextResponse } from "next/server";
import { withTransaction } from "@/lib/db";
import { getUser } from "@/lib/auth";

/**
 * POST /api/timer/pause
 * Pauses a running timer by setting paused_at timestamp.
 * Locks the row so a double-submit can't pause twice.
 */
export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ success: false, message: "לא מחובר" }, { status: 401 });
    }

    const userId = user.id;

    const result = await withTransaction(async (client) => {
      // Get and lock the running timer entry
      const entryResult = await client.query<{
        id: string;
        paused_at: string | null;
      }>(
        `SELECT id, paused_at
         FROM time_entries
         WHERE user_id = $1 AND start_time IS NOT NULL AND end_time IS NULL
         ORDER BY start_time DESC
         LIMIT 1
         FOR UPDATE`,
        [userId]
      );

      if (entryResult.rows.length === 0) {
        return { status: 404 as const, message: "אין טיימר פעיל" };
      }

      const entry = entryResult.rows[0];

      // Check if already paused
      if (entry.paused_at) {
        return { status: 400 as const, message: "הטיימר כבר מושהה" };
      }

      // Set paused_at to current time
      await client.query(
        `UPDATE time_entries
         SET paused_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [entry.id]
      );

      return { status: 200 as const, id: entry.id };
    });

    if (result.status !== 200) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: result.status }
      );
    }

    return NextResponse.json({
      success: true,
      entry: {
        id: result.id,
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
