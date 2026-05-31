import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { parseBody } from "@/lib/api-validation";

/** Body schema for updating a running timer's notes mid-work. */
const updateNotesSchema = z.object({
  entryId: z.string({ message: "מזהה רשומה חסר" }).min(1, "מזהה רשומה חסר"),
  notes: z.string().max(5000).nullish(),
});

/**
 * POST /api/timer/notes
 * Update the notes on a RUNNING timer (end_time IS NULL) while work is ongoing.
 * Each update overwrites the previous notes (latest wins). Scoped to the caller.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ success: false, message: "לא מחובר" }, { status: 401 });
    }

    const parsed = await parseBody(request, updateNotesSchema);
    if (!parsed.ok) return parsed.response;
    const { entryId, notes } = parsed.data;

    // Only running timers (end_time IS NULL); scoped by user_id (defense in depth + RLS).
    const result = await query(
      `UPDATE time_entries
       SET notes = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3 AND end_time IS NULL`,
      [notes?.trim() || null, entryId, user.id]
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { success: false, message: "הטיימר לא נמצא או כבר הופסק" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating timer notes:", error);
    return NextResponse.json(
      { success: false, message: "שגיאה בשמירת ההערות" },
      { status: 500 }
    );
  }
}
