import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { parseBody } from "@/lib/api-validation";
import { createLogger } from "@/lib/logger";

const logger = createLogger("timer:start");

/** Body schema for starting a timer. */
const startTimerSchema = z.object({
  projectId: z.string({ message: "נא לבחור פרויקט" }).min(1, "נא לבחור פרויקט"),
  taskId: z.string().nullish(),
  description: z.string().max(5000).nullish(),
});

/**
 * POST /api/timer/start
 * Starts a new timer by creating a time entry with start_time
 */
export async function POST(request: NextRequest) {
  let userId: string | undefined;
  let projectId: string | undefined;
  try {
    // Get authenticated user
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ success: false, message: "לא מחובר" }, { status: 401 });
    }

    userId = user.id;

    // Parse request body
    const parsed = await parseBody(request, startTimerSchema);
    if (!parsed.ok) return parsed.response;
    const { description, taskId } = parsed.data;
    projectId = parsed.data.projectId;

    // Verify the project belongs to the user
    const projectCheck = await query<{ id: string }>(
      `SELECT id FROM projects WHERE id = $1 AND user_id = $2`,
      [projectId, userId]
    );

    if (projectCheck.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: "הפרויקט לא נמצא" },
        { status: 404 }
      );
    }

    // Create new time entry with start_time. Multiple concurrent running timers
    // per user are allowed (e.g. working on two projects at once).
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    const result = await query<{ id: string }>(
      `INSERT INTO time_entries (id, user_id, project_id, task_id, description, start_time, date, duration, is_billable)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, 0, TRUE)
       RETURNING id`,
      [userId, projectId, taskId || null, description || '', now.toISOString(), today]
    );

    const newEntry = result.rows[0];

    return NextResponse.json({
      success: true,
      entry: {
        id: newEntry.id,
        projectId,
        description: description || null,
        startTime: now.toISOString()
      }
    });
  } catch (error) {
    logger.error("Failed to start timer", error, userId && projectId ? { userId, projectId } : undefined);
    return NextResponse.json(
      { success: false, message: "שגיאה בהתחלת הטיימר" },
      { status: 500 }
    );
  }
}
