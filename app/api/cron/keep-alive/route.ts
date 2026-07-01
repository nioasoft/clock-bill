import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { isAuthorizedCron } from "@/lib/cron-auth";

const logger = createLogger("cron:keep-alive");

// pg driver needs the Node runtime (not Edge). Always run dynamically.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/cron/keep-alive
 *
 * Pinged by a Vercel cron every ~5 min to keep the Neon compute warm so it does
 * not scale to zero (which adds a ~300-500ms cold start to the next user request).
 * Runs a trivial unauthed `SELECT 1` — no RLS context needed.
 *
 * When `CRON_SECRET` is set, Vercel attaches `Authorization: Bearer <CRON_SECRET>`
 * to cron invocations; we require it so the endpoint can't be abused publicly.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    // Route through query() (no tenant context → withConnRetry on the pool) so a
    // transient Neon/PgBouncer connection drop retries instead of paging. (CLOCK-BILL-5)
    await query("SELECT 1");
    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error("keep-alive ping failed", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
