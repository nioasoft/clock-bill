/**
 * Session check API endpoint (frontend-facing).
 * Thin wrapper over Better Auth via getUser() so existing client code that
 * fetches /api/auth/session keeps working unchanged.
 */
import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";

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
    const user = await getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, message: "לא נמצאה הפעלה" },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified ?? false,
        role: user.role ?? "user",
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
