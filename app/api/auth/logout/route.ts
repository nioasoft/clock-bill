import { createLogger } from "@/lib/logger";
const logger = createLogger("api:auth:logout");
/**
 * User logout API endpoint (frontend-facing).
 * Thin wrapper over Better Auth sign-out so existing client code that POSTs to
 * /api/auth/logout keeps working unchanged.
 */
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth/better-auth";

export interface LogoutResponse {
  success: boolean;
  message?: string;
}

/**
 * POST handler - logout user
 */
export async function POST(): Promise<NextResponse> {
  try {
    await auth.api.signOut({ headers: await headers() });

    return NextResponse.json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    logger.error("Logout error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
