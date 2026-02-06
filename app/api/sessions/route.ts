/**
 * Sessions API endpoint
 * Returns all active sessions for the current user
 */
import { NextResponse } from "next/server";
import { getDb } from "../../../lib/db";
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

    const db = getDb();

    // Get current user from session
    const currentSession = db.prepare(
      `SELECT s.user_id, s.id as session_id
       FROM sessions s
       WHERE s.token = ? AND s.expires_at > datetime('now')`
    ).get(sessionToken) as
      | { user_id: string; session_id: string }
      | undefined;

    if (!currentSession) {
      return NextResponse.json(
        { success: false, message: "Invalid or expired session" },
        { status: 401 }
      );
    }

    // Get all active sessions for this user
    const sessions = db.prepare(
      `SELECT id, created_at, expires_at
       FROM sessions
       WHERE user_id = ? AND expires_at > datetime('now')
       ORDER BY created_at DESC`
    ).all(currentSession.user_id) as Array<{
      id: string;
      created_at: string;
      expires_at: string;
    }>;

    // Mark current session
    const sessionsWithCurrentFlag = sessions.map((session) => ({
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
