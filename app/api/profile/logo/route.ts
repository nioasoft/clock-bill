/**
 * Logo Upload API endpoint
 * POST: Upload user logo
 * DELETE: Remove user logo
 *
 * Storage:
 * - Development: Local filesystem (public/uploads/logos)
 * - Production: Vercel Blob (if BLOB_READ_WRITE_TOKEN is set)
 */
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { uploadFile, deleteFile } from "@/lib/storage";

// Maximum file size: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Allowed MIME types
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

/**
 * POST handler - upload logo
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Get current user
    const user = await getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error_code: "UNAUTHORIZED", message: "לא מחובר" },
        { status: 401 }
      );
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get("logo") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error_code: "NO_FILE", message: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { success: false, error_code: "INVALID_FILE_TYPE", message: "Invalid file type. Allowed: JPEG, PNG, GIF, WebP" },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error_code: "FILE_TOO_LARGE", message: "File too large. Maximum size: 5MB" },
        { status: 400 }
      );
    }

    // Get current logo URL to delete old file
    const currentResult = await query<{ logo_url: string | null }>(
      `SELECT logo_url FROM user_profiles WHERE user_id = $1`,
      [user.id]
    );

    const oldLogoUrl = currentResult.rows[0]?.logo_url;

    // Delete old logo file if exists
    if (oldLogoUrl) {
      try {
        await deleteFile(oldLogoUrl);
      } catch (error) {
        console.error("Failed to delete old logo:", error);
        // Continue even if old file deletion fails
      }
    }

    // Upload new logo using storage adapter
    const logoUrl = await uploadFile(file, user.id, "logos");

    // Update database with new logo URL
    const result = await query(
      `UPDATE user_profiles
       SET logo_url = $1, updated_at = NOW()
       WHERE user_id = $2
       RETURNING logo_url`,
      [logoUrl, user.id]
    );

    if (result.rows.length === 0) {
      // Delete uploaded file if database update failed
      try {
        await deleteFile(logoUrl);
      } catch {
        // Ignore cleanup errors
      }
      return NextResponse.json(
        { success: false, error_code: "PROFILE_NOT_FOUND", message: "פרופיל לא נמצא" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Logo uploaded successfully",
      logoUrl: logoUrl,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNSUPPORTED_FILE_CONTENT") {
      return NextResponse.json(
        { success: false, error_code: "INVALID_FILE_TYPE", message: "Invalid file type. Allowed: JPEG, PNG, GIF, WebP" },
        { status: 400 }
      );
    }
    console.error("Logo upload error:", error);
    return NextResponse.json(
      { success: false, error_code: "SERVER_ERROR", message: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE handler - remove logo
 */
export async function DELETE(): Promise<NextResponse> {
  try {
    // Get current user
    const user = await getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error_code: "UNAUTHORIZED", message: "לא מחובר" },
        { status: 401 }
      );
    }

    // Get current logo URL
    const currentResult = await query<{ logo_url: string | null }>(
      `SELECT logo_url FROM user_profiles WHERE user_id = $1`,
      [user.id]
    );

    const logoUrl = currentResult.rows[0]?.logo_url;

    if (!logoUrl) {
      return NextResponse.json(
        { success: false, error_code: "NO_FILE_TO_DELETE", message: "No logo to delete" },
        { status: 400 }
      );
    }

    // Delete logo file using storage adapter
    try {
      await deleteFile(logoUrl);
    } catch (error) {
      console.error("Failed to delete logo file:", error);
      // Continue even if file deletion fails
    }

    // Update database to remove logo URL
    await query(
      `UPDATE user_profiles
       SET logo_url = NULL, updated_at = NOW()
       WHERE user_id = $1`,
      [user.id]
    );

    return NextResponse.json({
      success: true,
      message: "Logo removed successfully",
    });
  } catch (error) {
    console.error("Logo delete error:", error);
    return NextResponse.json(
      { success: false, error_code: "SERVER_ERROR", message: "Internal server error" },
      { status: 500 }
    );
  }
}
