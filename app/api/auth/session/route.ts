/**
 * Session check API endpoint
 * Returns the current user session if valid
 */
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { cookies } from "next/headers";

export interface SessionResponse {
  success: boolean;
  user?: {
    id: string;
    email: string;
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
        { success: false, message: "No session found" },
        { status: 401 }
      );
    }

    const db = getDb();

    // Find session and check if it's valid
    const session = db.prepare(
      `SELECT s.user_id, s.expires_at, u.email
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.token = ?`
    ).get(sessionToken) as
      | { user_id: string; expires_at: string; email: string }
      | undefined;

    if (!session) {
      return NextResponse.json(
        { success: false, message: "Invalid session" },
        { status: 401 }
      );
    }

    // Check if session is expired
    const expiresAt = new Date(session.expires_at);
    if (expiresAt < new Date()) {
      // Delete expired session
      db.prepare("DELETE FROM sessions WHERE token = ?").run(sessionToken);
      return NextResponse.json(
        { success: false, message: "Session expired" },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        id: session.user_id,
        email: session.email,
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
