import { createLogger } from "@/lib/logger";
const logger = createLogger("api:timer:pause");
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withTransaction } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { parseBody } from "@/lib/api-validation";

/** Body schema for pausing a timer. */
const pauseTimerSchema = z.object({
  entryId: z.string({ message: "חסר מזהה טיימר" }).min(1, "חסר מזהה טיימר"),
});

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
      return NextResponse.json({ success: false, error_code: "UNAUTHORIZED", message: "לא מחובר" }, { status: 401 });
    }

    const userId = user.id;

    // Which timer to pause — required now that multiple can run at once.
    const parsed = await parseBody(request, pauseTimerSchema);
    if (!parsed.ok) return parsed.response;
    const { entryId } = parsed.data;

    const result = await withTransaction(async (client) => {
      // Get and lock the specific running timer entry (scoped to the user).
      const entryResult = await client.query<{
        id: string;
        paused_at: string | null;
      }>(
        `SELECT id, paused_at
         FROM time_entries
         WHERE id = $1 AND user_id = $2 AND start_time IS NOT NULL AND end_time IS NULL
         FOR UPDATE`,
        [entryId, userId]
      );

      if (entryResult.rows.length === 0) {
        return { status: 404 as const, error_code: "TIMER_NOT_FOUND" as const, message: "הטיימר לא נמצא" };
      }

      const entry = entryResult.rows[0];

      // Check if already paused
      if (entry.paused_at) {
        return { status: 400 as const, error_code: "TIMER_ALREADY_PAUSED" as const, message: "הטיימר כבר מושהה" };
      }

      // Set paused_at to current time
      await client.query(
        `UPDATE time_entries
         SET paused_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [entry.id]
      );

      return { status: 200 as const, error_code: null, message: "", id: entry.id };
    });

    if (result.status !== 200) {
      return NextResponse.json(
        { success: false, error_code: result.error_code, message: result.message },
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
    logger.error("Error pausing timer:", error);
    return NextResponse.json(
      { success: false, error_code: "SERVER_ERROR", message: "שגיאה בהשהיית הטיימר" },
      { status: 500 }
    );
  }
}
