/**
 * Next.js proxy (formerly "middleware" — renamed in Next.js 16).
 *
 * Composes two concerns:
 *  1. next-intl locale routing (`createMiddleware`) — resolves the active
 *     locale from URL/cookie/Accept-Language and rewrites/redirects to the
 *     `[locale]` segment. Hebrew (defaultLocale) stays prefix-less.
 *  2. Authentication gating — optimistic check via Better Auth's session
 *     cookie. Runs AFTER i18n so we reason about the locale-stripped pathname
 *     and keep any `/en` prefix on redirects.
 *
 * Auth state is detected via `getSessionCookie` (not a hardcoded cookie name),
 * so it stays correct across cookie-name/prefix changes. This is an optimistic
 * check — it only verifies a session cookie is present, not that it is valid.
 * Full validation happens server-side via `getUser()` in protected routes.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import createMiddleware from "next-intl/middleware";
import { routing } from "./src/i18n/routing";

const handleI18nRouting = createMiddleware(routing);

// Routes that don't require authentication (locale prefix is stripped before matching)
const publicRoutes = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/offline",
  "/privacy",
  "/terms",
  "/contact",
  "/monitoring",
];

/**
 * Strip a leading locale prefix (`/en`) so route checks reason about the
 * canonical path. Hebrew is prefix-less, so only non-default locales appear.
 */
function stripLocale(pathname: string): { locale: string; rest: string } {
  // Normalize a trailing slash off any path except the root "/", so both the
  // prefix-less (Hebrew) and prefixed (English) branches behave identically.
  const normalize = (path: string): string =>
    path === "/" ? "/" : path.replace(/\/$/, "");

  const segments = pathname.split("/"); // ["", "en", "dashboard"]
  const maybeLocale = segments[1];
  if ((routing.locales as readonly string[]).includes(maybeLocale)) {
    return { locale: maybeLocale, rest: normalize("/" + segments.slice(2).join("/")) };
  }
  return { locale: routing.defaultLocale, rest: normalize(pathname) };
}

export function proxy(request: NextRequest) {
  // Step 1: let next-intl resolve the locale and produce the base response.
  const response = handleI18nRouting(request);

  // Step 2: layer auth gating on top, using the locale-stripped path.
  const { locale, rest } = stripLocale(request.nextUrl.pathname);
  const localePrefix = locale === routing.defaultLocale ? "" : `/${locale}`;

  // Landing page "/" is handled by the page itself (server component checks session).
  if (rest === "/") {
    return response;
  }

  const isPublicRoute = publicRoutes.some((route) => rest.startsWith(route));
  const sessionCookie = getSessionCookie(request);

  // Unauthenticated user hitting a protected route -> redirect to login,
  // preserving the active locale prefix.
  if (!sessionCookie && !isPublicRoute) {
    return NextResponse.redirect(new URL(`${localePrefix}/login`, request.url));
  }

  // NOTE: we intentionally do NOT redirect authenticated users away from public
  // routes here. `getSessionCookie` only confirms a cookie is PRESENT, not valid;
  // doing so caused a redirect loop for stale/expired cookies. The login page does
  // its own valid-session check client-side and redirects to /dashboard.
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api (API routes, including Better Auth)
     * - _next (all Next internals: static, image, and dev HMR endpoints)
     * - _vercel
     * - monitoring (Sentry tunnelRoute)
     * - favicon.ico, sw.js, manifest.webmanifest
     * - any file with an extension (.png, .svg, etc.)
     */
    "/((?!api|_next|_vercel|monitoring|favicon.ico|sw\\.js|manifest\\.webmanifest|.*\\..*).*)",
  ],
};
