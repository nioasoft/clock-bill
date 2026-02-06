/**
 * User logout API endpoint
 * Clears the session cookie and removes session from database
 */
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { cookies } from "next/headers";

export interface LogoutResponse {
  success: boolean;
  message?: string;
}

/**
 * POST handler - logout user
 */
export async function POST(): Promise<NextResponse> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session")?.value;

    if (sessionToken) {
      // Remove session from database
      const db = getDb();
      db.prepare("DELETE FROM sessions WHERE token = ?").run(sessionToken);

      // Clear cookie
      cookieStore.delete("session");
    }

    return NextResponse.json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
