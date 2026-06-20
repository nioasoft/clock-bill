import { createLogger } from "@/lib/logger";
const logger = createLogger("api:clients:id:rates");
import { NextRequest, NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { getUser } from "@/lib/auth";
import { parseBody } from "@/lib/api-validation";
import { addClientItemSchema } from "@/lib/schemas/rates";

/**
 * GET /api/clients/[id]/rates
 * Lightweight list of a client's rates/items, for the timer & entry pickers.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ success: false, error_code: "UNAUTHORIZED", message: "לא מחובר" }, { status: 401 });
    }
    const { query } = await import("@/lib/db");
    const { id: clientId } = await params;

    // ?projectId= narrows to rates visible on that project: general rows
    // (project_id IS NULL) plus rows scoped to it. An empty value yields
    // general rows only; absent param keeps the full list (editor views).
    const projectId = request.nextUrl.searchParams.get("projectId");

    const result = await query<{
      id: string; kind: string; name: string; rate: number; is_default: boolean; unit: string | null; project_id: string | null;
    }>(
      projectId === null
        ? `SELECT id, kind, name, rate, is_default, unit, project_id
           FROM client_rates WHERE client_id = $1 AND user_id = $2
           ORDER BY kind, is_default DESC, name`
        : `SELECT id, kind, name, rate, is_default, unit, project_id
           FROM client_rates WHERE client_id = $1 AND user_id = $2
             AND (project_id IS NULL OR project_id = $3)
           ORDER BY kind, is_default DESC, name`,
      projectId === null ? [clientId, user.id] : [clientId, user.id, projectId]
    );

    return NextResponse.json({
      success: true,
      rates: result.rows.map((r) => ({
        id: r.id, kind: r.kind as "hourly" | "item", name: r.name, rate: r.rate, isDefault: r.is_default, unit: r.unit, projectId: r.project_id,
      })),
    }, { headers: { "Cache-Control": "no-store, must-revalidate" } });
  } catch (error) {
    logger.error("Error fetching client rates:", error);
    return NextResponse.json({ success: false, error_code: "SERVER_ERROR", message: "שגיאה בטעינת התעריפים" }, { status: 500 });
  }
}

/**
 * POST /api/clients/[id]/rates
 * Append a single item to the client's definition (the "save item to client"
 * action from an ad-hoc time entry). Create-if-missing: if an item with the same
 * name already exists for this client, the existing one is left untouched (no
 * duplicate, no price change — past billing keeps its own snapshot).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ success: false, error_code: "UNAUTHORIZED", message: "לא מחובר" }, { status: 401 });
    }
    const { id: clientId } = await params;

    const parsed = await parseBody(request, addClientItemSchema);
    if (!parsed.ok) return parsed.response;
    const { name, rate, unit } = parsed.data;

    const { withTransaction } = await import("@/lib/db");

    const result = await withTransaction(async (client: PoolClient) => {
      // Client must belong to the caller.
      const owns = await client.query<{ id: string }>(
        `SELECT id FROM clients WHERE id = $1 AND user_id = $2`,
        [clientId, user.id]
      );
      if (owns.rows.length === 0) return { notFound: true as const };

      const { getLockedClientIds } = await import("@/lib/plan-guard");
      if ((await getLockedClientIds(user.id)).has(clientId)) return { planLocked: true as const };

      // Already defined for this client? Leave it untouched (case-insensitive match).
      const existing = await client.query<{ id: string; name: string; rate: number; unit: string | null }>(
        `SELECT id, name, rate, unit FROM client_rates
         WHERE client_id = $1 AND user_id = $2 AND kind = 'item' AND lower(name) = lower($3)
         LIMIT 1`,
        [clientId, user.id, name]
      );
      if (existing.rows.length > 0) {
        return { rate: existing.rows[0], created: false };
      }

      const inserted = await client.query<{ id: string; name: string; rate: number; unit: string | null }>(
        `INSERT INTO client_rates (id, user_id, client_id, kind, name, rate, is_default, unit)
         VALUES (gen_random_uuid()::text, $1, $2, 'item', $3, $4, false, $5)
         RETURNING id, name, rate, unit`,
        [user.id, clientId, name, rate, unit ?? null]
      );
      return { rate: inserted.rows[0], created: true };
    });

    if ("notFound" in result) {
      return NextResponse.json({ success: false, error_code: "CLIENT_NOT_FOUND", message: "הלקוח לא נמצא" }, { status: 404 });
    }

    const { isPlanLockedSentinel, lockedClientResponse } = await import("@/lib/plan-guard");
    if (isPlanLockedSentinel(result)) return lockedClientResponse();

    return NextResponse.json({
      success: true,
      created: result.created,
      rate: { id: result.rate.id, kind: "item" as const, name: result.rate.name, rate: result.rate.rate, isDefault: false, unit: result.rate.unit ?? null },
    });
  } catch (error) {
    logger.error("Error adding client item:", error);
    return NextResponse.json({ success: false, error_code: "SERVER_ERROR", message: "שגיאה בשמירת הפריט" }, { status: 500 });
  }
}
