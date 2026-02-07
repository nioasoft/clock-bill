/**
 * GET /api/admin/users
 * Returns paginated user list with search
 */
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getAdminUser } from "@/lib/admin";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json({ success: false, message: "אין הרשאה" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const offset = (page - 1) * limit;

    let whereClause = "";
    const params: unknown[] = [];

    if (search) {
      params.push(`%${search}%`);
      whereClause = `WHERE u.email ILIKE $1 OR COALESCE(up.business_name, '') ILIKE $1`;
    }

    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count
       FROM users u
       LEFT JOIN user_profiles up ON u.id = up.user_id
       ${whereClause}`,
      params
    );

    const totalCount = parseInt(countResult.rows[0].count);

    const usersResult = await query<{
      id: string;
      email: string;
      role: string;
      created_at: string;
      business_name: string | null;
      entry_count: string;
      project_count: string;
      last_entry_date: string | null;
    }>(
      `SELECT
         u.id,
         u.email,
         u.role,
         u.created_at,
         up.business_name,
         (SELECT COUNT(*) FROM time_entries te WHERE te.user_id = u.id) as entry_count,
         (SELECT COUNT(*) FROM projects p WHERE p.user_id = u.id) as project_count,
         (SELECT MAX(date) FROM time_entries te WHERE te.user_id = u.id) as last_entry_date
       FROM users u
       LEFT JOIN user_profiles up ON u.id = up.user_id
       ${whereClause}
       ORDER BY u.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    return NextResponse.json({
      success: true,
      users: usersResult.rows.map((u) => ({
        id: u.id,
        email: u.email,
        role: u.role ?? "user",
        createdAt: u.created_at,
        businessName: u.business_name,
        entryCount: parseInt(u.entry_count),
        projectCount: parseInt(u.project_count),
        lastEntryDate: u.last_entry_date,
      })),
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error("Admin users error:", error);
    return NextResponse.json({ success: false, message: "שגיאת שרת" }, { status: 500 });
  }
}
