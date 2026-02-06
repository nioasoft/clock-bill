/**
 * User login API endpoint
 * Authenticates user with email and password
 */
import { NextResponse } from "next/server";
import { getDb } from "../../../../lib/db";
import { verifyPassword, generateSessionToken, COOKIE_OPTIONS } from "../../../../lib/auth";
import { cookies } from "next/headers";
import { randomUUID } from "crypto";

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
  };
}

/**
 * POST handler - login user
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body: LoginRequest = await request.json();
    const { email, password } = body;

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: "Email and password are required" },
        { status: 400 }
      );
    }

    const db = getDb();

    // Find user by email
    const user = db.prepare("SELECT id, email, password_hash FROM users WHERE email = ?").get(email) as
      | { id: string; email: string; password_hash: string }
      | undefined;

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

    db.prepare(
      `INSERT INTO sessions (id, user_id, token, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?)`
    ).run(sessionId, user.id, sessionToken, expiresAt.toISOString(), now);

    // Set session cookie
    const cookieStore = await cookies();
    cookieStore.set("session", sessionToken, COOKIE_OPTIONS);

    return NextResponse.json({
      success: true,
      message: "Login successful",
      user: {
        id: user.id,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
