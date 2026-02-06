/**
 * Logo Upload API endpoint
 * POST: Upload user logo
 * DELETE: Remove user logo
 */
import { NextRequest, NextResponse } from "next/server";
import { query } from "../../../../lib/db";
import { getUser } from "../../../../lib/auth";
import { writeFile, mkdir, unlink } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

// Maximum file size: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Allowed MIME types
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

// Upload directory
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "logos");

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
 * POST handler - upload logo
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
    const file = formData.get("logo") as File | null;

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
        { success: false, message: "File too large. Maximum size: 5MB" },
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

    // Get current logo URL to delete old file
    const currentResult = await query<{ logo_url: string | null }>(
      `SELECT logo_url FROM user_profiles WHERE user_id = $1`,
      [user.id]
    );

    const oldLogoUrl = currentResult.rows[0]?.logo_url;

    // Delete old logo file if exists
    if (oldLogoUrl) {
      const oldFilename = path.basename(oldLogoUrl);
      const oldFilepath = path.join(UPLOAD_DIR, oldFilename);
      try {
        if (existsSync(oldFilepath)) {
          await unlink(oldFilepath);
        }
      } catch (error) {
        console.error("Failed to delete old logo:", error);
        // Continue even if old file deletion fails
      }
    }

    // Update database with new logo URL
    const logoUrl = `/uploads/logos/${filename}`;
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
      message: "Logo uploaded successfully",
      logoUrl: logoUrl,
    });
  } catch (error) {
    console.error("Logo upload error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
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
        { success: false, message: "Unauthorized" },
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
        { success: false, message: "No logo to delete" },
        { status: 400 }
      );
    }

    // Delete logo file
    const filename = path.basename(logoUrl);
    const filepath = path.join(UPLOAD_DIR, filename);
    try {
      if (existsSync(filepath)) {
        await unlink(filepath);
      }
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
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
