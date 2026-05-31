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

    // Return healthy status
    return NextResponse.json(
      {
        status: "healthy",
        timestamp: new Date().toISOString(),
        database: "connected",
      },
      { status: 200 }
    );
  } catch (error) {
    // Log the detailed error server-side; keep the client response generic so we
    // don't leak DB engine/connection details to unauthenticated callers.
    logger.error("Health check failed", error);
    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        database: "disconnected",
        error: "Database connection failed",
      },
      { status: 503 }
    );
  }
}
