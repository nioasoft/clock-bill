/**
 * Signature Upload API endpoint
 * POST: Upload user signature
 * DELETE: Remove user signature
 *
 * Storage:
 * - Development: Local filesystem (public/uploads/signatures)
 * - Production: Vercel Blob (if BLOB_READ_WRITE_TOKEN is set)
 */
import { NextRequest, NextResponse } from "next/server";
import { query } from "../../../../lib/db";
import { getUser } from "../../../../lib/auth";
import { uploadFile, deleteFile } from "../../../../lib/storage";

// Maximum file size: 2MB (signatures are typically smaller)
const MAX_FILE_SIZE = 2 * 1024 * 1024;

// Allowed MIME types
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

/**
 * POST handler - upload signature
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Get current user
    const user = await getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get("signature") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, message: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { success: false, message: "Invalid file type. Allowed: JPEG, PNG, GIF, WebP" },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, message: "File too large. Maximum size: 2MB" },
        { status: 400 }
      );
    }

    // Get current signature URL to delete old file
    const currentResult = await query<{ signature_url: string | null }>(
      `SELECT signature_url FROM user_profiles WHERE user_id = $1`,
      [user.id]
    );

    const oldSignatureUrl = currentResult.rows[0]?.signature_url;

    // Delete old signature file if exists
    if (oldSignatureUrl) {
      try {
        await deleteFile(oldSignatureUrl);
      } catch (error) {
        console.error("Failed to delete old signature:", error);
        // Continue even if old file deletion fails
      }
    }

    // Upload new signature using storage adapter
    const signatureUrl = await uploadFile(file, user.id, "signatures");

    // Update database with new signature URL
    const result = await query(
      `UPDATE user_profiles
       SET signature_url = $1, updated_at = NOW()
       WHERE user_id = $2
       RETURNING signature_url`,
      [signatureUrl, user.id]
    );

    if (result.rows.length === 0) {
      // Delete uploaded file if database update failed
      try {
        await deleteFile(signatureUrl);
      } catch {
        // Ignore cleanup errors
      }
      return NextResponse.json(
        { success: false, message: "Profile not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Signature uploaded successfully",
      signatureUrl: signatureUrl,
    });
  } catch (error) {
    console.error("Signature upload error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE handler - remove signature
 */
export async function DELETE(): Promise<NextResponse> {
  try {
    // Get current user
    const user = await getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get current signature URL
    const currentResult = await query<{ signature_url: string | null }>(
      `SELECT signature_url FROM user_profiles WHERE user_id = $1`,
      [user.id]
    );

    const signatureUrl = currentResult.rows[0]?.signature_url;

    if (!signatureUrl) {
      return NextResponse.json(
        { success: false, message: "No signature to delete" },
        { status: 400 }
      );
    }

    // Delete signature file using storage adapter
    try {
      await deleteFile(signatureUrl);
    } catch (error) {
      console.error("Failed to delete signature file:", error);
      // Continue even if file deletion fails
    }

    // Update database to remove signature URL
    await query(
      `UPDATE user_profiles
       SET signature_url = NULL, updated_at = NOW()
       WHERE user_id = $1`,
      [user.id]
    );

    return NextResponse.json({
      success: true,
      message: "Signature removed successfully",
    });
  } catch (error) {
    console.error("Signature delete error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
