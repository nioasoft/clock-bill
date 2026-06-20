/**
 * Health check endpoint
 * Returns 200 OK if the service is running
 * Can be used by load balancers, monitoring systems, etc.
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { createLogger } from "@/lib/logger";

const logger = createLogger("health");

export async function GET() {
  try {
    // Verify the database is responsive. query() checks out a pooled connection
    // and releases it internally (even on error), so there's no leak on failure.
    await query("SELECT 1");

    // 200 = healthy. Deliberately do NOT expose infrastructure state (e.g. DB
    // connection status) to unauthenticated callers — the status code is enough
    // for load balancers / uptime checks.
    return NextResponse.json(
      { status: "ok", timestamp: new Date().toISOString() },
      { status: 200 }
    );
  } catch (error) {
    // Log details server-side; keep the client response generic.
    logger.error("Health check failed", error);
    return NextResponse.json(
      { status: "error", timestamp: new Date().toISOString() },
      { status: 503 }
    );
  }
}
