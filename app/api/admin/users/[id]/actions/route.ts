/**
 * POST /api/admin/users/[id]/actions
 * Perform admin actions on a user (reset password, verify email, delete
 * sessions, toggle role, delete user).
 *
 * Identity is backed by Better Auth: the `user`, `session` and `account`
 * tables (singular). Passwords live in `account` (provider_id='credential'),
 * managed by Better Auth — see the `reset_password` case for why a raw reset
 * is not supported here.
 */
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getAdminUser } from "@/lib/admin";

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

    // Verify user exists (Better Auth `user` table — "user" is a reserved word).
    const userResult = await query<{ id: string; email: string; role: string }>(
      'SELECT id, email, role FROM "user" WHERE id = $1',
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
        // Better Auth stores credential passwords in the `account` table using
        // its own hashing scheme. The admin plugin (auth.api.setUserPassword)
        // is not enabled on this instance, so we cannot safely set a new
        // password without corrupting the account. Disable this action and
        // direct admins to the self-service "forgot password" flow instead.
        return NextResponse.json(
          {
            success: false,
            message:
              "איפוס סיסמה ידני אינו נתמך. יש להפנות את המשתמש לתהליך 'שכחתי סיסמה'.",
          },
          { status: 400 }
        );
      }

      case "verify_email": {
        await query('UPDATE "user" SET email_verified = TRUE, updated_at = NOW() WHERE id = $1', [userId]);
        return NextResponse.json({ success: true, message: "האימייל אומת בהצלחה" });
      }

      case "delete_sessions": {
        const deleteResult = await query('DELETE FROM "session" WHERE user_id = $1', [userId]);
        return NextResponse.json({
          success: true,
          message: `נמחקו ${deleteResult.rowCount} הפעלות`,
        });
      }

      case "toggle_role": {
        const newRole = targetUser.role === "admin" ? "user" : "admin";
        await query('UPDATE "user" SET role = $1, updated_at = NOW() WHERE id = $2', [newRole, userId]);
        return NextResponse.json({
          success: true,
          message: `התפקיד שונה ל-${newRole}`,
          newRole,
        });
      }

      case "delete_user": {
        // Delete Better Auth identity rows (account, session) and all app data,
        // then the user. App data tables key off the loose `user_id` text column.
        await query('DELETE FROM "session" WHERE user_id = $1', [userId]);
        await query('DELETE FROM "account" WHERE user_id = $1', [userId]);
        await query("DELETE FROM user_profiles WHERE user_id = $1", [userId]);
        await query("DELETE FROM time_entries WHERE user_id = $1", [userId]);
        await query("DELETE FROM projects WHERE user_id = $1", [userId]);
        await query("DELETE FROM clients WHERE user_id = $1", [userId]);
        await query("DELETE FROM custom_tags WHERE user_id = $1", [userId]);
        await query("DELETE FROM report_presets WHERE user_id = $1", [userId]);
        await query('DELETE FROM "user" WHERE id = $1', [userId]);
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
