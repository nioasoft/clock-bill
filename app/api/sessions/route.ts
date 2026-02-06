/**
 * Sessions API endpoint
 * Returns all active sessions for the current user
 */
import { NextResponse } from "next/server";
import { query } from "../../../lib/db";
import { cookies } from "next/headers";

export interface Session {
  id: string;
  created_at: string;
  expires_at: string;
  is_current: boolean;
}

export interface SessionsResponse {
  success: boolean;
  sessions?: Session[];
  message?: string;
}

/**
 * GET handler - get all active sessions for current user
 */
export async function GET(): Promise<NextResponse> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session")?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { success: false, message: "Not authenticated" },
        { status: 401 }
      );
    }

    // Get current user from session
    const currentResult = await query<{ user_id: string; session_id: string }>(
      `SELECT s.user_id, s.id as session_id
       FROM sessions s
       WHERE s.token = $1 AND s.expires_at > NOW()`,
      [sessionToken]
    );

    const currentSession = currentResult.rows[0];

    if (!currentSession) {
      return NextResponse.json(
        { success: false, message: "Invalid or expired session" },
        { status: 401 }
      );
    }

    // Get all active sessions for this user
    const sessionsResult = await query<{
      id: string;
      created_at: string;
      expires_at: string;
    }>(
      `SELECT id, created_at, expires_at
       FROM sessions
       WHERE user_id = $1 AND expires_at > NOW()
       ORDER BY created_at DESC`,
      [currentSession.user_id]
    );

    // Mark current session
    const sessionsWithCurrentFlag = sessionsResult.rows.map((session) => ({
      id: session.id,
      created_at: session.created_at,
      expires_at: session.expires_at,
      is_current: session.id === currentSession.session_id,
    }));

    return NextResponse.json({
      success: true,
      sessions: sessionsWithCurrentFlag,
    });
  } catch (error) {
    console.error("Get sessions error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE handler - logout from all devices (clear all sessions for current user)
 */
export async function DELETE(): Promise<NextResponse> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session")?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { success: false, message: "Not authenticated" },
        { status: 401 }
      );
    }

    // Get current user from session
    const currentResult = await query<{ user_id: string }>(
      `SELECT s.user_id
       FROM sessions s
       WHERE s.token = $1 AND s.expires_at > NOW()`,
      [sessionToken]
    );

    const currentSession = currentResult.rows[0];

    if (!currentSession) {
      return NextResponse.json(
        { success: false, message: "Invalid or expired session" },
        { status: 401 }
      );
    }

    // Delete all sessions for this user
    await query("DELETE FROM sessions WHERE user_id = $1", [
      currentSession.user_id,
    ]);

    // Clear current session cookie
    cookieStore.delete("session");

    return NextResponse.json({
      success: true,
      message: "Logged out from all devices",
    });
  } catch (error) {
    console.error("Logout all devices error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
