import { createLogger } from "@/lib/logger";
const logger = createLogger("api:timer:resume");
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withTransaction } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { parseBody } from "@/lib/api-validation";

/** Body schema for resuming a timer. */
const resumeTimerSchema = z.object({
  entryId: z.string({ message: "חסר מזהה טיימר" }).min(1, "חסר מזהה טיימר"),
});

/**
 * POST /api/timer/resume
 * Resumes a paused timer by calculating paused time and clearing paused_at.
 * Locks the row so a double-submit can't accumulate paused time twice.
 */
export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ success: false, error_code: "UNAUTHORIZED", message: "לא מחובר" }, { status: 401 });
    }

    const userId = user.id;

    // Which timer to resume — required now that multiple can run at once.
    const parsed = await parseBody(request, resumeTimerSchema);
    if (!parsed.ok) return parsed.response;
    const { entryId } = parsed.data;

    const result = await withTransaction(async (client) => {
      // Get and lock the specific paused timer entry (scoped to the user).
      const entryResult = await client.query<{
        id: string;
        paused_at: string;
        total_paused_time: number;
      }>(
        `SELECT id, paused_at, total_paused_time
         FROM time_entries
         WHERE id = $1 AND user_id = $2 AND start_time IS NOT NULL AND end_time IS NULL AND paused_at IS NOT NULL
         FOR UPDATE`,
        [entryId, userId]
      );

      if (entryResult.rows.length === 0) {
        return null;
      }

      const entry = entryResult.rows[0];
      const pausedAt = new Date(entry.paused_at);
      const now = new Date();

      // Calculate how long it was paused (in milliseconds)
      const pausedDurationMs = now.getTime() - pausedAt.getTime();
      const newTotalPausedTime = (entry.total_paused_time || 0) + pausedDurationMs;

      // Clear paused_at and update total_paused_time
      await client.query(
        `UPDATE time_entries
         SET paused_at = NULL, total_paused_time = $1, updated_at = NOW()
         WHERE id = $2`,
        [newTotalPausedTime, entry.id]
      );

      return { id: entry.id, newTotalPausedTime };
    });

    if (!result) {
      return NextResponse.json(
        { success: false, error_code: "TIMER_NOT_PAUSED", message: "אין טיימר מושהה" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      entry: {
        id: result.id,
        totalPausedTime: result.newTotalPausedTime
      }
    });
  } catch (error) {
    logger.error("Error resuming timer:", error);
    return NextResponse.json(
      { success: false, error_code: "SERVER_ERROR", message: "שגיאה בחידוש הטיימר" },
      { status: 500 }
    );
  }
}
