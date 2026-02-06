import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { createLogger } from "@/lib/logger";

const logger = createLogger("timer:start");

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
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    userId = user.id;

    // Parse request body
    const body = await request.json();
    projectId = body.projectId;
    const { description } = body;

    // Validate required fields
    if (!projectId) {
      return NextResponse.json(
        { success: false, message: "נא לבחור פרויקט" },
        { status: 400 }
      );
    }

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

    // Check if there's already a running timer
    const runningTimer = await query<{ id: string }>(
      `SELECT id FROM time_entries WHERE user_id = $1 AND start_time IS NOT NULL AND end_time IS NULL`,
      [userId]
    );

    if (runningTimer.rows.length > 0) {
      logger.warn("Timer start attempted while another timer is running", { userId });
      return NextResponse.json(
        { success: false, message: "יש טיימר פעיל כבר. עצור אותו תחילה." },
        { status: 400 }
      );
    }

    // Create new time entry with start_time
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    const result = await query<{ id: string }>(
      `INSERT INTO time_entries (id, user_id, project_id, description, start_time, date, duration, is_billable)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, 0, TRUE)
       RETURNING id`,
      [userId, projectId, description || null, now.toISOString(), today]
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
