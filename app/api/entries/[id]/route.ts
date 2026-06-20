import { NextRequest, NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { getUser } from "@/lib/auth";
import { parseBody } from "@/lib/api-validation";
import { entryBodySchema } from "@/lib/schemas/entries";
import { entrySelectColumns, mapEntryRow, type EntryRow } from "@/lib/transformers/entries";
import { createLogger } from "@/lib/logger";

const logger = createLogger("entries:item");

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/entries/[id]
 * Get a single time entry by ID
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error_code: "UNAUTHORIZED", message: "לא מחובר" },
        { status: 401 }
      );
    }

    const { id } = await context.params;

    const { query } = await import("@/lib/db");

    const result = await query<EntryRow>(
      `SELECT
        ${entrySelectColumns("te")}
      FROM time_entries te
      JOIN projects p ON te.project_id = p.id
      JOIN clients c ON p.client_id = c.id
      LEFT JOIN tasks tk ON te.task_id = tk.id
      WHERE te.id = $1 AND te.user_id = $2`,
      [id, user.id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error_code: "ENTRY_NOT_FOUND", message: "הרשומה לא נמצאה" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      entry: mapEntryRow(result.rows[0]),
    }, {
      headers: {
        'Cache-Control': 'no-store, must-revalidate'
      }
    });
  } catch (error) {
    logger.error("Error fetching entry", error);
    return NextResponse.json(
      { success: false, error_code: "SERVER_ERROR", message: "שגיאה בטעינת הרשומה" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/entries/[id]
 * Update a time entry
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const user = await getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error_code: "UNAUTHORIZED", message: "לא מחובר" },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const parsed = await parseBody(request, entryBodySchema);
    if (!parsed.ok) return parsed.response;
    const { projectId, taskId, date, duration, description, notes, isBillable, tags, billingKind, rate, rateLabel, quantity, unit } = parsed.data;
    const kind = billingKind ?? "hourly";
    const isItem = kind === "item";
    const effectiveDuration = isItem ? 0 : duration;

    const { withTransaction } = await import("@/lib/db");

    const result = await withTransaction(async (client: PoolClient) => {
      // Ownership + current item_ref (so we never reassign an existing one).
      const entryCheck = await client.query<{ id: string; item_ref: number | null }>(
        `SELECT id, item_ref FROM time_entries WHERE id = $1 AND user_id = $2`,
        [id, user.id]
      );
      if (entryCheck.rows.length === 0) return { error: "entry" as const };

      const projectCheck = await client.query<{ id: string; client_id: string }>(
        `SELECT p.id, c.id AS client_id FROM projects p
         JOIN clients c ON p.client_id = c.id
         WHERE p.id = $1 AND c.user_id = $2`,
        [projectId, user.id]
      );
      if (projectCheck.rows.length === 0) return { error: "project" as const };

      const { getLockedClientIds } = await import("@/lib/plan-guard");
      if ((await getLockedClientIds(user.id)).has(projectCheck.rows[0].client_id)) {
        return { planLocked: true as const };
      }

      // Item lines carry a reference number: keep the existing one, assign a new
      // one if this line is becoming an item and has none. Hourly lines clear it.
      let itemRef: number | null = entryCheck.rows[0].item_ref;
      if (!isItem) {
        itemRef = null;
      } else if (itemRef === null) {
        const ref = await client.query<{ assigned: number }>(
          `INSERT INTO user_profiles (id, user_id, next_item_ref)
           VALUES (gen_random_uuid()::text, $1, 2)
           ON CONFLICT (user_id) DO UPDATE SET next_item_ref = user_profiles.next_item_ref + 1
           RETURNING (next_item_ref - 1) AS assigned`,
          [user.id]
        );
        itemRef = ref.rows[0].assigned;
      }

      const updated = await client.query<EntryRow>(
        `WITH upd AS (
           UPDATE time_entries
           SET project_id = $1, task_id = $2, description = $3, duration = $4, date = $5,
               tags = $6, notes = $7, is_billable = $8, billing_kind = $9, rate = $10,
               rate_label = $11, quantity = $12, item_ref = $13, unit = $14, updated_at = NOW()
           WHERE id = $15 AND user_id = $16
           RETURNING *
         )
         SELECT
           ${entrySelectColumns("upd")}
         FROM upd
         JOIN projects p ON upd.project_id = p.id
         JOIN clients c ON p.client_id = c.id
         LEFT JOIN tasks tk ON upd.task_id = tk.id`,
        [
          projectId,
          taskId || null,
          description.trim(),
          effectiveDuration,
          date,
          JSON.stringify(tags || []),
          notes?.trim() || null,
          isBillable !== undefined ? isBillable : true,
          kind,
          rate ?? null,
          rateLabel?.trim() || null,
          isItem ? (quantity ?? null) : null,
          itemRef,
          isItem ? unit?.trim() || null : null,
          id,
          user.id,
        ]
      );
      return { row: updated.rows[0] };
    });

    if ("error" in result) {
      return NextResponse.json(
        {
          success: false,
          error_code: result.error === "entry" ? "ENTRY_NOT_FOUND" : "PROJECT_NOT_FOUND",
          message: result.error === "entry" ? "הרשומה לא נמצאה" : "הפרויקט לא נמצא",
        },
        { status: 404 }
      );
    }

    const { isPlanLockedSentinel, lockedClientResponse } = await import("@/lib/plan-guard");
    if (isPlanLockedSentinel(result)) return lockedClientResponse();

    return NextResponse.json({
      success: true,
      entry: mapEntryRow(result.row),
    });
  } catch (error) {
    logger.error("Error updating entry", error);
    return NextResponse.json(
      { success: false, error_code: "SERVER_ERROR", message: "שגיאה בעדכון הרשומה" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/entries/[id]
 * Delete a time entry
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const user = await getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error_code: "UNAUTHORIZED", message: "לא מחובר" },
        { status: 401 }
      );
    }

    const { id } = await context.params;

    const { query } = await import("@/lib/db");

    // Delete the entry, scoped to the user; RETURNING lets us detect not-found in one round-trip
    const deleted = await query<{ id: string }>(
      `DELETE FROM time_entries WHERE id = $1 AND user_id = $2 RETURNING id`,
      [id, user.id]
    );

    if (deleted.rows.length === 0) {
      return NextResponse.json(
        { success: false, error_code: "ENTRY_NOT_FOUND", message: "הרשומה לא נמצאה" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "הרשומה נמחקה בהצלחה",
    });
  } catch (error) {
    logger.error("Error deleting entry", error);
    return NextResponse.json(
      { success: false, error_code: "SERVER_ERROR", message: "שגיאה במחיקת הרשומה" },
      { status: 500 }
    );
  }
}
