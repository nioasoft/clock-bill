/**
 * Next.js proxy (formerly "middleware" — renamed in Next.js 16) for
 * authentication gating.
 *
 * Auth state is detected via Better Auth's session cookie using
 * `getSessionCookie` rather than a hardcoded cookie name, so it stays correct
 * across cookie-name/prefix changes (e.g. secure-prefix in production).
 *
 * Note: this is an optimistic check — it only verifies a session cookie is
 * present, not that it is valid. Full validation happens server-side via
 * `getUser()` in the protected routes/pages.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Routes that don't require authentication
const publicRoutes = ["/login", "/register", "/forgot-password", "/reset-password", "/offline", "/privacy", "/terms", "/contact", "/monitoring"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = getSessionCookie(request);

  // Landing page "/" is handled by the page itself (server component checks session)
  if (pathname === "/") {
    return NextResponse.next();
  }

  // Check if the route is public
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

  // If user is not authenticated and trying to access protected routes, redirect to login.
  if (!sessionCookie && !isPublicRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // NOTE: we intentionally do NOT redirect authenticated users away from public
  // routes here. `getSessionCookie` only confirms a cookie is PRESENT, not valid;
  // doing so caused a redirect loop (login -> dashboard -> client-check-fails ->
  // login -> ...) for stale/expired cookies. The login page does its own valid-
  // session check client-side and redirects to /dashboard when truly signed in.
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!api|_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.webmanifest|.*\\.png$|.*\\.svg$).*)",
  ],
};
