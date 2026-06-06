/**
 * Better Auth instance — email/password + Google social login.
 *
 * Backed by the Drizzle adapter over the existing Postgres pool. The `role`
 * field is exposed via additionalFields (server-set only). On user creation we
 * seed a `user_profiles` row so the rest of the app can rely on it existing.
 *
 * Required env: BETTER_AUTH_SECRET, BETTER_AUTH_URL.
 * For Google login: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET.
 */
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/src/db";
import * as schema from "@/src/db/schema";
import { query, setUserContext } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import {
  sendEmail,
  emailLayout,
  emailButton,
  isEmailConfigured,
  type EmailLocale,
} from "@/lib/email";

const logger = createLogger("auth");

/**
 * Best-effort recipient locale for transactional emails. Better Auth passes the
 * originating `Request` to its send hooks; we read the locale from (in order):
 *   1. the URL path prefix (`/en/...` → en; Hebrew is prefix-less default),
 *   2. the `NEXT_LOCALE` cookie,
 *   3. the `Accept-Language` header,
 * and fall back to Hebrew. No catalog — the bilingual strings are inline below.
 */
function resolveEmailLocale(request?: Request): EmailLocale {
  if (!request) return "he";
  try {
    // 1. Path prefix — English routes are namespaced under /en.
    const { pathname } = new URL(request.url);
    if (/^\/en(\/|$)/.test(pathname)) return "en";
    if (/^\/he(\/|$)/.test(pathname)) return "he";

    // 2. NEXT_LOCALE cookie (set by next-intl when the user picks a language).
    const cookie = request.headers.get("cookie") ?? "";
    const cookieLocale = cookie.match(/(?:^|;\s*)NEXT_LOCALE=([^;]+)/)?.[1];
    if (cookieLocale === "en") return "en";
    if (cookieLocale === "he") return "he";

    // 3. Accept-Language — first tag wins if it's English.
    const accept = request.headers.get("accept-language") ?? "";
    if (/^\s*en\b/i.test(accept)) return "en";
  } catch {
    // Malformed URL/headers — fall through to the Hebrew default.
  }
  return "he";
}

/**
 * Resolve the recipient locale for a transactional email, preferring the user's
 * stored preference (`user_profiles.locale`) over request heuristics. This makes
 * the language reliable beyond the originating request context — e.g. a password
 * reset triggered without an `/en` path still lands in the user's chosen language.
 *
 * Resilient by design: any lookup failure (or a missing/invalid stored value)
 * falls back to the request-based heuristic. An email must never fail because of
 * this lookup.
 */
async function resolveEmailLocaleForUser(
  userId: string,
  request?: Request
): Promise<EmailLocale> {
  try {
    // Bind the RLS tenant context to the authoritative (trusted) Better Auth
    // user id so the user_profiles row is visible — the reset-password flow has
    // no session/in-frame context, otherwise the RLS policy would hide the row.
    setUserContext(userId);
    const result = await query<{ locale: string | null }>(
      `SELECT locale FROM user_profiles WHERE user_id = $1`,
      [userId]
    );
    const stored = result.rows[0]?.locale;
    if (stored === "en" || stored === "he") return stored;
  } catch (error) {
    logger.error("Failed to read stored email locale; using request heuristic", error);
  }
  return resolveEmailLocale(request);
}

/** Inline bilingual copy for the user-facing auth emails (no i18n catalog). */
const AUTH_EMAILS = {
  resetPassword: {
    he: {
      subject: "איפוס סיסמה — מוניט",
      heading: "איפוס סיסמה",
      intro: "קיבלנו בקשה לאיפוס הסיסמה לחשבון שלך במוניט.",
      cta: "לחץ על הכפתור כדי לבחור סיסמה חדשה. הקישור תקף לזמן מוגבל.",
      button: "אפס סיסמה",
      ignore: "אם לא ביקשת לאפס סיסמה, אפשר להתעלם מהודעה זו — הסיסמה שלך לא תשתנה.",
    },
    en: {
      subject: "Password reset — Monit",
      heading: "Reset your password",
      intro: "We received a request to reset the password for your Monit account.",
      cta: "Click the button below to choose a new password. This link is valid for a limited time.",
      button: "Reset password",
      ignore: "If you didn't request a password reset, you can safely ignore this email — your password won't change.",
    },
  },
  verifyEmail: {
    he: {
      subject: "אימות כתובת אימייל — מוניט",
      heading: "אמת את כתובת האימייל שלך",
      intro: "ברוך הבא למוניט.",
      cta: "כדי להתחיל, אנא אמת את כתובת האימייל שלך בלחיצה על הכפתור.",
      button: "אמת אימייל",
      ignore: "אם לא נרשמת למוניט, אפשר להתעלם מהודעה זו.",
    },
    en: {
      subject: "Verify your email — Monit",
      heading: "Verify your email address",
      intro: "Welcome to Monit.",
      cta: "To get started, please verify your email address by clicking the button below.",
      button: "Verify email",
      ignore: "If you didn't sign up for Monit, you can safely ignore this email.",
    },
  },
} as const;

// Only gate login on verification when email can actually be sent — otherwise
// (local dev / before Resend is configured) signups would be permanently locked
// out with no way to verify. With no key, the reset/verify links are logged.
const emailEnabled = isEmailConfigured();

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const googleEnabled = Boolean(googleClientId && googleClientSecret);

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
      rateLimit: schema.rateLimit,
    },
  }),
  emailAndPassword: {
    enabled: true,
    // Block login until the email is confirmed (verification email sent on
    // signup below). Google sign-ins arrive pre-verified, so this only gates
    // email/password accounts. Disabled when email isn't configured.
    requireEmailVerification: emailEnabled,
    minPasswordLength: 8,
    sendResetPassword: async ({ user, url }, request) => {
      const locale = await resolveEmailLocaleForUser(user.id, request);
      const t = AUTH_EMAILS.resetPassword[locale];
      const sent = await sendEmail({
        to: user.email,
        subject: t.subject,
        html: emailLayout({
          locale,
          heading: t.heading,
          bodyHtml: `
            <p style="margin:0 0 8px;font-size:15px;line-height:1.6;">${t.intro}</p>
            <p style="margin:0;font-size:15px;line-height:1.6;">${t.cta}</p>
            ${emailButton(url, t.button)}
            <p style="margin:0;font-size:13px;color:#71717a;line-height:1.6;">${t.ignore}</p>`,
        }),
      });
      // Dev parity / fallback when email isn't configured: log the link.
      if (!sent) {
        logger.info(`Password reset link for ${user.email}: ${url}`);
      }
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    expiresIn: 3600,
    sendVerificationEmail: async ({ user, url }, request) => {
      const locale = await resolveEmailLocaleForUser(user.id, request);
      const t = AUTH_EMAILS.verifyEmail[locale];
      const sent = await sendEmail({
        to: user.email,
        subject: t.subject,
        html: emailLayout({
          locale,
          heading: t.heading,
          bodyHtml: `
            <p style="margin:0 0 8px;font-size:15px;line-height:1.6;">${t.intro}</p>
            <p style="margin:0;font-size:15px;line-height:1.6;">${t.cta}</p>
            ${emailButton(url, t.button)}
            <p style="margin:0;font-size:13px;color:#71717a;line-height:1.6;">${t.ignore}</p>`,
        }),
      });
      if (!sent) {
        logger.info(`Email verification link for ${user.email}: ${url}`);
      }
    },
  },
  socialProviders: googleEnabled
    ? {
        google: {
          clientId: googleClientId as string,
          clientSecret: googleClientSecret as string,
        },
      }
    : {},
  session: {
    // Cache session data in a signed cookie so getSession() (called by the RLS
    // tenant resolver on each query) is cheap — no DB hit for ~5 minutes.
    cookieCache: { enabled: true, maxAge: 300 },
  },
  // Throttle brute-force attempts. Default applies to all auth endpoints; the
  // custom rules tighten the credential-guessing paths (sign-in / sign-up /
  // password reset). Storage is the DB (rate_limit table) so limits are
  // consistent across all serverless instances, not per-warm-instance.
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 5 },
      "/forget-password": { window: 60, max: 3 },
      "/reset-password": { window: 60, max: 5 },
    },
  },
  user: {
    additionalFields: {
      // Not settable by the client during signup; managed server-side.
      role: { type: "string", required: false, defaultValue: "user", input: false },
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (createdUser) => {
          // Seed a profile row so app code that reads user_profiles can assume
          // it exists. Best-effort: never fail signup because of this.
          try {
            // Bind the tenant context so the INSERT satisfies RLS once enforced.
            setUserContext(createdUser.id);
            await query(
              `INSERT INTO user_profiles (id, user_id, default_currency, preferred_pdf_template, created_at, updated_at)
               VALUES (gen_random_uuid()::text, $1, 'ILS', 'modern', NOW(), NOW())
               ON CONFLICT (user_id) DO NOTHING`,
              [createdUser.id]
            );
          } catch (error) {
            logger.error("Failed to seed user_profile on signup", error);
          }
        },
      },
    },
  },
  // nextCookies must be last so it can set cookies after other plugins run.
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
