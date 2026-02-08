/**
 * Session check API endpoint
 * Returns the current user session if valid
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { cookies } from "next/headers";

export interface SessionResponse {
  success: boolean;
  user?: {
    id: string;
    email: string;
    emailVerified: boolean;
    role: string;
  };
  message?: string;
}

/**
 * GET handler - check current session
 */
export async function GET(): Promise<NextResponse> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session")?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { success: false, message: "לא נמצאה הפעלה" },
        { status: 401 }
      );
    }

    // Find session and check if it's valid
    const sessionResult = await query<{ user_id: string; expires_at: string; email: string; email_verified: boolean; role: string }>(
      `SELECT s.user_id, s.expires_at, u.email, u.email_verified, u.role
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.token = $1`,
      [sessionToken]
    );

    const session = sessionResult.rows[0];

    if (!session) {
      const response = NextResponse.json(
        { success: false, message: "הפעלה לא תקינה" },
        { status: 401 }
      );
      response.cookies.delete("session");
      return response;
    }

    // Check if session is expired
    const expiresAt = new Date(session.expires_at);
    if (expiresAt < new Date()) {
      // Delete expired session
      await query("DELETE FROM sessions WHERE token = $1", [sessionToken]);
      const response = NextResponse.json(
        { success: false, message: "ההפעלה פגה תוקף" },
        { status: 401 }
      );
      response.cookies.delete("session");
      return response;
    }

    return NextResponse.json({
      success: true,
      user: {
        id: session.user_id,
        email: session.email,
        emailVerified: session.email_verified,
        role: session.role ?? "user",
      },
    });
  } catch (error) {
    console.error("Session check error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
