/**
 * User login API endpoint
 * Authenticates user with email and password
 */
import { NextResponse } from "next/server";
import { query, initSchema } from "../../../../lib/db";
import { verifyPassword, generateSessionToken, COOKIE_OPTIONS } from "../../../../lib/auth";
import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import { createLogger } from "../../../../lib/logger";

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

    await initSchema();

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
