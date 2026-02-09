import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";

/**
 * GET /api/projects
 * Returns all projects for the authenticated user
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

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status"); // "active", "archived", "all", or null (default: exclude archived)

    const { query } = await import("@/lib/db");

    // Build WHERE clause based on status filter
    let whereClause = "";
    const params: (string | number | boolean | null)[] = [user.id];

    if (statusFilter === "archived") {
      whereClause = "AND p.status = 'archived'";
    } else if (statusFilter === "all") {
      // Show all projects, no additional filter
    } else {
      // Default: exclude archived projects
      whereClause = "AND p.status != 'archived'";
    }

    // Get all projects for the user with client info
    const result = await query<{
      id: string;
      name: string;
      client_id: string;
      client_name: string;
      status: string;
      start_date: string | null;
      end_date: string | null;
      notes: string | null;
      created_at: string;
    }>(
      `SELECT p.id, p.name, p.client_id, c.name as client_name,
              p.status, p.start_date, p.end_date, p.notes, p.created_at
       FROM projects p
       JOIN clients c ON p.client_id = c.id
       WHERE p.user_id = $1 ${whereClause}
       ORDER BY p.created_at DESC`,
      params
    );

    const projects = result.rows.map((project) => ({
      id: project.id,
      name: project.name,
      clientId: project.client_id,
      clientName: project.client_name,
      status: project.status,
      startDate: project.start_date,
      endDate: project.end_date,
      notes: project.notes,
      createdAt: project.created_at,
    }));

    return NextResponse.json({
      success: true,
      projects,
    }, {
      headers: {
        'Cache-Control': 'private, max-age=60, stale-while-revalidate=120'
      }
    });
  } catch (error) {
    console.error("Error fetching projects:", error);
    return NextResponse.json(
      { success: false, message: "שגיאה בטעינת הפרויקטים" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects
 * Create a new project
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
    const {
      clientId,
      name,
      status,
      startDate,
      endDate,
      notes,
    } = body;

    // Validation
    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, message: "יש להזין שם פרויקט" },
        { status: 400 }
      );
    }

    if (!clientId || clientId.trim().length === 0) {
      return NextResponse.json(
        { success: false, message: "יש לבחור לקוח" },
        { status: 400 }
      );
    }

    if (name.length > 200) {
      return NextResponse.json(
        { success: false, message: "שם הפרויקט ארוך מדי (מקסימום 200 תווים)" },
        { status: 400 }
      );
    }

    if (status && !["active", "completed", "paused", "archived"].includes(status)) {
      return NextResponse.json(
        { success: false, message: "סטטוס לא חוקי" },
        { status: 400 }
      );
    }

    const { query } = await import("@/lib/db");

    // Verify the client belongs to this user
    const clientCheck = await query<{ id: string }>(
      `SELECT id FROM clients WHERE id = $1 AND user_id = $2`,
      [clientId, user.id]
    );

    if (clientCheck.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: "הלקוח לא נמצא" },
        { status: 404 }
      );
    }

    // Insert project
    const insertResult = await query<{ id: string }>(
      `INSERT INTO projects (id, user_id, client_id, name, status, start_date, end_date, notes)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        user.id,
        clientId,
        name.trim(),
        status || "active",
        startDate || null,
        endDate || null,
        notes?.trim() || null,
      ]
    );

    const projectId = insertResult.rows[0].id;

    // Fetch the created project with client info
    const projectResult = await query<{
      id: string;
      name: string;
      client_id: string;
      client_name: string;
      status: string;
      start_date: string | null;
      end_date: string | null;
      notes: string | null;
      created_at: string;
    }>(
      `SELECT p.id, p.name, p.client_id, c.name as client_name,
              p.status, p.start_date, p.end_date, p.notes, p.created_at
       FROM projects p
       JOIN clients c ON p.client_id = c.id
       WHERE p.id = $1`,
      [projectId]
    );

    const project = projectResult.rows[0];

    return NextResponse.json({
      success: true,
      project: {
        id: project.id,
        name: project.name,
        clientId: project.client_id,
        clientName: project.client_name,
        status: project.status,
        startDate: project.start_date,
        endDate: project.end_date,
        notes: project.notes,
        createdAt: project.created_at,
      },
    });
  } catch (error) {
    console.error("Error creating project:", error);
    return NextResponse.json(
      { success: false, message: "שגיאה ביצירת הפרויקט" },
      { status: 500 }
    );
  }
}
