import { NextRequest, NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { getUser } from "@/lib/auth";
import { parseBody } from "@/lib/api-validation";
import { moveTaskSchema } from "@/lib/schemas/tasks";
import { createLogger } from "@/lib/logger";

const logger = createLogger("tasks:move");

/**
 * PATCH /api/tasks/[id]/move — update status + position. When a task ENTERS
 * "in_progress" from another column, start a timer for it in the SAME transaction
 * (status change + time_entry insert are atomic). Leaving "in_progress" is a plain
 * status/position update — the client opens the existing stop modal separately.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ success: false, error_code: "UNAUTHORIZED", message: "לא מחובר" }, { status: 401 });

    const { id } = await params;
    const parsed = await parseBody(request, moveTaskSchema);
    if (!parsed.ok) return parsed.response;
    const { status, position } = parsed.data;

    const { query, withTransaction } = await import("@/lib/db");

    const existing = await query<{
      status: string; project_id: string; rate: number | null; rate_label: string | null; title: string;
    }>(
      `SELECT status, project_id, rate, rate_label, title FROM tasks WHERE id = $1 AND user_id = $2`,
      [id, user.id]
    );
    if (existing.rows.length === 0)
      return NextResponse.json({ success: false, error_code: "TASK_NOT_FOUND", message: "המשימה לא נמצאה" }, { status: 404 });

    const task = existing.rows[0];
    const enteringInProgress = status === "in_progress" && task.status !== "in_progress";

    // Return the timer entry id from the transaction so the closure variable
    // is definitely-assigned under strict TS (assigned inside the async callback,
    // then read after). Status update + timer insert are atomic in one tx.
    const entryId = await withTransaction(async (client: PoolClient): Promise<string | null> => {
      await client.query(
        `UPDATE tasks SET status = $1, position = $2, updated_at = NOW() WHERE id = $3 AND user_id = $4`,
        [status, position, id, user.id]
      );

      if (!enteringInProgress) return null;

      // Idempotent: if a timer is already running for this task, reuse it.
      const running = await client.query<{ id: string }>(
        `SELECT id FROM time_entries
         WHERE task_id = $1 AND user_id = $2 AND start_time IS NOT NULL AND end_time IS NULL
         LIMIT 1`,
        [id, user.id]
      );
      if (running.rows.length > 0) return running.rows[0].id;

      const now = new Date();
      const today = now.toISOString().split("T")[0];
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO time_entries
           (id, user_id, project_id, task_id, description, start_time, date, duration,
            is_billable, billing_kind, rate, rate_label)
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, 0, TRUE, 'hourly', $7, $8)
         RETURNING id`,
        [user.id, task.project_id, id, task.title, now.toISOString(), today, task.rate, task.rate_label]
      );
      return inserted.rows[0].id;
    });

    return NextResponse.json({ success: true, entryId });
  } catch (error) {
    logger.error("Failed to move task", error);
    return NextResponse.json({ success: false, error_code: "SERVER_ERROR", message: "שגיאה בעדכון המשימה" }, { status: 500 });
  }
}
