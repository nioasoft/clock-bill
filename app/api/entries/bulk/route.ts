import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUser } from "@/lib/auth";
import { parseBody } from "@/lib/api-validation";

/** Maximum number of entry IDs accepted in a single bulk operation. */
const MAX_BULK_ENTRIES = 1000;

/** Body schema for bulk-updating time entries. */
const bulkUpdateSchema = z.object({
  entryIds: z
    .array(z.string().min(1), { message: "יש לבחור לפחות רשומה אחת" })
    .min(1, "יש לבחור לפחות רשומה אחת")
    .max(MAX_BULK_ENTRIES, `ניתן לעדכן עד ${MAX_BULK_ENTRIES} רשומות בבת אחת`),
  projectId: z.string().min(1).optional(),
  date: z.string().min(1).optional(),
  isBillable: z.boolean().optional(),
});

/** Body schema for bulk-deleting time entries. */
const bulkDeleteSchema = z.object({
  entryIds: z
    .array(z.string().min(1), { message: "יש לבחור לפחות רשומה אחת" })
    .min(1, "יש לבחור לפחות רשומה אחת")
    .max(MAX_BULK_ENTRIES, `ניתן למחוק עד ${MAX_BULK_ENTRIES} רשומות בבת אחת`),
});

/**
 * PATCH /api/entries/bulk
 * Bulk update multiple time entries
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error_code: "UNAUTHORIZED", message: "לא מחובר" },
        { status: 401 }
      );
    }

    const parsed = await parseBody(request, bulkUpdateSchema);
    if (!parsed.ok) return parsed.response;
    const { entryIds, projectId, date, isBillable } = parsed.data;

    // Check if at least one field is being updated
    if (!projectId && !date && isBillable === undefined) {
      return NextResponse.json(
        { success: false, error_code: "NO_FIELDS_TO_UPDATE", message: "יש לבחור לפחות שדה אחד לעדכון" },
        { status: 400 }
      );
    }

    const { withTransaction } = await import("@/lib/db");

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
    const entryIdsPlaceholder = entryIds.map(() => `$${paramIndex++}`).join(",");
    updateValues.push(...entryIds, user.id);

    // Verify all entries belong to user and update them
    const updateQuery = `
      UPDATE time_entries
      SET ${updateFields.join(", ")}
      WHERE id IN (${entryIdsPlaceholder}) AND user_id = $${paramIndex}
    `;

    // One transaction: the optional project-ownership check and the bulk update
    // share a single RLS bind / connection and are atomic (no check-then-write
    // race, no two separate round-trip triples).
    const outcome = await withTransaction(async (client) => {
      if (projectId) {
        const projectCheck = await client.query<{ id: string }>(
          `SELECT p.id FROM projects p
           JOIN clients c ON p.client_id = c.id
           WHERE p.id = $1 AND c.user_id = $2`,
          [projectId, user.id]
        );
        if (projectCheck.rows.length === 0) return { notFound: true as const };
      }
      const result = await client.query(updateQuery, updateValues);
      return { rowCount: result.rowCount ?? 0 };
    });

    if ("notFound" in outcome) {
      return NextResponse.json(
        { success: false, error_code: "PROJECT_NOT_FOUND", message: "הפרויקט לא נמצא" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `עודכנו ${outcome.rowCount} רשומות`,
      updatedCount: outcome.rowCount,
    });
  } catch (error) {
    console.error("Error bulk updating entries:", error);
    return NextResponse.json(
      { success: false, error_code: "SERVER_ERROR", message: "שגיאה בעדכון הרשומות" },
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
        { success: false, error_code: "UNAUTHORIZED", message: "לא מחובר" },
        { status: 401 }
      );
    }

    const parsed = await parseBody(request, bulkDeleteSchema);
    if (!parsed.ok) return parsed.response;
    const { entryIds } = parsed.data;

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
      { success: false, error_code: "SERVER_ERROR", message: "שגיאה במחיקת הרשומות" },
      { status: 500 }
    );
  }
}
