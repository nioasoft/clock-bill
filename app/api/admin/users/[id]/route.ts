/**
 * GET /api/admin/users/[id]
 * Returns detailed user information for admin view
 */
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getAdminUser } from "@/lib/admin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json({ success: false, error_code: "FORBIDDEN", message: "אין הרשאה" }, { status: 403 });
    }

    const { id: userId } = await params;

    // Get user info
    const userResult = await query<{
      id: string;
      email: string;
      email_verified: boolean;
      role: string;
      created_at: string;
    }>('SELECT id, email, email_verified, role, created_at FROM "user" WHERE id = $1', [userId]);

    if (userResult.rows.length === 0) {
      return NextResponse.json({ success: false, error_code: "USER_NOT_FOUND", message: "משתמש לא נמצא" }, { status: 404 });
    }

    const user = userResult.rows[0];

    // Run all detail queries in parallel
    const [profileResult, clientsResult, projectsResult, entriesResult, sessionsResult] = await Promise.all([
      query<{
        business_name: string | null;
        phone: string | null;
        email: string | null;
        address: string | null;
        tax_id: string | null;
        website: string | null;
        default_currency: string | null;
        preferred_pdf_template: string | null;
        logo_url: string | null;
      }>(
        `SELECT business_name, phone, email, address, tax_id, website,
                default_currency, preferred_pdf_template, logo_url
         FROM user_profiles WHERE user_id = $1`,
        [userId]
      ),
      query<{
        id: string;
        name: string;
        contact_name: string | null;
        email: string | null;
        is_active: boolean;
        created_at: string;
      }>("SELECT id, name, contact_name, email, is_active, created_at FROM clients WHERE user_id = $1 ORDER BY name", [
        userId,
      ]),
      query<{
        id: string;
        name: string;
        client_id: string;
        status: string;
        created_at: string;
      }>(
        `SELECT p.id, p.name, p.client_id, p.status, p.created_at
         FROM projects p WHERE p.user_id = $1 ORDER BY p.created_at DESC`,
        [userId]
      ),
      query<{
        id: string;
        description: string;
        date: string;
        duration: number;
        start_time: string | null;
        end_time: string | null;
        project_id: string;
      }>(
        `SELECT id, description, date, duration, start_time, end_time, project_id
         FROM time_entries WHERE user_id = $1 ORDER BY date DESC, created_at DESC LIMIT 20`,
        [userId]
      ),
      query<{
        id: string;
        created_at: string;
        expires_at: string;
      }>('SELECT id, created_at, expires_at FROM "session" WHERE user_id = $1 ORDER BY created_at DESC', [userId]),
    ]);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        emailVerified: user.email_verified,
        role: user.role ?? "user",
        createdAt: user.created_at,
      },
      profile: profileResult.rows[0] || null,
      clients: clientsResult.rows,
      projects: projectsResult.rows,
      recentEntries: entriesResult.rows,
      sessions: sessionsResult.rows.map((s) => ({
        id: s.id,
        createdAt: s.created_at,
        expiresAt: s.expires_at,
        isExpired: new Date(s.expires_at) < new Date(),
      })),
    });
  } catch (error) {
    console.error("Admin user detail error:", error);
    return NextResponse.json({ success: false, error_code: "SERVER_ERROR", message: "שגיאת שרת" }, { status: 500 });
  }
}
