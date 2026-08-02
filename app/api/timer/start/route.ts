import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withTransaction } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { parseBody } from "@/lib/api-validation";
import { appToday } from "@/lib/dates";
import { createLogger } from "@/lib/logger";

const logger = createLogger("timer:start");

/** Body schema for starting a timer. */
const startTimerSchema = z.object({
  projectId: z.string({ message: "נא לבחור פרויקט" }).min(1, "נא לבחור פרויקט"),
  taskId: z.string().nullish(),
  description: z.string().max(5000).nullish(),
  rate: z.number().min(0).nullish(),
  rateLabel: z.string().max(100).nullish(),
});

/**
 * POST /api/timer/start
 * Starts a timer (creates a running time entry). When the timer is attached to
 * a task, that task is moved to "in_progress" in the SAME transaction (mirrors
 * the Kanban drag-to-in_progress behavior).
 */
export async function POST(request: NextRequest) {
  let userId: string | undefined;
  let projectId: string | undefined;
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ success: false, error_code: "UNAUTHORIZED", message: "לא מחובר" }, { status: 401 });
    }
    userId = user.id;

    const parsed = await parseBody(request, startTimerSchema);
    if (!parsed.ok) return parsed.response;
    const { description, taskId, rate, rateLabel } = parsed.data;
    projectId = parsed.data.projectId;

    const now = new Date();
    // The entry's calendar day must be the user's, not the runtime's. Vercel runs
    // in UTC, so toISOString() would file a timer started at 01:00 in Israel under
    // YESTERDAY — and /timer/stop never rewrites `date`, so it would stay wrong.
    const today = appToday(now);

    const newEntry = await withTransaction(async (client) => {
      // Verify the project belongs to the user.
      const projectCheck = await client.query<{ id: string; client_id: string }>(
        `SELECT id, client_id FROM projects WHERE id = $1 AND user_id = $2`,
        [projectId, userId]
      );
      if (projectCheck.rows.length === 0) return null;

      const { getLockedClientIds } = await import("@/lib/plan-guard");
      if ((await getLockedClientIds(userId!)).has(projectCheck.rows[0].client_id)) return { planLocked: true as const };

      // If a task was supplied it must belong to THIS user AND THIS project —
      // the FK alone only proves the task id exists, not that it's the caller's.
      if (taskId) {
        const taskCheck = await client.query<{ id: string }>(
          `SELECT id FROM tasks WHERE id = $1 AND user_id = $2 AND project_id = $3`,
          [taskId, userId, projectId]
        );
        if (taskCheck.rows.length === 0) return { taskInvalid: true as const };
      }

      // Create the running time entry. Multiple concurrent running timers per
      // user are allowed (e.g. two projects at once).
      const result = await client.query<{ id: string }>(
        `INSERT INTO time_entries (id, user_id, project_id, task_id, description, start_time, date, duration, is_billable, billing_kind, rate, rate_label)
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, 0, TRUE, 'hourly', $7, $8)
         RETURNING id`,
        [userId, projectId, taskId || null, description || "", now.toISOString(), today, rate ?? null, rateLabel?.trim() || null]
      );

      // Starting a timer ON a task = you're working on it → move it to
      // "in_progress" (append to the end of that column). Skips tasks already
      // in progress so their position isn't disturbed.
      if (taskId) {
        const pos = await client.query<{ next: number }>(
          `SELECT COALESCE(MAX(position), 0) + 1000 AS next FROM tasks WHERE user_id = $1 AND status = 'in_progress'`,
          [userId]
        );
        await client.query(
          `UPDATE tasks SET status = 'in_progress', position = $1, updated_at = NOW()
           WHERE id = $2 AND user_id = $3 AND status <> 'in_progress'`,
          [pos.rows[0].next, taskId, userId]
        );
      }

      return result.rows[0];
    });

    const { isPlanLockedSentinel, lockedClientResponse } = await import("@/lib/plan-guard");
    if (!newEntry) {
      return NextResponse.json({ success: false, error_code: "PROJECT_NOT_FOUND", message: "הפרויקט לא נמצא" }, { status: 404 });
    }
    if (isPlanLockedSentinel(newEntry)) {
      return lockedClientResponse();
    }
    if ("taskInvalid" in newEntry) {
      return NextResponse.json({ success: false, error_code: "TASK_NOT_FOUND", message: "המשימה לא נמצאה" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      entry: {
        id: newEntry.id,
        projectId,
        description: description || null,
        startTime: now.toISOString(),
      },
    });
  } catch (error) {
    logger.error("Failed to start timer", error, userId && projectId ? { userId, projectId } : undefined);
    return NextResponse.json({ success: false, error_code: "SERVER_ERROR", message: "שגיאה בהתחלת הטיימר" }, { status: 500 });
  }
}
