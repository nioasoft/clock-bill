import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withTransaction } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { parseBody } from "@/lib/api-validation";

/** A single entry can't bill more than 24h (1440 min) — caps the client-supplied
 *  duration override so a stopped timer can't be inflated to fabricated hours. */
const MAX_ENTRY_MINUTES = 24 * 60;

/** Body schema for stopping a timer. */
const stopTimerSchema = z.object({
  entryId: z.string({ message: "הטיימר לא נמצא או כבר הופסק" }).min(1, "הטיימר לא נמצא או כבר הופסק"),
  description: z.string().max(5000).nullish(),
  notes: z.string().max(5000).nullish(),
  duration: z.number().min(0).max(MAX_ENTRY_MINUTES).nullish(),
  markTaskDone: z.boolean().nullish(),
});

/**
 * POST /api/timer/stop
 * Stops a running timer by setting end_time and calculating duration.
 * Runs inside a transaction with a row lock (SELECT ... FOR UPDATE) so two
 * concurrent stop requests can't both compute/write a duration for the same timer.
 */
export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ success: false, error_code: "UNAUTHORIZED", message: "לא מחובר" }, { status: 401 });
    }

    const userId = user.id;

    // Parse request body
    const parsed = await parseBody(request, stopTimerSchema);
    if (!parsed.ok) return parsed.response;
    const { entryId, description, notes, duration: customDuration, markTaskDone } = parsed.data;

    const result = await withTransaction(async (client) => {
      // Lock the running entry for the duration of the transaction so a
      // concurrent stop can't race between the read and the write.
      const entryResult = await client.query<{
        id: string;
        start_time: string;
        description: string;
        total_paused_time: number;
        paused_at: string | null;
        task_id: string | null;
      }>(
        `SELECT id, start_time, description, total_paused_time, paused_at, task_id
         FROM time_entries
         WHERE id = $1 AND user_id = $2 AND start_time IS NOT NULL AND end_time IS NULL
         FOR UPDATE`,
        [entryId, userId]
      );

      if (entryResult.rows.length === 0) {
        return null;
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

      // Update the entry with end_time, duration, and optionally description/notes.
      // COALESCE keeps the existing value when a field isn't sent; notes are
      // trimmed to null so an empty box clears them only when explicitly passed.
      await client.query(
        `UPDATE time_entries
         SET end_time = $1, duration = $2, description = COALESCE($3, description),
             notes = COALESCE($4, notes), paused_at = NULL, updated_at = NOW()
         WHERE id = $5`,
        [
          endTime.toISOString(),
          durationMinutes,
          description || null,
          notes !== undefined && notes !== null ? notes.trim() : null,
          entryId,
        ]
      );

      // Optionally mark the attached task as done (the stop modal's
      // "סמן כהושלמה" checkbox). Append to the end of the done column.
      if (markTaskDone && entry.task_id) {
        const pos = await client.query<{ next: number }>(
          `SELECT COALESCE(MAX(position), 0) + 1000 AS next FROM tasks WHERE user_id = $1 AND status = 'done'`,
          [userId]
        );
        await client.query(
          `UPDATE tasks SET status = 'done', position = $1, updated_at = NOW()
           WHERE id = $2 AND user_id = $3 AND status <> 'done'`,
          [pos.rows[0].next, entry.task_id, userId]
        );
      }

      return { durationMinutes, endTime };
    });

    if (!result) {
      return NextResponse.json(
        { success: false, error_code: "TIMER_NOT_FOUND", message: "הטיימר לא נמצא או כבר הופסק" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      entry: {
        id: entryId,
        duration: result.durationMinutes,
        endTime: result.endTime.toISOString()
      }
    });
  } catch (error) {
    console.error("Error stopping timer:", error);
    return NextResponse.json(
      { success: false, error_code: "SERVER_ERROR", message: "שגיאה בעצירת הטיימר" },
      { status: 500 }
    );
  }
}
