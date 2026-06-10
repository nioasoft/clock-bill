import { NextRequest, NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { getUser } from "@/lib/auth";
import { parseBody } from "@/lib/api-validation";
import { entryBodySchema } from "@/lib/schemas/entries";

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

    const result = await query<{
      id: string;
      project_id: string;
      description: string;
      start_time: string | null;
      end_time: string | null;
      duration: number;
      date: string;
      tags: unknown;
      notes: string | null;
      is_billable: boolean;
      created_at: string;
      task_id: string | null;
      billing_kind: string | null;
      rate: number | null;
      rate_label: string | null;
      quantity: number | null;
      item_ref: number | null;
      unit: string | null;
      project_name: string;
      client_name: string;
      client_id: string;
      task_name: string | null;
    }>(
      `SELECT
        te.id,
        te.project_id,
        te.description,
        te.start_time,
        te.end_time,
        te.duration,
        te.date,
        te.tags,
        te.notes,
        te.is_billable,
        te.created_at,
        te.task_id,
        te.billing_kind,
        te.rate,
        te.rate_label,
        te.quantity,
        te.item_ref,
        te.unit,
        p.name as project_name,
        c.name as client_name,
        c.id as client_id,
        tk.title as task_name
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

    const entry = result.rows[0];

    return NextResponse.json({
      success: true,
      entry: {
        id: entry.id,
        projectId: entry.project_id,
        projectName: entry.project_name,
        clientId: entry.client_id,
        clientName: entry.client_name,
        description: entry.description,
        startTime: entry.start_time,
        endTime: entry.end_time,
        duration: entry.duration,
        date: entry.date,
        tags: entry.tags || [],
        notes: entry.notes,
        isBillable: entry.is_billable,
        createdAt: entry.created_at,
        taskId: entry.task_id,
        taskName: entry.task_name,
        billingKind: entry.billing_kind ?? "hourly",
        rate: entry.rate,
        rateLabel: entry.rate_label,
        quantity: entry.quantity,
        itemRef: entry.item_ref,
        unit: entry.unit,
      },
    }, {
      headers: {
        'Cache-Control': 'no-store, must-revalidate'
      }
    });
  } catch (error) {
    console.error("Error fetching entry:", error);
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

      const projectCheck = await client.query<{ id: string }>(
        `SELECT p.id FROM projects p
         JOIN clients c ON p.client_id = c.id
         WHERE p.id = $1 AND c.user_id = $2`,
        [projectId, user.id]
      );
      if (projectCheck.rows.length === 0) return { error: "project" as const };

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

      const updated = await client.query<UpdatedRow>(
        `WITH upd AS (
           UPDATE time_entries
           SET project_id = $1, task_id = $2, description = $3, duration = $4, date = $5,
               tags = $6, notes = $7, is_billable = $8, billing_kind = $9, rate = $10,
               rate_label = $11, quantity = $12, item_ref = $13, unit = $14, updated_at = NOW()
           WHERE id = $15 AND user_id = $16
           RETURNING *
         )
         SELECT
           upd.id, upd.project_id, upd.description, upd.start_time, upd.end_time,
           upd.duration, upd.date, upd.tags, upd.notes, upd.is_billable, upd.created_at,
           upd.task_id, upd.billing_kind, upd.rate, upd.rate_label, upd.quantity, upd.item_ref, upd.unit,
           p.name as project_name, c.name as client_name, c.id as client_id, tk.title as task_name
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

    const entry = result.row;

    return NextResponse.json({
      success: true,
      entry: {
        id: entry.id,
        projectId: entry.project_id,
        projectName: entry.project_name,
        clientId: entry.client_id,
        clientName: entry.client_name,
        description: entry.description,
        startTime: entry.start_time,
        endTime: entry.end_time,
        duration: entry.duration,
        date: entry.date,
        tags: entry.tags || [],
        notes: entry.notes,
        isBillable: entry.is_billable,
        createdAt: entry.created_at,
        taskId: entry.task_id,
        taskName: entry.task_name,
        billingKind: entry.billing_kind ?? "hourly",
        rate: entry.rate,
        rateLabel: entry.rate_label,
        quantity: entry.quantity,
        itemRef: entry.item_ref,
        unit: entry.unit,
      },
    });
  } catch (error) {
    console.error("Error updating entry:", error);
    return NextResponse.json(
      { success: false, error_code: "SERVER_ERROR", message: "שגיאה בעדכון הרשומה" },
      { status: 500 }
    );
  }
}

/** Shape returned by the update CTE (time_entries.* + joined names). */
interface UpdatedRow {
  id: string;
  project_id: string;
  description: string;
  start_time: string | null;
  end_time: string | null;
  duration: number;
  date: string;
  tags: unknown;
  notes: string | null;
  is_billable: boolean;
  created_at: string;
  task_id: string | null;
  billing_kind: string | null;
  rate: number | null;
  rate_label: string | null;
  quantity: number | null;
  item_ref: number | null;
  unit: string | null;
  project_name: string;
  client_name: string;
  client_id: string;
  task_name: string | null;
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
    console.error("Error deleting entry:", error);
    return NextResponse.json(
      { success: false, error_code: "SERVER_ERROR", message: "שגיאה במחיקת הרשומה" },
      { status: 500 }
    );
  }
}
