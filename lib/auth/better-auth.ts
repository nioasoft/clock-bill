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
import { query } from "@/lib/db";
import { createLogger } from "@/lib/logger";

const logger = createLogger("auth");

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
    },
  }),
  emailAndPassword: {
    enabled: true,
    // Clean-start migration: don't block login on verification for now.
    requireEmailVerification: false,
    minPasswordLength: 8,
    // No email provider wired yet — log the reset link (dev parity with the
    // previous custom auth). Replace with a real mailer (Resend/SES) in prod.
    sendResetPassword: async ({ user, url }) => {
      logger.info(`Password reset link for ${user.email}: ${url}`);
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
