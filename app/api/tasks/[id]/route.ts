import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { parseBody } from "@/lib/api-validation";
import { updateTaskSchema } from "@/lib/schemas/tasks";
import { createLogger } from "@/lib/logger";

const logger = createLogger("tasks:item");

/** PATCH /api/tasks/[id] — edit fields. Re-snapshots rate if rateId changes. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ success: false, message: "לא מחובר" }, { status: 401 });

    const { id } = await params;
    const parsed = await parseBody(request, updateTaskSchema);
    if (!parsed.ok) return parsed.response;
    const data = parsed.data;

    const { withTransaction } = await import("@/lib/db");

    // All existence/FK-ownership checks + the final UPDATE share ONE connection +
    // ONE begin/commit. Each step runs as client.query() inside the transaction.
    // Conditional 404s return a NextResponse out of the callback; the wrapping
    // try/catch handles rollback on throw.
    return await withTransaction(async (client) => {
      const existing = await client.query<{ id: string; client_id: string }>(
        `SELECT id, client_id FROM tasks WHERE id = $1 AND user_id = $2`,
        [id, user.id]
      );
      if (existing.rows.length === 0)
        return NextResponse.json({ success: false, message: "המשימה לא נמצאה" }, { status: 404 });

      // Effective client: the new client_id if provided, otherwise the task's current one.
      // Computed once and reused for FK ownership checks and rate re-validation.
      const effectiveClientId = data.clientId ?? existing.rows[0].client_id;

      // BOLA guard: never trust client_id/project_id from the body — verify ownership.
      if (data.clientId !== undefined) {
        const c = await client.query<{ id: string }>(
          `SELECT id FROM clients WHERE id = $1 AND user_id = $2`,
          [data.clientId, user.id]
        );
        if (c.rows.length === 0)
          return NextResponse.json({ success: false, message: "הלקוח לא נמצא" }, { status: 404 });
      }

      if (data.projectId !== undefined) {
        const p = await client.query<{ id: string }>(
          `SELECT id FROM projects WHERE id = $1 AND client_id = $2 AND user_id = $3`,
          [data.projectId, effectiveClientId, user.id]
        );
        if (p.rows.length === 0)
          return NextResponse.json({ success: false, message: "הפרויקט לא נמצא" }, { status: 404 });
      }

      let rateSnapshot: { id: string; rate: number; name: string } | null = null;
      if (data.rateId) {
        const r = await client.query<{ id: string; rate: number; name: string }>(
          `SELECT id, rate, name FROM client_rates
           WHERE id = $1 AND client_id = $2 AND user_id = $3 AND kind = 'hourly'`,
          [data.rateId, effectiveClientId, user.id]
        );
        if (r.rows.length === 0)
          return NextResponse.json({ success: false, message: "התעריף לא נמצא" }, { status: 404 });
        rateSnapshot = r.rows[0];
      }

      const sets: string[] = [];
      const vals: unknown[] = [];
      let i = 1;
      const set = (col: string, v: unknown) => { sets.push(`${col} = $${i++}`); vals.push(v); };

      if (data.clientId !== undefined) set("client_id", data.clientId);
      if (data.projectId !== undefined) set("project_id", data.projectId);
      if (rateSnapshot) { set("rate_id", rateSnapshot.id); set("rate", rateSnapshot.rate); set("rate_label", rateSnapshot.name); }
      if (data.title !== undefined) set("title", data.title);
      if (data.notes !== undefined) set("notes", data.notes ?? null);
      if (data.priority !== undefined) set("priority", data.priority);
      if (data.dueDate !== undefined) set("due_date", data.dueDate ?? null);
      if (data.tags !== undefined) { sets.push(`tags = $${i++}::jsonb`); vals.push(JSON.stringify(data.tags)); }

      if (sets.length === 0)
        return NextResponse.json({ success: true, id });

      sets.push(`updated_at = NOW()`);
      vals.push(id, user.id);
      const updated = await client.query<{ id: string }>(
        `UPDATE tasks SET ${sets.join(", ")} WHERE id = $${i++} AND user_id = $${i++} RETURNING id`,
        vals
      );
      if (updated.rows.length === 0)
        return NextResponse.json({ success: false, message: "המשימה לא נמצאה" }, { status: 404 });

      return NextResponse.json({ success: true, id });
    });
  } catch (error) {
    logger.error("Failed to update task", error);
    return NextResponse.json({ success: false, message: "שגיאה בעדכון המשימה" }, { status: 500 });
  }
}

/** DELETE /api/tasks/[id] — remove a task. time_entries.task_id is SET NULL by FK. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ success: false, message: "לא מחובר" }, { status: 401 });

    const { id } = await params;
    const { query } = await import("@/lib/db");

    const result = await query<{ id: string }>(
      `DELETE FROM tasks WHERE id = $1 AND user_id = $2 RETURNING id`,
      [id, user.id]
    );
    if (result.rows.length === 0)
      return NextResponse.json({ success: false, message: "המשימה לא נמצאה" }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Failed to delete task", error);
    return NextResponse.json({ success: false, message: "שגיאה במחיקת המשימה" }, { status: 500 });
  }
}
