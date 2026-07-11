import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { createLogger } from "@/lib/logger";

const logger = createLogger("api:reconciliation:today");

export async function GET(_request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error_code: "UNAUTHORIZED", message: "לא מחובר" },
        { status: 401 }
      );
    }

    const profileResult = await query<{ local_date: string; timezone: string }>(
      `SELECT (now() AT TIME ZONE COALESCE(timezone, 'Asia/Jerusalem'))::date::text AS local_date,
              COALESCE(timezone, 'Asia/Jerusalem') AS timezone
         FROM user_profiles
        WHERE user_id = $1`,
      [user.id]
    );
    const localDate = profileResult.rows[0]?.local_date ?? new Date().toISOString().slice(0, 10);
    const timezone = profileResult.rows[0]?.timezone ?? "Asia/Jerusalem";

    const [entriesResult, runningResult, gapsResult] = await Promise.all([
      query<{ entry_count: string; minutes: string }>(
        `SELECT COUNT(*)::text AS entry_count, COALESCE(SUM(duration), 0)::text AS minutes
           FROM time_entries
          WHERE user_id = $1 AND date = $2`,
        [user.id, localDate]
      ),
      query<{ running_count: string }>(
        `SELECT COUNT(*)::text AS running_count
           FROM time_entries
          WHERE user_id = $1 AND start_time IS NOT NULL AND end_time IS NULL`,
        [user.id]
      ),
      query<{ id: string; title: string; project_name: string }>(
        `SELECT t.id, t.title, p.name AS project_name
           FROM tasks t
           JOIN projects p ON p.id = t.project_id AND p.user_id = $1
          WHERE t.user_id = $1
            AND t.status = 'done'
            AND (t.updated_at AT TIME ZONE $3)::date = $2
            AND NOT EXISTS (
              SELECT 1 FROM time_entries te
               WHERE te.user_id = $1 AND te.task_id = t.id
            )
          ORDER BY t.updated_at DESC
          LIMIT 5`,
        [user.id, localDate, timezone]
      ),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        date: localDate,
        entryCount: Number(entriesResult.rows[0]?.entry_count ?? 0),
        minutes: Number(entriesResult.rows[0]?.minutes ?? 0),
        runningTimerCount: Number(runningResult.rows[0]?.running_count ?? 0),
        unloggedCompletedTasks: gapsResult.rows.map((row) => ({
          id: row.id,
          title: row.title,
          projectName: row.project_name,
        })),
      },
    });
  } catch (error) {
    logger.error("GET /api/reconciliation/today failed", error);
    return NextResponse.json(
      { success: false, error_code: "SERVER_ERROR", message: "שגיאה בטעינת סיכום היום" },
      { status: 500 }
    );
  }
}
