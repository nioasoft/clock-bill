import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { parseBody } from "@/lib/api-validation";
import { createTaskSchema } from "@/lib/schemas/tasks";
import { createLogger } from "@/lib/logger";
import type { TaskRecord } from "@/lib/tasks-types";

const logger = createLogger("tasks:list");

/** GET /api/tasks — all of the user's tasks for the board (optional ?projectId). */
export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ success: false, message: "לא מחובר" }, { status: 401 });

    const { query } = await import("@/lib/db");
    const projectId = new URL(request.url).searchParams.get("projectId");

    const params: (string)[] = [user.id];
    let where = " WHERE t.user_id = $1";
    if (projectId) { params.push(projectId); where += ` AND t.project_id = $2`; }

    const result = await query<Record<string, unknown>>(
      `SELECT t.id, t.client_id, c.name AS client_name, t.project_id, p.name AS project_name,
              t.rate_id, t.rate, t.rate_label, t.title, t.notes, t.status, t.priority,
              t.due_date, t.position, t.tags, t.created_at, t.updated_at
       FROM tasks t
       JOIN clients c ON c.id = t.client_id
       JOIN projects p ON p.id = t.project_id
       ${where}
       ORDER BY t.status, t.position ASC`,
      params
    );

    const tasks: TaskRecord[] = result.rows.map((r) => ({
      id: r.id as string,
      clientId: r.client_id as string,
      clientName: r.client_name as string,
      projectId: r.project_id as string,
      projectName: r.project_name as string,
      rateId: (r.rate_id as string) ?? null,
      rate: r.rate === null ? null : Number(r.rate),
      rateLabel: (r.rate_label as string) ?? null,
      title: r.title as string,
      notes: (r.notes as string) ?? null,
      status: r.status as TaskRecord["status"],
      priority: r.priority as TaskRecord["priority"],
      dueDate: r.due_date ? new Date(r.due_date as string).toISOString().slice(0, 10) : null,
      position: Number(r.position),
      tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
      createdAt: (r.created_at as Date)?.toISOString?.() ?? String(r.created_at),
      updatedAt: (r.updated_at as Date)?.toISOString?.() ?? String(r.updated_at),
    }));

    return NextResponse.json({ success: true, tasks });
  } catch (error) {
    logger.error("Failed to list tasks", error);
    return NextResponse.json({ success: false, message: "שגיאה בטעינת המשימות" }, { status: 500 });
  }
}

/** POST /api/tasks — create a task. Verifies the project belongs to the user and
 *  that the rate belongs to the chosen client; snapshots the rate value/label. */
export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ success: false, message: "לא מחובר" }, { status: 401 });

    const parsed = await parseBody(request, createTaskSchema);
    if (!parsed.ok) return parsed.response;
    const { clientId, projectId, rateId, title, notes, priority, dueDate, tags } = parsed.data;

    const { query } = await import("@/lib/db");

    const projectCheck = await query<{ id: string }>(
      `SELECT id FROM projects WHERE id = $1 AND client_id = $2 AND user_id = $3`,
      [projectId, clientId, user.id]
    );
    if (projectCheck.rows.length === 0)
      return NextResponse.json({ success: false, message: "הפרויקט לא נמצא" }, { status: 404 });

    const rateCheck = await query<{ id: string; rate: number; name: string }>(
      `SELECT id, rate, name FROM client_rates
       WHERE id = $1 AND client_id = $2 AND user_id = $3 AND kind = 'hourly'`,
      [rateId, clientId, user.id]
    );
    if (rateCheck.rows.length === 0)
      return NextResponse.json({ success: false, message: "התעריף לא נמצא" }, { status: 404 });
    const chosen = rateCheck.rows[0];

    const minPos = await query<{ min: number | null }>(
      `SELECT MIN(position) AS min FROM tasks WHERE user_id = $1 AND status = 'todo'`,
      [user.id]
    );
    const position = (minPos.rows[0]?.min ?? 1000) - 1000;

    const result = await query<{ id: string }>(
      `INSERT INTO tasks
         (id, user_id, client_id, project_id, rate_id, rate, rate_label, title, notes,
          status, priority, due_date, position, tags)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8,
               'todo', $9, $10, $11, $12::jsonb)
       RETURNING id`,
      [user.id, clientId, projectId, chosen.id, chosen.rate, chosen.name,
       title, notes ?? null, priority, dueDate ?? null, position, JSON.stringify(tags)]
    );

    return NextResponse.json({ success: true, id: result.rows[0].id });
  } catch (error) {
    logger.error("Failed to create task", error);
    return NextResponse.json({ success: false, message: "שגיאה ביצירת המשימה" }, { status: 500 });
  }
}
