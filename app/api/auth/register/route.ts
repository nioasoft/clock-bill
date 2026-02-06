/**
 * User registration API endpoint
 * Creates a new user account with email and password
 */
import { NextResponse } from "next/server";
import { query, initSchema } from "../../../../lib/db";
import { hashPassword, generateSessionToken, COOKIE_OPTIONS } from "../../../../lib/auth";
import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import { createLogger } from "../../../../lib/logger";

const logger = createLogger("auth:register");

export interface RegisterRequest {
  email: string;
  password: string;
  businessName?: string;
}

export interface RegisterResponse {
  success: boolean;
  message?: string;
  user?: {
    id: string;
    email: string;
  };
}

/**
 * POST handler - register a new user
 */
export async function POST(request: Request): Promise<NextResponse> {
  let email: string | undefined;
  try {
    const body: RegisterRequest = await request.json();
    email = body.email;
    const { password, businessName } = body;

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: "Email and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { success: false, message: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, message: "Invalid email format" },
        { status: 400 }
      );
    }

    // Ensure schema exists
    await initSchema();

    // Check if user already exists
    const existingResult = await query<{ id: string }>(
      "SELECT id FROM users WHERE email = $1",
      [email]
    );

    if (existingResult.rows.length > 0) {
      logger.warn("Registration attempted with existing email", { email });
      return NextResponse.json(
        { success: false, message: "User with this email already exists" },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const userId = randomUUID();
    const now = new Date().toISOString();

    await query(
      `INSERT INTO users (id, email, password_hash, email_verified, created_at, updated_at)
       VALUES ($1, $2, $3, FALSE, $4, $5)`,
      [userId, email, passwordHash, now, now]
    );

    // Create user profile
    const profileId = randomUUID();
    await query(
      `INSERT INTO user_profiles (id, user_id, business_name, default_currency, preferred_pdf_template, created_at, updated_at)
       VALUES ($1, $2, $3, 'ILS', 'modern', $4, $5)`,
      [profileId, userId, businessName || null, now, now]
    );

    // Create session
    const sessionToken = generateSessionToken();
    const sessionId = randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await query(
      `INSERT INTO sessions (id, user_id, token, expires_at, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [sessionId, userId, sessionToken, expiresAt.toISOString(), now]
    );

    // Set session cookie
    const cookieStore = await cookies();
    cookieStore.set("session", sessionToken, COOKIE_OPTIONS);

    return NextResponse.json({
      success: true,
      message: "User registered successfully",
      user: {
        id: userId,
        email,
      },
    });
  } catch (error) {
    logger.error("Registration failed", error, email ? { email } : undefined);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
