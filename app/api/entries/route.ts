import { NextRequest, NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { getUser } from "@/lib/auth";
import { parseBody } from "@/lib/api-validation";
import { entryBodySchema } from "@/lib/schemas/entries";

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
        { success: false, error_code: "UNAUTHORIZED", message: "לא מחובר" },
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

    // Build query with filters. The total (for pagination metadata) comes from a
    // COUNT(*) OVER() window on the same statement — no separate count round-trip.
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
        te.billing_kind,
        te.rate,
        te.rate_label,
        te.quantity,
        te.item_ref,
        te.unit,
        COUNT(*) OVER() AS total_count,
        p.name as project_name,
        c.name as client_name,
        c.id as client_id,
        c.currency as currency,
        tk.title as task_name
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
      billing_kind: string | null;
      rate: number | null;
      rate_label: string | null;
      quantity: number | null;
      item_ref: number | null;
      unit: string | null;
      total_count: string;
      project_name: string;
      client_name: string;
      client_id: string;
      currency: string | null;
      task_name: string | null;
    }>(queryText, queryParams);

    const total = parseInt(result.rows[0]?.total_count || "0", 10);

    const entries = result.rows.map((entry) => ({
      id: entry.id,
      projectId: entry.project_id,
      projectName: entry.project_name,
      clientId: entry.client_id,
      clientName: entry.client_name,
      currency: entry.currency || "ILS",
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
      billingKind: entry.billing_kind ?? "hourly",
      rate: entry.rate,
      rateLabel: entry.rate_label,
      quantity: entry.quantity,
      itemRef: entry.item_ref,
      unit: entry.unit,
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
      { success: false, error_code: "SERVER_ERROR", message: "שגיאה בטעינת הרשומות" },
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
        { success: false, error_code: "UNAUTHORIZED", message: "לא מחובר" },
        { status: 401 }
      );
    }

    const parsed = await parseBody(request, entryBodySchema);
    if (!parsed.ok) return parsed.response;
    const { projectId, taskId, date, duration, description, notes, isBillable, tags, billingKind, rate, rateLabel, quantity, unit } = parsed.data;
    const kind = billingKind ?? "hourly";
    const isItem = kind === "item";
    const effectiveDuration = isItem ? 0 : duration;

    // startTime = now, endTime = now + duration minutes (manual entries)
    const now = new Date();
    const endTime = new Date(now.getTime() + effectiveDuration * 60 * 1000);

    const { withTransaction } = await import("@/lib/db");

    // One transaction (one tenant-context bind): ownership check → assign the
    // per-user item_ref (item lines only) → INSERT ... RETURNING joined names.
    const result = await withTransaction(async (client: PoolClient) => {
      const projectCheck = await client.query<{ id: string }>(
        `SELECT p.id FROM projects p
         JOIN clients c ON p.client_id = c.id
         WHERE p.id = $1 AND c.user_id = $2`,
        [projectId, user.id]
      );
      if (projectCheck.rows.length === 0) {
        return { notFound: true as const };
      }

      // Item lines get a stable, per-user, never-reused reference number.
      // Atomic upsert on the user's counter; creates a minimal profile row if
      // none exists yet (id + user_id are the only required columns).
      let itemRef: number | null = null;
      if (isItem) {
        const ref = await client.query<{ assigned: number }>(
          `INSERT INTO user_profiles (id, user_id, next_item_ref)
           VALUES (gen_random_uuid()::text, $1, 2)
           ON CONFLICT (user_id) DO UPDATE SET next_item_ref = user_profiles.next_item_ref + 1
           RETURNING (next_item_ref - 1) AS assigned`,
          [user.id]
        );
        itemRef = ref.rows[0].assigned;
      }

      const inserted = await client.query<CreatedRow>(
        `WITH ins AS (
           INSERT INTO time_entries
             (id, user_id, project_id, task_id, description, start_time, end_time, duration, date, tags, notes, is_billable, billing_kind, rate, rate_label, quantity, item_ref, unit)
           VALUES
             (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
           RETURNING *
         )
         SELECT
           ins.id, ins.project_id, ins.description, ins.start_time, ins.end_time,
           ins.duration, ins.date, ins.tags, ins.notes, ins.is_billable, ins.created_at,
           ins.paused_at, ins.total_paused_time, ins.task_id, ins.billing_kind,
           ins.rate, ins.rate_label, ins.quantity, ins.item_ref, ins.unit,
           p.name as project_name, c.name as client_name, c.id as client_id, tk.title as task_name
         FROM ins
         JOIN projects p ON ins.project_id = p.id
         JOIN clients c ON p.client_id = c.id
         LEFT JOIN tasks tk ON ins.task_id = tk.id`,
        [
          user.id,
          projectId,
          taskId || null,
          description.trim(),
          now.toISOString(),
          endTime.toISOString(),
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
        ]
      );
      return { row: inserted.rows[0] };
    });

    if ("notFound" in result) {
      return NextResponse.json(
        { success: false, error_code: "PROJECT_NOT_FOUND", message: "הפרויקט לא נמצא" },
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
        pausedAt: entry.paused_at,
        totalPausedTime: entry.total_paused_time,
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
    console.error("Error creating entry:", error);
    return NextResponse.json(
      { success: false, error_code: "SERVER_ERROR", message: "שגיאה ביצירת הרשומה" },
      { status: 500 }
    );
  }
}

/** Shape returned by the create CTE (time_entries.* + joined names). */
interface CreatedRow {
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
