import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { createLogger } from "@/lib/logger";

const logger = createLogger("api:profile:reminder-shown");

/**
 * POST /api/profile/reminder-shown
 * Updates the last_reminder_date to today
 */
export async function POST() {
  let userId: string | undefined;
  try {
    // Get current user from session
    const user = await getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    userId = user.id;

    // Update last_reminder_date to today
    const result = await query<{ last_reminder_date: string }>(
      `UPDATE user_profiles
       SET last_reminder_date = CURRENT_DATE, updated_at = NOW()
       WHERE user_id = $1
       RETURNING last_reminder_date`,
      [user.id]
    );

    return NextResponse.json({
      success: true,
      lastReminderDate: result.rows[0]?.last_reminder_date,
    });
  } catch (error) {
    logger.error("Failed to update reminder date", error, userId ? { userId } : undefined);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
