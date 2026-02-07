/**
 * POST /api/admin/users/[id]/actions
 * Perform admin actions on a user (reset password, verify email, delete sessions, toggle role)
 */
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getAdminUser } from "@/lib/admin";
import { hashPassword, generateToken } from "@/lib/auth";

interface ActionBody {
  action: "reset_password" | "verify_email" | "delete_sessions" | "toggle_role" | "delete_user";
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json({ success: false, message: "אין הרשאה" }, { status: 403 });
    }

    const { id: userId } = await params;
    const body = (await request.json()) as ActionBody;

    // Verify user exists
    const userResult = await query<{ id: string; email: string; role: string }>(
      "SELECT id, email, role FROM users WHERE id = $1",
      [userId]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json({ success: false, message: "משתמש לא נמצא" }, { status: 404 });
    }

    const targetUser = userResult.rows[0];

    // Prevent admin from modifying themselves with dangerous actions
    if (targetUser.id === admin.id && (body.action === "delete_user" || body.action === "toggle_role")) {
      return NextResponse.json(
        { success: false, message: "לא ניתן לבצע פעולה זו על עצמך" },
        { status: 400 }
      );
    }

    switch (body.action) {
      case "reset_password": {
        const tempPassword = generateToken(8);
        const passwordHash = await hashPassword(tempPassword);
        await query("UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2", [passwordHash, userId]);
        // Delete all sessions to force re-login
        await query("DELETE FROM sessions WHERE user_id = $1", [userId]);
        return NextResponse.json({
          success: true,
          message: "הסיסמה אופסה בהצלחה",
          tempPassword,
        });
      }

      case "verify_email": {
        await query("UPDATE users SET email_verified = TRUE, updated_at = NOW() WHERE id = $1", [userId]);
        return NextResponse.json({ success: true, message: "האימייל אומת בהצלחה" });
      }

      case "delete_sessions": {
        const deleteResult = await query("DELETE FROM sessions WHERE user_id = $1", [userId]);
        return NextResponse.json({
          success: true,
          message: `נמחקו ${deleteResult.rowCount} הפעלות`,
        });
      }

      case "toggle_role": {
        const newRole = targetUser.role === "admin" ? "user" : "admin";
        await query("UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2", [newRole, userId]);
        return NextResponse.json({
          success: true,
          message: `התפקיד שונה ל-${newRole}`,
          newRole,
        });
      }

      case "delete_user": {
        // Delete in order: sessions, profiles, entries, projects, clients, user
        await query("DELETE FROM sessions WHERE user_id = $1", [userId]);
        await query("DELETE FROM user_profiles WHERE user_id = $1", [userId]);
        await query("DELETE FROM time_entries WHERE user_id = $1", [userId]);
        await query("DELETE FROM projects WHERE user_id = $1", [userId]);
        await query("DELETE FROM clients WHERE user_id = $1", [userId]);
        await query("DELETE FROM custom_tags WHERE user_id = $1", [userId]);
        await query("DELETE FROM report_presets WHERE user_id = $1", [userId]);
        await query("DELETE FROM password_reset_tokens WHERE user_id = $1", [userId]);
        await query("DELETE FROM email_verification_tokens WHERE user_id = $1", [userId]);
        await query("DELETE FROM users WHERE id = $1", [userId]);
        return NextResponse.json({ success: true, message: "המשתמש נמחק בהצלחה" });
      }

      default:
        return NextResponse.json({ success: false, message: "פעולה לא מוכרת" }, { status: 400 });
    }
  } catch (error) {
    console.error("Admin action error:", error);
    return NextResponse.json({ success: false, message: "שגיאת שרת" }, { status: 500 });
  }
}
