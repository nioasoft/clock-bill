/**
 * Forgot password API endpoint
 * Generates a password reset token and sends reset email (logs to console in dev)
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import crypto from "crypto";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export interface ForgotPasswordResponse {
  success: boolean;
  message?: string;
}

/**
 * POST handler - request password reset
 */
export async function POST(request: Request): Promise<NextResponse> {
  const ip = getClientIp(request);
  const rateCheck = checkRateLimit(ip);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { success: false, message: "יותר מדי ניסיונות. נסה שוב מאוחר יותר." },
      { status: 429 }
    );
  }

  try {
    const { email } = await request.json();

    // Validate email
    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { success: false, message: "Email is required" },
        { status: 400 }
      );
    }

    // Check if user exists
    const userResult = await query<{ id: string; email: string }>(
      "SELECT id, email FROM users WHERE email = $1",
      [email.toLowerCase().trim()]
    );

    const user = userResult.rows[0];

    // Always return success to prevent email enumeration
    // But only actually create token if user exists
    if (user) {
      // Generate secure random token
      const token = crypto.randomBytes(32).toString("hex");

      // Token expires in 1 hour
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1);

      // Delete any existing unused tokens for this user
      await query(
        "DELETE FROM password_reset_tokens WHERE user_id = $1 AND used = FALSE",
        [user.id]
      );

      // Create new reset token
      await query(
        `INSERT INTO password_reset_tokens (id, user_id, token, expires_at)
         VALUES (gen_random_uuid()::text, $1, $2, $3)`,
        [user.id, token, expiresAt.toISOString()]
      );

      // Generate reset URL
      const { getAppUrl } = await import("@/lib/env");
      const resetUrl = `${getAppUrl()}/reset-password?token=${token}`;

      // Log to console in development (since we can't send real emails)
      console.log("\n" + "=".repeat(60));
      console.log("PASSWORD RESET REQUEST");
      console.log("=".repeat(60));
      console.log(`Email: ${user.email}`);
      console.log(`Reset URL: ${resetUrl}`);
      console.log("=".repeat(60) + "\n");
    }

    // Always return success (even if user doesn't exist - prevents email enumeration)
    return NextResponse.json({
      success: true,
      message: "If an account exists with this email, you will receive password reset instructions.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
