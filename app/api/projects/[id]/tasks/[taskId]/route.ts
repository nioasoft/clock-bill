import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { query } from "@/lib/db";

type RouteContext = {
  params: Promise<{ id: string; taskId: string }>;
};

/**
 * PUT /api/projects/[id]/tasks/[taskId]
 * Update a task's name, description, or status
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

    const { id: projectId, taskId } = await context.params;
    const body = await request.json();
    const { name, description, status } = body;

    // Verify task belongs to user's project
    const taskCheck = await query<{ id: string }>(
      `SELECT t.id FROM tasks t
       JOIN projects p ON t.project_id = p.id
       WHERE t.id = $1 AND t.project_id = $2 AND p.user_id = $3`,
      [taskId, projectId, user.id]
    );

    if (taskCheck.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: "המשימה לא נמצאה" },
        { status: 404 }
      );
    }

    if (status && !["todo", "in_progress", "done"].includes(status)) {
      return NextResponse.json(
        { success: false, message: "סטטוס לא תקין" },
        { status: 400 }
      );
    }

    // Build dynamic update query
    const updates: string[] = [];
    const values: (string | null)[] = [];
    let paramIdx = 1;

    if (name !== undefined) {
      if (!name || name.trim().length === 0) {
        return NextResponse.json(
          { success: false, message: "נא להזין שם משימה" },
          { status: 400 }
        );
      }
      updates.push(`name = $${paramIdx}`);
      values.push(name.trim());
      paramIdx++;
    }

    if (description !== undefined) {
      updates.push(`description = $${paramIdx}`);
      values.push(description?.trim() || null);
      paramIdx++;
    }

    if (status !== undefined) {
      updates.push(`status = $${paramIdx}`);
      values.push(status);
      paramIdx++;
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, message: "לא סופקו שדות לעדכון" },
        { status: 400 }
      );
    }

    updates.push(`updated_at = NOW()`);

    values.push(taskId);
    const result = await query<{
      id: string;
      project_id: string;
      name: string;
      description: string | null;
      status: string;
      created_at: string;
      updated_at: string;
    }>(
      `UPDATE tasks SET ${updates.join(", ")} WHERE id = $${paramIdx} RETURNING id, project_id, name, description, status, created_at, updated_at`,
      values
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
    console.error("Error updating task:", error);
    return NextResponse.json(
      { success: false, message: "שגיאה בעדכון המשימה" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/projects/[id]/tasks/[taskId]
 * Delete a task (time entries get task_id=NULL via ON DELETE SET NULL)
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

    const { id: projectId, taskId } = await context.params;

    // Verify task belongs to user's project
    const taskCheck = await query<{ id: string }>(
      `SELECT t.id FROM tasks t
       JOIN projects p ON t.project_id = p.id
       WHERE t.id = $1 AND t.project_id = $2 AND p.user_id = $3`,
      [taskId, projectId, user.id]
    );

    if (taskCheck.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: "המשימה לא נמצאה" },
        { status: 404 }
      );
    }

    await query(`DELETE FROM tasks WHERE id = $1`, [taskId]);

    return NextResponse.json({
      success: true,
      message: "המשימה נמחקה בהצלחה",
    });
  } catch (error) {
    console.error("Error deleting task:", error);
    return NextResponse.json(
      { success: false, message: "שגיאה במחיקת המשימה" },
      { status: 500 }
    );
  }
}
