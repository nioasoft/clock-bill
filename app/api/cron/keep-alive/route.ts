import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { isTransientConnectionError } from "@/lib/db-retry";
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
    // A transient connection failure here is benign and user-invisible: this
    // endpoint exists to warm a scaled-to-zero Neon, so it's the one most likely
    // to catch a cold DB, and even the failed attempt warms it for the next ping.
    // The retry window (~150ms) can't outlast Neon's ~300-500ms cold start, so
    // don't page Sentry for it — warn only. Real errors (auth/SQL) still page. (CLOCK-BILL-5)
    if (isTransientConnectionError(error)) {
      logger.warn("keep-alive ping hit a cold/dropped DB connection (benign)", {
        error: error instanceof Error ? error.message : String(error),
      });
    } else {
      logger.error("keep-alive ping failed", error);
    }
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
