import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";

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
      return NextResponse.json({ success: false, message: "לא מחובר" }, { status: 401 });
    }
    const { query } = await import("@/lib/db");
    const { id: clientId } = await params;

    const result = await query<{
      id: string; kind: string; name: string; rate: number; is_default: boolean;
    }>(
      `SELECT id, kind, name, rate, is_default
       FROM client_rates WHERE client_id = $1 AND user_id = $2
       ORDER BY kind, is_default DESC, name`,
      [clientId, user.id]
    );

    return NextResponse.json({
      success: true,
      rates: result.rows.map((r) => ({
        id: r.id, kind: r.kind as "hourly" | "item", name: r.name, rate: r.rate, isDefault: r.is_default,
      })),
    }, { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" } });
  } catch (error) {
    console.error("Error fetching client rates:", error);
    return NextResponse.json({ success: false, message: "שגיאה בטעינת התעריפים" }, { status: 500 });
  }
}
