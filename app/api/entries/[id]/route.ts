import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";

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
        { success: false, message: "לא מחובר" },
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
      project_name: string;
      client_name: string;
      client_id: string;
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
        p.name as project_name,
        c.name as client_name,
        c.id as client_id
      FROM time_entries te
      JOIN projects p ON te.project_id = p.id
      JOIN clients c ON p.client_id = c.id
      WHERE te.id = $1 AND te.user_id = $2`,
      [id, user.id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: "הרשומה לא נמצאה" },
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
      },
    }, {
      headers: {
        'Cache-Control': 'private, max-age=30, stale-while-revalidate=60'
      }
    });
  } catch (error) {
    console.error("Error fetching entry:", error);
    return NextResponse.json(
      { success: false, message: "שגיאה בטעינת הרשומה" },
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
        { success: false, message: "לא מחובר" },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const body = await request.json();
    const { projectId, date, duration, description, notes, isBillable, tags } = body;

    // Validation
    if (!projectId) {
      return NextResponse.json(
        { success: false, message: "נא לבחור פרויקט" },
        { status: 400 }
      );
    }

    if (!date) {
      return NextResponse.json(
        { success: false, message: "נא לבחור תאריך" },
        { status: 400 }
      );
    }

    if (!duration || duration <= 0) {
      return NextResponse.json(
        { success: false, message: "נא להזין משך זמן תקין" },
        { status: 400 }
      );
    }

    if (!description || description.trim().length === 0) {
      return NextResponse.json(
        { success: false, message: "נא להזין תיאור" },
        { status: 400 }
      );
    }

    const { query } = await import("@/lib/db");

    // Verify entry belongs to user
    const entryCheck = await query<{ id: string }>(
      `SELECT id FROM time_entries WHERE id = $1 AND user_id = $2`,
      [id, user.id]
    );

    if (entryCheck.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: "הרשומה לא נמצאה" },
        { status: 404 }
      );
    }

    // Verify project belongs to user
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

    // Update time entry
    await query(
      `UPDATE time_entries
       SET project_id = $1, description = $2, duration = $3, date = $4,
           tags = $5, notes = $6, is_billable = $7, updated_at = NOW()
       WHERE id = $8`,
      [
        projectId,
        description.trim(),
        duration,
        date,
        JSON.stringify(tags || []),
        notes?.trim() || null,
        isBillable !== undefined ? isBillable : true,
        id,
      ]
    );

    // Fetch the updated entry with project and client info
    const entryResult = await query<{
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
      project_name: string;
      client_name: string;
      client_id: string;
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
        p.name as project_name,
        c.name as client_name,
        c.id as client_id
      FROM time_entries te
      JOIN projects p ON te.project_id = p.id
      JOIN clients c ON p.client_id = c.id
      WHERE te.id = $1`,
      [id]
    );

    const entry = entryResult.rows[0];

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
      },
    });
  } catch (error) {
    console.error("Error updating entry:", error);
    return NextResponse.json(
      { success: false, message: "שגיאה בעדכון הרשומה" },
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
        { success: false, message: "לא מחובר" },
        { status: 401 }
      );
    }

    const { id } = await context.params;

    const { query } = await import("@/lib/db");

    // Verify entry belongs to user
    const entryCheck = await query<{ id: string }>(
      `SELECT id FROM time_entries WHERE id = $1 AND user_id = $2`,
      [id, user.id]
    );

    if (entryCheck.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: "הרשומה לא נמצאה" },
        { status: 404 }
      );
    }

    // Delete the entry
    await query(`DELETE FROM time_entries WHERE id = $1`, [id]);

    return NextResponse.json({
      success: true,
      message: "הרשומה נמחקה בהצלחה",
    });
  } catch (error) {
    console.error("Error deleting entry:", error);
    return NextResponse.json(
      { success: false, message: "שגיאה במחיקת הרשומה" },
      { status: 500 }
    );
  }
}
