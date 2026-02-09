import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";

/**
 * POST /api/projects/[id]/duplicate
 * Duplicate an existing project
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, message: "לא מחובר" },
        { status: 401 }
      );
    }

    const { query } = await import("@/lib/db");
    const { id: projectId } = await params;

    // Get the original project
    const originalResult = await query<{
      id: string;
      name: string;
      client_id: string;
      status: string;
      start_date: string | null;
      end_date: string | null;
      notes: string | null;
    }>(
      `SELECT id, name, client_id, status, start_date, end_date, notes
       FROM projects
       WHERE id = $1 AND user_id = $2`,
      [projectId, user.id]
    );

    if (originalResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: "הפרויקט לא נמצא" },
        { status: 404 }
      );
    }

    const original = originalResult.rows[0];

    // Generate a new name with "(העתק)" suffix
    let newName = `${original.name} (העתק)`;

    // Check if a project with that name already exists, if so add a number
    let suffix = 1;
    let nameExists = true;
    while (nameExists) {
      const checkResult = await query<{ exists: boolean }>(
        `SELECT EXISTS(SELECT 1 FROM projects WHERE name = $1 AND user_id = $2) as exists`,
        [newName, user.id]
      );

      if (!checkResult.rows[0].exists) {
        nameExists = false;
      } else {
        suffix++;
        newName = `${original.name} (העתק ${suffix})`;
      }
    }

    // Insert the duplicated project (with active status and cleared dates)
    const insertResult = await query<{ id: string }>(
      `INSERT INTO projects (id, user_id, client_id, name, status, start_date, end_date, notes)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        user.id,
        original.client_id,
        newName,
        "active",
        null,
        null,
        original.notes,
      ]
    );

    const newProjectId = insertResult.rows[0].id;

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
      [newProjectId]
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
    console.error("Error duplicating project:", error);
    return NextResponse.json(
      { success: false, message: "שגיאה בשכפול הפרויקט" },
      { status: 500 }
    );
  }
}
