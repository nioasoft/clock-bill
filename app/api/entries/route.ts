import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";

/**
 * GET /api/entries
 * List all time entries for the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, message: "לא מחובר" },
        { status: 401 }
      );
    }

    const { query } = await import("@/lib/db");

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId");
    const projectId = searchParams.get("projectId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // Build query with filters
    let queryText = `
      SELECT
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
        te.paused_at,
        te.total_paused_time,
        p.name as project_name,
        c.name as client_name,
        c.id as client_id
      FROM time_entries te
      JOIN projects p ON te.project_id = p.id
      JOIN clients c ON p.client_id = c.id
      WHERE te.user_id = $1
    `;
    const queryParams: (string | number | boolean | null)[] = [user.id];
    let paramIndex = 2;

    if (clientId) {
      queryText += ` AND c.id = $${paramIndex}`;
      queryParams.push(clientId);
      paramIndex++;
    }

    if (projectId) {
      queryText += ` AND p.id = $${paramIndex}`;
      queryParams.push(projectId);
      paramIndex++;
    }

    if (startDate) {
      queryText += ` AND te.date >= $${paramIndex}`;
      queryParams.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      queryText += ` AND te.date <= $${paramIndex}`;
      queryParams.push(endDate);
      paramIndex++;
    }

    queryText += ` ORDER BY te.date DESC, te.created_at DESC`;

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
      paused_at: string | null;
      total_paused_time: number | null;
      project_name: string;
      client_name: string;
      client_id: string;
    }>(queryText, queryParams);

    const entries = result.rows.map((entry) => ({
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
      pausedAt: entry.paused_at,
      totalPausedTime: entry.total_paused_time,
    }));

    return NextResponse.json({
      success: true,
      entries,
    });
  } catch (error) {
    console.error("Error fetching entries:", error);
    return NextResponse.json(
      { success: false, message: "שגיאה בטעינת הרשומות" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/entries
 * Create a new manual time entry
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, message: "לא מחובר" },
        { status: 401 }
      );
    }

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

    // Generate UUID for new entry
    const entryIdResult = await query<{ id: string }>(
      `SELECT gen_random_uuid()::text as id`
    );
    const entryId = entryIdResult.rows[0].id;

    // Insert time entry (manual entry has no start/end time)
    await query(
      `INSERT INTO time_entries (id, user_id, project_id, description, duration, date, tags, notes, is_billable)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        entryId,
        user.id,
        projectId,
        description.trim(),
        duration,
        date,
        JSON.stringify(tags || []),
        notes?.trim() || null,
        isBillable !== undefined ? isBillable : true,
      ]
    );

    // Fetch the created entry with project and client info
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
      paused_at: string | null;
      total_paused_time: number | null;
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
        te.paused_at,
        te.total_paused_time,
        p.name as project_name,
        c.name as client_name,
        c.id as client_id
      FROM time_entries te
      JOIN projects p ON te.project_id = p.id
      JOIN clients c ON p.client_id = c.id
      WHERE te.id = $1`,
      [entryId]
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
        pausedAt: entry.paused_at,
        totalPausedTime: entry.total_paused_time,
      },
    });
  } catch (error) {
    console.error("Error creating entry:", error);
    return NextResponse.json(
      { success: false, message: "שגיאה ביצירת הרשומה" },
      { status: 500 }
    );
  }
}
