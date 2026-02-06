import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getUser } from "@/lib/auth";

/**
 * POST /api/admin/migrate-notifications
 * Migration endpoint to add notification settings to user_profiles table
 * This is a one-time migration that can be run safely multiple times (idempotent)
 */
export async function POST(request: Request) {
  try {
    // Get authenticated user
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    // Check if columns already exist
    const columnsCheck = await query<{ column_name: string }>(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'user_profiles'
      AND column_name IN (
        'bank_name', 'bank_account_number', 'bank_branch', 'bank_swift',
        'pdf_primary_color', 'pdf_accent_color',
        'long_timer_enabled', 'long_timer_threshold',
        'daily_reminder_enabled', 'daily_reminder_time', 'last_reminder_date'
      )
    `);

    const existingColumns = columnsCheck.rows.map(row => row.column_name);
    const missingColumns: string[] = [];

    const requiredColumns = [
      'bank_name', 'bank_account_number', 'bank_branch', 'bank_swift',
      'pdf_primary_color', 'pdf_accent_color',
      'long_timer_enabled', 'long_timer_threshold',
      'daily_reminder_enabled', 'daily_reminder_time', 'last_reminder_date'
    ];

    for (const col of requiredColumns) {
      if (!existingColumns.includes(col)) {
        missingColumns.push(col);
      }
    }

    if (missingColumns.length === 0) {
      return NextResponse.json({
        success: true,
        message: "All notification columns already exist",
        columns: existingColumns
      });
    }

    // Add missing columns
    const migrations: { column: string; sql: string }[] = [
      { column: 'bank_name', sql: 'ALTER TABLE user_profiles ADD COLUMN bank_name TEXT' },
      { column: 'bank_account_number', sql: 'ALTER TABLE user_profiles ADD COLUMN bank_account_number TEXT' },
      { column: 'bank_branch', sql: 'ALTER TABLE user_profiles ADD COLUMN bank_branch TEXT' },
      { column: 'bank_swift', sql: 'ALTER TABLE user_profiles ADD COLUMN bank_swift TEXT' },
      { column: 'pdf_primary_color', sql: "ALTER TABLE user_profiles ADD COLUMN pdf_primary_color TEXT DEFAULT '#2563EB'" },
      { column: 'pdf_accent_color', sql: "ALTER TABLE user_profiles ADD COLUMN pdf_accent_color TEXT DEFAULT '#059669'" },
      { column: 'long_timer_enabled', sql: 'ALTER TABLE user_profiles ADD COLUMN long_timer_enabled BOOLEAN DEFAULT TRUE NOT NULL' },
      { column: 'long_timer_threshold', sql: 'ALTER TABLE user_profiles ADD COLUMN long_timer_threshold INTEGER DEFAULT 120 NOT NULL' },
      { column: 'daily_reminder_enabled', sql: 'ALTER TABLE user_profiles ADD COLUMN daily_reminder_enabled BOOLEAN DEFAULT FALSE NOT NULL' },
      { column: 'daily_reminder_time', sql: "ALTER TABLE user_profiles ADD COLUMN daily_reminder_time TEXT DEFAULT '09:00' NOT NULL" },
      { column: 'last_reminder_date', sql: 'ALTER TABLE user_profiles ADD COLUMN last_reminder_date DATE' },
    ];

    const results: string[] = [];

    for (const migration of migrations) {
      if (missingColumns.includes(migration.column)) {
        try {
          await query(migration.sql);
          results.push(`✓ Added ${migration.column}`);
        } catch (error) {
          console.error(`Failed to add ${migration.column}:`, error);
          results.push(`✗ Failed to add ${migration.column}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Migration completed",
      results,
      columnsAdded: missingColumns
    });
  } catch (error) {
    console.error("Migration error:", error);
    return NextResponse.json(
      { success: false, message: "Migration failed", error: String(error) },
      { status: 500 }
    );
  }
}
