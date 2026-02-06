import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

/**
 * POST /api/admin/migrate-address
 * Add address column to clients table
 */
export async function POST(request: NextRequest) {
  try {
    // Add address column to clients table
    await query(
      `ALTER TABLE clients ADD COLUMN IF NOT EXISTS address text`
    );

    return NextResponse.json({
      success: true,
      message: "Address column added successfully",
    });
  } catch (error) {
    console.error("Migration error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Migration failed",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
