/**
 * Health check endpoint
 * Returns 200 OK if the service is running
 * Can be used by load balancers, monitoring systems, etc.
 */
import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";

export async function GET() {
  try {
    // Check database connection
    const pool = getPool();
    const client = await pool.connect();

    // Run a simple query to verify database is responsive
    await client.query("SELECT 1");
    client.release();

    // Return healthy status
    return NextResponse.json(
      {
        status: "healthy",
        timestamp: new Date().toISOString(),
        database: "connected",
      },
      { status: 200 }
    );
  } catch {
    // Database connection failed
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
