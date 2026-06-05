/**
 * Sessions API endpoint
 * Returns all active sessions for the current user (Better Auth backed).
 *
 * Uses Better Auth's server API (`auth.api.listSessions` / `revokeSession`)
 * rather than querying the database directly. The response shape is kept
 * identical to the legacy implementation so the settings page consumer
 * (`app/settings/page.tsx`) does not need to change:
 *   { success, sessions: [{ id, created_at, expires_at, is_current }] }
 */
import { NextResponse } from "next/server";
import { headers as nextHeaders } from "next/headers";
import { auth } from "@/lib/auth/better-auth";

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
 * GET handler - get all active sessions for current user.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const requestHeaders = await nextHeaders();

    // Identify the caller and their current session.
    const currentSession = await auth.api.getSession({ headers: requestHeaders });
    if (!currentSession?.user) {
      return NextResponse.json(
        { success: false, error_code: "UNAUTHORIZED", message: "לא מחובר" },
        { status: 401 }
      );
    }

    const currentSessionToken = currentSession.session?.token;

    // List all active sessions for the authenticated user.
    const sessions = await auth.api.listSessions({ headers: requestHeaders });

    const sessionsWithCurrentFlag: Session[] = sessions.map((session) => ({
      id: session.id,
      created_at:
        session.createdAt instanceof Date
          ? session.createdAt.toISOString()
          : String(session.createdAt),
      expires_at:
        session.expiresAt instanceof Date
          ? session.expiresAt.toISOString()
          : String(session.expiresAt),
      is_current: session.token === currentSessionToken,
    }));

    return NextResponse.json({
      success: true,
      sessions: sessionsWithCurrentFlag,
    });
  } catch (error) {
    console.error("Get sessions error:", error);
    return NextResponse.json(
      { success: false, error_code: "SERVER_ERROR", message: "שגיאת שרת" },
      { status: 500 }
    );
  }
}

/**
 * DELETE handler - logout from all other devices.
 *
 * Revokes every active session for the current user except the one making
 * this request, then the caller is redirected client-side. We keep the
 * current session alive so the redirect/response still has a valid identity;
 * the settings page navigates to /login afterwards regardless.
 */
export async function DELETE(): Promise<NextResponse> {
  try {
    const requestHeaders = await nextHeaders();

    const currentSession = await auth.api.getSession({ headers: requestHeaders });
    if (!currentSession?.user) {
      return NextResponse.json(
        { success: false, error_code: "UNAUTHORIZED", message: "לא מחובר" },
        { status: 401 }
      );
    }

    const currentSessionToken = currentSession.session?.token;

    const sessions = await auth.api.listSessions({ headers: requestHeaders });

    // Revoke every session except the current one. Better Auth's
    // `revokeSession` only revokes sessions owned by the caller.
    await Promise.all(
      sessions
        .filter((session) => session.token && session.token !== currentSessionToken)
        .map((session) =>
          auth.api.revokeSession({
            headers: requestHeaders,
            body: { token: session.token },
          })
        )
    );

    return NextResponse.json({
      success: true,
      message: "התנתקת מכל המכשירים האחרים",
    });
  } catch (error) {
    console.error("Logout all devices error:", error);
    return NextResponse.json(
      { success: false, error_code: "SERVER_ERROR", message: "שגיאת שרת" },
      { status: 500 }
    );
  }
}
