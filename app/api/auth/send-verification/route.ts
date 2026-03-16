/**
 * Send email verification API endpoint
 * Generates a verification token and logs it to console (development mode)
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { generateToken, getUser } from "@/lib/auth";
import { randomUUID } from "crypto";

export interface SendVerificationRequest {
  email?: string; // Optional: if provided, resend to that email
}

export interface SendVerificationResponse {
  success: boolean;
  message?: string;
  verificationLink?: string; // Only in development
}

/**
 * POST handler - send verification email
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    // Get authenticated user
    const user = await getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, message: "לא מחובר" },
        { status: 401 }
      );
    }

    // Check if email is already verified
    const userResult = await query<{ email_verified: boolean }>(
      "SELECT email_verified FROM users WHERE id = $1",
      [user.id]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 }
      );
    }

    if (userResult.rows[0].email_verified) {
      return NextResponse.json({
        success: true,
        message: "Email is already verified",
      });
    }

    // Generate verification token
    const token = generateToken(32);
    const tokenId = randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

    // Store token in database
    await query(
      `INSERT INTO email_verification_tokens (id, user_id, token, expires_at, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [tokenId, user.id, token, expiresAt.toISOString(), now.toISOString()]
    );

    // In development, log the verification link to console
    // In production, this would send a real email
    const { getAppUrl } = await import("@/lib/env");
    const baseUrl = getAppUrl();
    const verificationLink = `${baseUrl}/api/auth/verify-email/${token}`;

    console.log("=".repeat(60));
    console.log("📧 EMAIL VERIFICATION - DEVELOPMENT MODE");
    console.log("=".repeat(60));
    console.log(`To: ${user.email}`);
    console.log(`Subject: אימות כתובת אימייל`);
    console.log("");
    console.log("Please verify your email address by clicking the link below:");
    console.log("");
    console.log(verificationLink);
    console.log("");
    console.log("This link will expire in 24 hours.");
    console.log("=".repeat(60));

    return NextResponse.json({
      success: true,
      message: "Verification email sent",
      verificationLink, // Only included in development
    });
  } catch (error) {
    console.error("Send verification error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
