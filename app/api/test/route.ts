/**
 * Test API endpoint for verifying data persistence
 * This endpoint creates and retrieves test records to verify database functionality
 */
import { getDb } from "../../../lib/db";
import { NextResponse } from "next/server";

/**
 * GET handler - retrieves all test records
 */
export function GET() {
  try {
    const db = getDb();
    const stmt = db.prepare(
      "SELECT * FROM test_persistence ORDER BY created_at DESC",
    );
    const records = stmt.all() as Array<{
      id: string;
      test_data: string;
      created_at: string;
    }>;

    return NextResponse.json({
      success: true,
      records,
      count: records.length,
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
    const body = await request.json();
    const testData = body.testData || `Test_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const db = getDb();

    // Create test_persistence table if it doesn't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS test_persistence (
        id TEXT PRIMARY KEY,
        test_data TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insert test record
    const insertStmt = db.prepare(`
      INSERT INTO test_persistence (id, test_data)
      VALUES (lower(hex(randomblob(16))), ?)
    `);

    const result = insertStmt.run(testData);

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
export function DELETE() {
  try {
    const db = getDb();
    db.exec("DELETE FROM test_persistence");

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
