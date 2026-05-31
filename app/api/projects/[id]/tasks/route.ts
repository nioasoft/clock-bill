import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { parseBody } from "@/lib/api-validation";

/** Body schema for creating a task. */
const createTaskSchema = z.object({
  name: z
    .string({ message: "נא להזין שם משימה" })
    .trim()
    .min(1, "נא להזין שם משימה")
    .max(500),
  description: z.string().max(5000).nullish(),
  status: z.enum(["todo", "in_progress", "done"], { message: "סטטוס לא תקין" }).nullish(),
});

/**
 * GET /api/projects/[id]/tasks
 * List tasks for a project, ordered by status then date
 */
export async function GET(
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

    const { id: projectId } = await params;

    // Verify project belongs to user
    const projectCheck = await query<{ id: string }>(
      `SELECT id FROM projects WHERE id = $1 AND user_id = $2`,
      [projectId, user.id]
    );

    if (projectCheck.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: "הפרויקט לא נמצא" },
        { status: 404 }
      );
    }

    const result = await query<{
      id: string;
      project_id: string;
      name: string;
      description: string | null;
      status: string;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT id, project_id, name, description, status, created_at, updated_at
       FROM tasks
       WHERE project_id = $1 AND user_id = $2
       ORDER BY
         CASE status
           WHEN 'in_progress' THEN 0
           WHEN 'todo' THEN 1
           WHEN 'done' THEN 2
         END,
         created_at DESC`,
      [projectId, user.id]
    );

    const tasks = result.rows.map((t) => ({
      id: t.id,
      projectId: t.project_id,
      name: t.name,
      description: t.description,
      status: t.status,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
    }));

    return NextResponse.json({ success: true, tasks });
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return NextResponse.json(
      { success: false, message: "שגיאה בטעינת המשימות" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects/[id]/tasks
 * Create a new task for a project
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

    const { id: projectId } = await params;
    const parsed = await parseBody(request, createTaskSchema);
    if (!parsed.ok) return parsed.response;
    const { name, description, status } = parsed.data;

    // Verify project belongs to user
    const projectCheck = await query<{ id: string }>(
      `SELECT id FROM projects WHERE id = $1 AND user_id = $2`,
      [projectId, user.id]
    );

    if (projectCheck.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: "הפרויקט לא נמצא" },
        { status: 404 }
      );
    }

    const taskStatus = status || "todo";

    const result = await query<{
      id: string;
      project_id: string;
      name: string;
      description: string | null;
      status: string;
      created_at: string;
      updated_at: string;
    }>(
      `INSERT INTO tasks (id, project_id, user_id, name, description, status)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5)
       RETURNING id, project_id, name, description, status, created_at, updated_at`,
      [projectId, user.id, name.trim(), description?.trim() || null, taskStatus]
    );

    const task = result.rows[0];

    return NextResponse.json({
      success: true,
      task: {
        id: task.id,
        projectId: task.project_id,
        name: task.name,
        description: task.description,
        status: task.status,
        createdAt: task.created_at,
        updatedAt: task.updated_at,
      },
    });
  } catch (error) {
    console.error("Error creating task:", error);
    return NextResponse.json(
      { success: false, message: "שגיאה ביצירת המשימה" },
      { status: 500 }
    );
  }
}
