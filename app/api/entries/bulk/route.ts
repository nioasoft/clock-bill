import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";

/** Maximum number of entry IDs accepted in a single bulk operation. */
const MAX_BULK_ENTRIES = 1000;

/**
 * PATCH /api/entries/bulk
 * Bulk update multiple time entries
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, message: "לא מחובר" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { entryIds, projectId, date, isBillable } = body;

    // Validation
    if (!entryIds || !Array.isArray(entryIds) || entryIds.length === 0) {
      return NextResponse.json(
        { success: false, message: "יש לבחור לפחות רשומה אחת" },
        { status: 400 }
      );
    }

    if (entryIds.length > MAX_BULK_ENTRIES) {
      return NextResponse.json(
        { success: false, message: `ניתן לעדכן עד ${MAX_BULK_ENTRIES} רשומות בבת אחת` },
        { status: 400 }
      );
    }

    // Check if at least one field is being updated
    if (!projectId && !date && isBillable === undefined) {
      return NextResponse.json(
        { success: false, message: "יש לבחור לפחות שדה אחד לעדכון" },
        { status: 400 }
      );
    }

    const { query } = await import("@/lib/db");

    // If projectId is provided, verify it belongs to user
    if (projectId) {
      const projectCheck = await query<{ id: string }>(
        `SELECT p.id FROM projects p
         JOIN clients c ON p.client_id = c.id
         WHERE p.id = $1 AND c.user_id = $2`,
        [projectId, user.id]
      );

      if (projectCheck.rows.length === 0) {
        return NextResponse.json(
          { success: false, message: "הפרויקט לא נמצא" },
          { status: 404 }
        );
      }
    }

    // Build dynamic UPDATE query based on provided fields
    const updateFields: string[] = [];
    const updateValues: (string | number | boolean)[] = [];
    let paramIndex = 1;

    if (projectId) {
      updateFields.push(`project_id = $${paramIndex++}`);
      updateValues.push(projectId);
    }

    if (date) {
      updateFields.push(`date = $${paramIndex++}`);
      updateValues.push(date);
    }

    if (isBillable !== undefined) {
      updateFields.push(`is_billable = $${paramIndex++}`);
      updateValues.push(isBillable);
    }

    // Add updated_at timestamp
    updateFields.push(`updated_at = NOW()`);

    // Add entry IDs and user ID to parameters
    const entryIdsPlaceholder = entryIds.map((_, i) => `$${paramIndex++}`).join(",");
    updateValues.push(...entryIds, user.id);

    // Verify all entries belong to user and update them
    const updateQuery = `
      UPDATE time_entries
      SET ${updateFields.join(", ")}
      WHERE id IN (${entryIdsPlaceholder}) AND user_id = $${paramIndex}
    `;

    const result = await query(updateQuery, updateValues);

    return NextResponse.json({
      success: true,
      message: `עודכנו ${result.rowCount} רשומות`,
      updatedCount: result.rowCount,
    });
  } catch (error) {
    console.error("Error bulk updating entries:", error);
    return NextResponse.json(
      { success: false, message: "שגיאה בעדכון הרשומות" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/entries/bulk
 * Bulk delete multiple time entries
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, message: "לא מחובר" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { entryIds } = body;

    // Validation
    if (!entryIds || !Array.isArray(entryIds) || entryIds.length === 0) {
      return NextResponse.json(
        { success: false, message: "יש לבחור לפחות רשומה אחת" },
        { status: 400 }
      );
    }

    if (entryIds.length > MAX_BULK_ENTRIES) {
      return NextResponse.json(
        { success: false, message: `ניתן למחוק עד ${MAX_BULK_ENTRIES} רשומות בבת אחת` },
        { status: 400 }
      );
    }

    const { query } = await import("@/lib/db");

    // Build parameterized query for entry IDs
    const entryIdsPlaceholder = entryIds.map((_, i) => `$${i + 1}`).join(",");

    // Delete entries that belong to the user
    const deleteQuery = `
      DELETE FROM time_entries
      WHERE id IN (${entryIdsPlaceholder}) AND user_id = $${entryIds.length + 1}
    `;

    const result = await query(deleteQuery, [...entryIds, user.id]);

    return NextResponse.json({
      success: true,
      message: `נמחקו ${result.rowCount} רשומות`,
      deletedCount: result.rowCount,
    });
  } catch (error) {
    console.error("Error bulk deleting entries:", error);
    return NextResponse.json(
      { success: false, message: "שגיאה במחיקת הרשומות" },
      { status: 500 }
    );
  }
}
