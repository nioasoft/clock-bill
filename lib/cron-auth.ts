import { timingSafeEqual } from "node:crypto";

/**
 * Constant-time string comparison that also tolerates length mismatch
 * (timingSafeEqual throws on unequal-length buffers).
 */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Authorize a cron invocation. Vercel attaches `Authorization: Bearer <CRON_SECRET>`
 * when the CRON_SECRET env var is set.
 *
 * Fail-closed: a request is authorized only when the bearer token matches. The
 * one exception is local dev/test where CRON_SECRET is intentionally unset — there
 * we allow the call so crons can be exercised locally. Production cannot reach the
 * "no secret" branch: env validation requires CRON_SECRET in production.
 */
export function isAuthorizedCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }
  const auth = request.headers.get("authorization") ?? "";
  return safeEqual(auth, `Bearer ${secret}`);
}
