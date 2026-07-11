import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { createLogger } from "@/lib/logger";

const logger = createLogger("api:work-templates:id");

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ success: false, error_code: "UNAUTHORIZED" }, { status: 401 });
    const { id } = await params;
    const result = await query(
      `DELETE FROM work_templates WHERE id = $1 AND user_id = $2 RETURNING id`,
      [id, user.id]
    );
    if (result.rowCount === 0) return NextResponse.json({ success: false, error_code: "NOT_FOUND" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("DELETE /api/work-templates/:id failed", error);
    return NextResponse.json({ success: false, error_code: "SERVER_ERROR" }, { status: 500 });
  }
}
