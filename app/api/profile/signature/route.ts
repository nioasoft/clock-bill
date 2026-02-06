/**
 * Signature Upload API endpoint
 * POST: Upload user signature
 * DELETE: Remove user signature
 */
import { NextRequest, NextResponse } from "next/server";
import { query } from "../../../../lib/db";
import { getUser } from "../../../../lib/auth";
import { writeFile, mkdir, unlink } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

// Maximum file size: 2MB (signatures are typically smaller)
const MAX_FILE_SIZE = 2 * 1024 * 1024;

// Allowed MIME types
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

// Upload directory
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "signatures");

/**
 * Ensure upload directory exists
 */
async function ensureUploadDir(): Promise<void> {
  if (!existsSync(UPLOAD_DIR)) {
    await mkdir(UPLOAD_DIR, { recursive: true });
  }
}

/**
 * Generate a unique filename
 */
function generateFilename(userId: string, originalName: string): string {
  const timestamp = Date.now();
  const extension = path.extname(originalName) || ".png";
  return `${userId}_${timestamp}${extension}`;
}

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

    // Ensure upload directory exists
    await ensureUploadDir();

    // Generate unique filename
    const filename = generateFilename(user.id, file.name);
    const filepath = path.join(UPLOAD_DIR, filename);

    // Convert File to Buffer and save
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filepath, buffer);

    // Get current signature URL to delete old file
    const currentResult = await query<{ signature_url: string | null }>(
      `SELECT signature_url FROM user_profiles WHERE user_id = $1`,
      [user.id]
    );

    const oldSignatureUrl = currentResult.rows[0]?.signature_url;

    // Delete old signature file if exists
    if (oldSignatureUrl) {
      const oldFilename = path.basename(oldSignatureUrl);
      const oldFilepath = path.join(UPLOAD_DIR, oldFilename);
      try {
        if (existsSync(oldFilepath)) {
          await unlink(oldFilepath);
        }
      } catch (error) {
        console.error("Failed to delete old signature:", error);
        // Continue even if old file deletion fails
      }
    }

    // Update database with new signature URL
    const signatureUrl = `/uploads/signatures/${filename}`;
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
        await unlink(filepath);
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

    // Delete signature file
    const filename = path.basename(signatureUrl);
    const filepath = path.join(UPLOAD_DIR, filename);
    try {
      if (existsSync(filepath)) {
        await unlink(filepath);
      }
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
