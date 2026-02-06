import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { createLogger } from "@/lib/logger";

const logger = createLogger("api-reports-presets-detail");

// DELETE - Delete a report preset
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Get authenticated user
    const user = await getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, message: "לא מאומת" },
        { status: 401 }
      );
    }

    const userId = user.id;
    const { id: presetId } = await params;

    // Check if preset exists and belongs to user
    const checkResult = await query(
      `
      SELECT id FROM report_presets
      WHERE id = $1 AND user_id = $2
      `,
      [presetId, userId]
    );

    if (checkResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: "הפריסט לא נמצא" },
        { status: 404 }
      );
    }

    // Delete the preset
    await query(
      `
      DELETE FROM report_presets
      WHERE id = $1 AND user_id = $2
      `,
      [presetId, userId]
    );

    return NextResponse.json({
      success: true,
      message: "הפריסט נמחק בהצלחה",
    });
  } catch (error) {
    logger.error("Error deleting report preset", error);
    return NextResponse.json(
      { success: false, message: "שגיאה במחיקת הפריסט" },
      { status: 500 }
    );
  }
}
