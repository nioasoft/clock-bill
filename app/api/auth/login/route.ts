/**
 * User login API endpoint
 * Authenticates user with email and password
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { verifyPassword, generateSessionToken, COOKIE_OPTIONS } from "@/lib/auth";
import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import { createLogger } from "@/lib/logger";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const logger = createLogger("auth:login");

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  message?: string;
  user?: {
    id: string;
    email: string;
    emailVerified: boolean;
  };
}

/**
 * POST handler - login user
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

  let email: string | undefined;
  try {
    const body: LoginRequest = await request.json();
    email = body.email;
    const { password } = body;

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: "Email and password are required" },
        { status: 400 }
      );
    }

    // Find user by email
    const userResult = await query<{ id: string; email: string; password_hash: string; email_verified: boolean }>(
      "SELECT id, email, password_hash, email_verified FROM users WHERE email = $1",
      [email]
    );

    const user = userResult.rows[0];

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.password_hash);

    if (!isValidPassword) {
      return NextResponse.json(
        { success: false, message: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Create session
    const sessionToken = generateSessionToken();
    const sessionId = randomUUID();
    const now = new Date().toISOString();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await query(
      `INSERT INTO sessions (id, user_id, token, expires_at, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [sessionId, user.id, sessionToken, expiresAt.toISOString(), now]
    );

    // Cleanup expired sessions (non-blocking, best-effort)
    query("DELETE FROM sessions WHERE expires_at < NOW()").catch((err) => {
      logger.error("Failed to cleanup expired sessions", err);
    });

    // Set session cookie
    const cookieStore = await cookies();
    cookieStore.set("session", sessionToken, COOKIE_OPTIONS);

    return NextResponse.json({
      success: true,
      message: "Login successful",
      user: {
        id: user.id,
        email: user.email,
        emailVerified: user.email_verified,
      },
    });
  } catch (error) {
    logger.error("Login failed", error, email ? { email } : undefined);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
