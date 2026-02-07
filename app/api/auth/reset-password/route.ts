/**
 * Reset password API endpoint
 * Validates token and updates user password
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { hashPassword } from "@/lib/auth";

export interface ResetPasswordResponse {
  success: boolean;
  message?: string;
}

/**
 * POST handler - reset password with token
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const { token, password } = await request.json();

    // Validate inputs
    if (!token || typeof token !== "string") {
      return NextResponse.json(
        { success: false, message: "Reset token is required" },
        { status: 400 }
      );
    }

    if (!password || typeof password !== "string") {
      return NextResponse.json(
        { success: false, message: "Password is required" },
        { status: 400 }
      );
    }

    // Validate password length
    if (password.length < 8) {
      return NextResponse.json(
        { success: false, message: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Find valid token
    const tokenResult = await query<{ user_id: string; expires_at: string; used: boolean }>(
      `SELECT user_id, expires_at, used
       FROM password_reset_tokens
       WHERE token = $1`,
      [token]
    );

    const resetToken = tokenResult.rows[0];

    if (!resetToken) {
      return NextResponse.json(
        { success: false, message: "Invalid or expired reset token" },
        { status: 400 }
      );
    }

    // Check if token is already used
    if (resetToken.used) {
      return NextResponse.json(
        { success: false, message: "Reset token has already been used" },
        { status: 400 }
      );
    }

    // Check if token is expired
    const expiresAt = new Date(resetToken.expires_at);
    if (expiresAt < new Date()) {
      return NextResponse.json(
        { success: false, message: "Reset token has expired" },
        { status: 400 }
      );
    }

    // Hash new password
    const passwordHash = await hashPassword(password);

    // Update user password
    await query(
      `UPDATE users
       SET password_hash = $1, updated_at = NOW()
       WHERE id = $2`,
      [passwordHash, resetToken.user_id]
    );

    // Mark token as used
    await query(
      `UPDATE password_reset_tokens
       SET used = TRUE
       WHERE token = $1`,
      [token]
    );

    // Delete all sessions for this user (force re-login)
    await query(
      "DELETE FROM sessions WHERE user_id = $1",
      [resetToken.user_id]
    );

    return NextResponse.json({
      success: true,
      message: "Password has been reset successfully",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
