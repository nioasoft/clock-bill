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
import { sendEmail, emailLayout, emailButton, isEmailConfigured } from "@/lib/email";

const logger = createLogger("auth");

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
    sendResetPassword: async ({ user, url }) => {
      const sent = await sendEmail({
        to: user.email,
        subject: "איפוס סיסמה — מוניט",
        html: emailLayout({
          heading: "איפוס סיסמה",
          bodyHtml: `
            <p style="margin:0 0 8px;font-size:15px;line-height:1.6;">קיבלנו בקשה לאיפוס הסיסמה לחשבון שלך במוניט.</p>
            <p style="margin:0;font-size:15px;line-height:1.6;">לחץ על הכפתור כדי לבחור סיסמה חדשה. הקישור תקף לזמן מוגבל.</p>
            ${emailButton(url, "אפס סיסמה")}
            <p style="margin:0;font-size:13px;color:#71717a;line-height:1.6;">אם לא ביקשת לאפס סיסמה, אפשר להתעלם מהודעה זו — הסיסמה שלך לא תשתנה.</p>`,
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
    sendVerificationEmail: async ({ user, url }) => {
      const sent = await sendEmail({
        to: user.email,
        subject: "אימות כתובת אימייל — מוניט",
        html: emailLayout({
          heading: "אמת את כתובת האימייל שלך",
          bodyHtml: `
            <p style="margin:0 0 8px;font-size:15px;line-height:1.6;">ברוך הבא למוניט.</p>
            <p style="margin:0;font-size:15px;line-height:1.6;">כדי להתחיל, אנא אמת את כתובת האימייל שלך בלחיצה על הכפתור.</p>
            ${emailButton(url, "אמת אימייל")}
            <p style="margin:0;font-size:13px;color:#71717a;line-height:1.6;">אם לא נרשמת למוניט, אפשר להתעלם מהודעה זו.</p>`,
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
