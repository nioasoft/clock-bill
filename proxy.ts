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

/**
 * Geo-based default locale for FIRST-TIME, UNAUTHENTICATED visitors.
 *
 * Runs ONLY when ALL of these hold:
 *  - no `NEXT_LOCALE` cookie (a returning/explicit visitor already chose), AND
 *  - the pathname has NO explicit locale prefix (not `/en…` and not `/he…`).
 *
 * (The matcher already excludes /api, /_next, static assets, etc.)
 *
 * Decision: read Vercel's `x-vercel-ip-country` request header.
 *  - header present AND country !== 'IL'  -> 'en'
 *  - otherwise (incl. no header, e.g. local/dev)         -> 'he'
 *
 * This means the no-geo path falls back to Hebrew = current behavior, unchanged.
 *
 * When 'en': redirect to `/en` + current path (+ query) and stamp the
 * `NEXT_LOCALE=en` cookie on the redirect so it sticks and happens once.
 * When 'he': stamp `NEXT_LOCALE=he` and continue (prefix-less is already Hebrew).
 *
 * Loop-safety: the cookie set here (and explicit /en|/he prefixes, and any
 * existing cookie) all cause this function to be skipped on the next request.
 *
 * Returns a `NextResponse` to short-circuit the proxy, or `null` to continue.
 */
function geoDefaultLocale(request: NextRequest): NextResponse | null {
  // Explicit cookie always wins over geo.
  if (request.cookies.has("NEXT_LOCALE")) {
    return null;
  }

  // Explicit locale prefix (`/en…` or `/he…`) always wins over geo.
  const segments = request.nextUrl.pathname.split("/"); // ["", "en", "dashboard"]
  const maybeLocale = segments[1];
  if ((routing.locales as readonly string[]).includes(maybeLocale)) {
    return null;
  }

  // Vercel geo header (absent locally / in dev -> treated as Israel -> Hebrew).
  const country = request.headers.get("x-vercel-ip-country");
  const desired = country && country !== "IL" ? "en" : "he";

  if (desired === "en") {
    // Redirect prefix-less path to its /en equivalent, preserving query.
    const url = request.nextUrl.clone();
    url.pathname = `/en${request.nextUrl.pathname === "/" ? "" : request.nextUrl.pathname}`;
    const redirect = NextResponse.redirect(url);
    redirect.cookies.set("NEXT_LOCALE", "en", { path: "/" });
    return redirect;
  }

  // desired === "he": continue normally, but stamp the cookie so this runs once.
  // We return null and let the caller set the cookie on the final response.
  return null;
}

export function proxy(request: NextRequest) {
  // Step 0: geo-based default locale for first-time unauthenticated visitors.
  // Returns a redirect (English) to short-circuit; otherwise we continue and
  // (when geo applies and resolves to Hebrew) stamp NEXT_LOCALE=he below.
  const noCookie = !request.cookies.has("NEXT_LOCALE");
  const segs = request.nextUrl.pathname.split("/");
  const hasLocalePrefix = (routing.locales as readonly string[]).includes(segs[1]);
  const geoRedirect = geoDefaultLocale(request);
  if (geoRedirect) {
    return geoRedirect;
  }

  // Step 1: let next-intl resolve the locale and produce the base response.
  const response = handleI18nRouting(request);

  // If geo applied (no cookie, no explicit prefix) and resolved to Hebrew,
  // stamp NEXT_LOCALE=he so the geo pre-step is skipped on subsequent requests.
  if (noCookie && !hasLocalePrefix) {
    response.cookies.set("NEXT_LOCALE", "he", { path: "/" });
  }

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
