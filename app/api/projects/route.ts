import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getUser } from "@/lib/auth";

/**
 * GET /api/projects
 * Returns all projects for the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const userId = user.id;

    // Get all projects for the user with client info
    const result = await query<{
      id: string;
      name: string;
      client_id: string;
      client_name: string;
      status: string;
    }>(
      `SELECT p.id, p.name, p.client_id, c.name as client_name, p.status
       FROM projects p
       JOIN clients c ON p.client_id = c.id
       WHERE p.user_id = $1
       ORDER BY p.created_at DESC`,
      [userId]
    );

    return NextResponse.json({
      success: true,
      projects: result.rows.map(p => ({
        id: p.id,
        name: p.name,
        clientId: p.client_id,
        clientName: p.client_name,
        status: p.status
      }))
    });
  } catch (error) {
    console.error("Error fetching projects:", error);
    return NextResponse.json(
      { success: false, message: "שגיאה בטעינת הפרויקטים" },
      { status: 500 }
    );
  }
}
