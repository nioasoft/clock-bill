/**
 * POST /api/admin/users/[id]/actions
 * Perform admin actions on a user (reset password, verify email, delete
 * sessions, toggle role, delete user).
 *
 * Identity is backed by Better Auth: the `user`, `session` and `account`
 * tables (singular). Passwords live in `account` (provider_id='credential'),
 * managed by Better Auth — see the `reset_password` case for why a raw reset
 * is not supported here.
 *
 * Every action (and every denied attempt) is recorded to the append-only
 * audit_events table. Cross-user deletes run on the privileged admin connection
 * (withAdminTransaction) because the tenant-scoped query() binds the ADMIN's
 * RLS context and would otherwise delete nothing from the target's rows.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query, withAdminTransaction } from "@/lib/db";
import { getAdminUser } from "@/lib/admin";
import { parseBody } from "@/lib/api-validation";
import { createLogger } from "@/lib/logger";
import { logAuditEvent, requestIp } from "@/lib/audit";

const logger = createLogger("api:admin:actions");

/** Body schema for an admin user action. */
const actionSchema = z.object({
  action: z.enum(
    ["reset_password", "verify_email", "delete_sessions", "toggle_role", "delete_user"],
    { message: "פעולה לא מוכרת" }
  ),
});

/** Every user-scoped table, child→parent (FK-safe) for a full account wipe. */
const USER_TABLES_DELETE_ORDER = [
  "charge_document_lines",
  "charge_documents",
  "time_entries",
  "tasks",
  "client_rates",
  "projects",
  "clients",
  "custom_tags",
  "report_presets",
  "push_subscriptions",
  "trial_emails_sent",
  "user_profiles",
] as const;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const ip = requestIp(request);
  const userAgent = request.headers.get("user-agent")?.slice(0, 255) ?? null;
  try {
    const admin = await getAdminUser();
    const { id: userId } = await params;

    if (!admin) {
      // Record the denied attempt (H-07) — who, from where, against whom.
      const { getUser } = await import("@/lib/auth");
      const actor = await getUser().catch(() => null);
      await logAuditEvent({
        actorId: actor?.id ?? "anonymous",
        action: "admin.access_denied",
        targetType: "user",
        targetId: userId,
        ip,
        userAgent,
      });
      return NextResponse.json({ success: false, error_code: "FORBIDDEN", message: "אין הרשאה" }, { status: 403 });
    }

    const parsed = await parseBody(request, actionSchema);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    // Verify user exists (Better Auth `user` table — "user" is a reserved word).
    const userResult = await query<{ id: string; email: string; role: string }>(
      'SELECT id, email, role FROM "user" WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json({ success: false, error_code: "USER_NOT_FOUND", message: "משתמש לא נמצא" }, { status: 404 });
    }

    const targetUser = userResult.rows[0];

    // Prevent admin from modifying themselves with dangerous actions
    if (targetUser.id === admin.id && (body.action === "delete_user" || body.action === "toggle_role")) {
      return NextResponse.json(
        { success: false, error_code: "SELF_ACTION_FORBIDDEN", message: "לא ניתן לבצע פעולה זו על עצמך" },
        { status: 400 }
      );
    }

    const audit = (action: string, metadata?: Record<string, unknown>) =>
      logAuditEvent({ actorId: admin.id, action, targetType: "user", targetId: userId, ip, userAgent, metadata });

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
            error_code: "PASSWORD_RESET_UNSUPPORTED",
            message:
              "איפוס סיסמה ידני אינו נתמך. יש להפנות את המשתמש לתהליך 'שכחתי סיסמה'.",
          },
          { status: 400 }
        );
      }

      case "verify_email": {
        await query('UPDATE "user" SET email_verified = TRUE, updated_at = NOW() WHERE id = $1', [userId]);
        await audit("admin.verify_email", { email: targetUser.email });
        return NextResponse.json({ success: true, message: "האימייל אומת בהצלחה" });
      }

      case "delete_sessions": {
        const deleteResult = await query('DELETE FROM "session" WHERE user_id = $1', [userId]);
        await audit("admin.delete_sessions", { count: deleteResult.rowCount });
        return NextResponse.json({
          success: true,
          message: `נמחקו ${deleteResult.rowCount} הפעלות`,
        });
      }

      case "toggle_role": {
        const newRole = targetUser.role === "admin" ? "user" : "admin";
        await query('UPDATE "user" SET role = $1, updated_at = NOW() WHERE id = $2', [newRole, userId]);
        await audit("admin.toggle_role", { from: targetUser.role, to: newRole });
        return NextResponse.json({
          success: true,
          message: `התפקיד שונה ל-${newRole}`,
          newRole,
        });
      }

      case "delete_user": {
        // Cross-tenant wipe MUST bypass RLS (tenant-scoped query() would bind the
        // admin's id and delete none of the target's rows). One privileged
        // transaction: delete every user-scoped table child→parent, then the
        // Better Auth identity rows, then the audit row — all or nothing.
        await withAdminTransaction(async (client) => {
          for (const table of USER_TABLES_DELETE_ORDER) {
            await client.query(`DELETE FROM ${table} WHERE user_id = $1`, [userId]);
          }
          await client.query('DELETE FROM "session" WHERE user_id = $1', [userId]);
          await client.query('DELETE FROM "account" WHERE user_id = $1', [userId]);
          await client.query('DELETE FROM "user" WHERE id = $1', [userId]);
          await client.query(
            `INSERT INTO audit_events (id, actor_id, action, target_type, target_id, ip, user_agent, metadata)
             VALUES (gen_random_uuid()::text, $1, 'admin.delete_user', 'user', $2, $3, $4, $5)`,
            [admin.id, userId, ip, userAgent, JSON.stringify({ email: targetUser.email })]
          );
        });
        return NextResponse.json({ success: true, message: "המשתמש נמחק בהצלחה" });
      }

      default:
        return NextResponse.json({ success: false, error_code: "UNKNOWN_ACTION", message: "פעולה לא מוכרת" }, { status: 400 });
    }
  } catch (error) {
    logger.error("Admin action error", error);
    return NextResponse.json({ success: false, error_code: "SERVER_ERROR", message: "שגיאת שרת" }, { status: 500 });
  }
}
