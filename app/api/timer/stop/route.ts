import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withTransaction } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { parseBody } from "@/lib/api-validation";

/** Body schema for stopping a timer. */
const stopTimerSchema = z.object({
  entryId: z.string({ message: "הטיימר לא נמצא או כבר הופסק" }).min(1, "הטיימר לא נמצא או כבר הופסק"),
  description: z.string().max(5000).nullish(),
  notes: z.string().max(5000).nullish(),
  duration: z.number().nullish(),
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
      return NextResponse.json({ success: false, message: "לא מחובר" }, { status: 401 });
    }

    const userId = user.id;

    // Parse request body
    const parsed = await parseBody(request, stopTimerSchema);
    if (!parsed.ok) return parsed.response;
    const { entryId, description, notes, duration: customDuration } = parsed.data;

    const result = await withTransaction(async (client) => {
      // Lock the running entry for the duration of the transaction so a
      // concurrent stop can't race between the read and the write.
      const entryResult = await client.query<{
        id: string;
        start_time: string;
        description: string;
        total_paused_time: number;
        paused_at: string | null;
      }>(
        `SELECT id, start_time, description, total_paused_time, paused_at
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

      return { durationMinutes, endTime };
    });

    if (!result) {
      return NextResponse.json(
        { success: false, message: "הטיימר לא נמצא או כבר הופסק" },
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
      { success: false, message: "שגיאה בעצירת הטיימר" },
      { status: 500 }
    );
  }
}
