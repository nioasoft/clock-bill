import { NextResponse } from "next/server";
import { query } from "@/lib/db";

/**
 * Health check endpoint for monitoring and load balancers
 * Returns 200 if the service and database are healthy
 */
export async function GET() {
  try {
    // Test database connectivity
    await query("SELECT 1");

    return NextResponse.json(
      {
        status: "healthy",
        timestamp: new Date().toISOString(),
        database: "connected",
      },
      { status: 200 }
    );
  } catch (error) {
    // Database connection failed
    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        database: "disconnected",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
