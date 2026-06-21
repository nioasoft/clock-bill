/**
 * Append-only audit trail for sensitive actions (admin user ops, financial
 * mutations). Rows are written via the privileged admin connection so they land
 * regardless of tenant RLS context, and never block the primary action.
 */
import { adminQuery } from "@/lib/db";
import { createLogger } from "@/lib/logger";

const logger = createLogger("audit");

export interface AuditEvent {
  /** Who performed the action (admin / acting user id). */
  actorId: string;
  /** Stable action key, e.g. "admin.delete_user", "admin.toggle_role". */
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
}

/** Extract a best-effort client IP from request headers. */
export function requestIp(request: Request): string | null {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip");
}

/**
 * Write an audit row. Best-effort: a logging failure is reported but never
 * propagates, so it can't break the action being audited.
 */
export async function logAuditEvent(e: AuditEvent): Promise<void> {
  try {
    await adminQuery(
      `INSERT INTO audit_events (id, actor_id, action, target_type, target_id, ip, user_agent, metadata)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7)`,
      [
        e.actorId,
        e.action,
        e.targetType ?? null,
        e.targetId ?? null,
        e.ip ?? null,
        e.userAgent ?? null,
        e.metadata ? JSON.stringify(e.metadata) : null,
      ]
    );
  } catch (error) {
    logger.error("failed to write audit_event", error);
  }
}
