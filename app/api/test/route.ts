/**
 * Test API endpoint for verifying data persistence
 * This endpoint creates and retrieves test records to verify database functionality
 * NOTE: This endpoint is protected and requires authentication
 */
import { query } from "../../../lib/db";
import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";

/**
 * GET handler - retrieves all test records
 */
export async function GET() {
  try {
    // Check authentication
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const result = await query<{
      id: string;
      test_data: string;
      created_at: string;
    }>("SELECT * FROM test_persistence ORDER BY created_at DESC");

    return NextResponse.json({
      success: true,
      records: result.rows,
      count: result.rows.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching test records:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch records",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

/**
 * POST handler - creates a new test record
 */
export async function POST(request: Request) {
  try {
    // Check authentication
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const testData = body.testData || `Test_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Create test_persistence table if it doesn't exist
    await query(`
      CREATE TABLE IF NOT EXISTS test_persistence (
        id TEXT PRIMARY KEY,
        test_data TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Insert test record
    await query(
      `INSERT INTO test_persistence (id, test_data)
       VALUES (gen_random_uuid()::text, $1)`,
      [testData]
    );

    return NextResponse.json({
      success: true,
      message: "Test record created successfully",
      testData,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error creating test record:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create record",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

/**
 * DELETE handler - removes all test records
 */
export async function DELETE() {
  try {
    // Check authentication
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    await query("DELETE FROM test_persistence");

    return NextResponse.json({
      success: true,
      message: "All test records deleted",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error deleting test records:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete records",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
