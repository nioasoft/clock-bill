import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";

/** Default and maximum page size for the entries list to bound query cost. */
const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 1000;

/**
 * GET /api/entries
 * List time entries for the authenticated user (paginated).
 * Accepts optional ?limit & ?offset; returns pagination metadata so the client
 * can tell when more rows exist instead of silently truncating.
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

    // Pagination params (bounded to protect the DB from unbounded scans)
    const limit = Math.min(
      Math.max(parseInt(searchParams.get("limit") || `${DEFAULT_LIMIT}`, 10) || DEFAULT_LIMIT, 1),
      MAX_LIMIT
    );
    const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10) || 0, 0);

    // Build shared WHERE clause + params for both the count and the page query
    let whereClause = ` WHERE te.user_id = $1`;
    const filterParams: (string | number | boolean | null)[] = [user.id];
    let filterIndex = 2;

    if (clientId) {
      whereClause += ` AND c.id = $${filterIndex}`;
      filterParams.push(clientId);
      filterIndex++;
    }

    if (projectId) {
      whereClause += ` AND p.id = $${filterIndex}`;
      filterParams.push(projectId);
      filterIndex++;
    }

    if (startDate) {
      whereClause += ` AND te.date >= $${filterIndex}`;
      filterParams.push(startDate);
      filterIndex++;
    }

    if (endDate) {
      whereClause += ` AND te.date <= $${filterIndex}`;
      filterParams.push(endDate);
      filterIndex++;
    }

    // Total count for pagination metadata
    const countResult = await query<{ total: string }>(
      `SELECT COUNT(*) as total
       FROM time_entries te
       JOIN projects p ON te.project_id = p.id
       JOIN clients c ON p.client_id = c.id${whereClause}`,
      filterParams
    );
    const total = parseInt(countResult.rows[0]?.total || "0", 10);

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
        te.task_id,
        p.name as project_name,
        c.name as client_name,
        c.id as client_id,
        tk.name as task_name
      FROM time_entries te
      JOIN projects p ON te.project_id = p.id
      JOIN clients c ON p.client_id = c.id
      LEFT JOIN tasks tk ON te.task_id = tk.id${whereClause}`;
    const queryParams: (string | number | boolean | null)[] = [...filterParams];

    queryText += ` ORDER BY te.date DESC, te.created_at DESC`;
    queryText += ` LIMIT $${filterIndex} OFFSET $${filterIndex + 1}`;
    queryParams.push(limit, offset);

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
      task_id: string | null;
      project_name: string;
      client_name: string;
      client_id: string;
      task_name: string | null;
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
      taskId: entry.task_id,
      taskName: entry.task_name,
    }));

    return NextResponse.json({
      success: true,
      entries,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + entries.length < total,
      },
    }, {
      headers: {
        'Cache-Control': 'private, max-age=10, stale-while-revalidate=30'
      }
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
    const { projectId, taskId, date, duration, description, notes, isBillable, tags } = body;

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

    // Calculate start/end times for manual entries
    // startTime = now, endTime = now + duration minutes
    const now = new Date();
    const endTime = new Date(now.getTime() + duration * 60 * 1000);

    await query(
      `INSERT INTO time_entries (id, user_id, project_id, task_id, description, start_time, end_time, duration, date, tags, notes, is_billable)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        entryId,
        user.id,
        projectId,
        taskId || null,
        description.trim(),
        now.toISOString(),
        endTime.toISOString(),
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
      task_id: string | null;
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
        te.paused_at,
        te.total_paused_time,
        te.task_id,
        p.name as project_name,
        c.name as client_name,
        c.id as client_id,
        tk.name as task_name
      FROM time_entries te
      JOIN projects p ON te.project_id = p.id
      JOIN clients c ON p.client_id = c.id
      LEFT JOIN tasks tk ON te.task_id = tk.id
      WHERE te.id = $1 AND te.user_id = $2`,
      [entryId, user.id]
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
        taskId: entry.task_id,
        taskName: entry.task_name,
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
