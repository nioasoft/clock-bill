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
import { polar, checkout, portal, webhooks } from "@polar-sh/better-auth";
import { db } from "@/src/db";
import * as schema from "@/src/db/schema";
import { query, setUserContext } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import {
  getPolar,
  getProductTierMap,
  tierForProductId,
  polarEnabled,
} from "@/lib/polar";
import {
  applyPolarEntitlement,
  revokeEntitlement,
} from "@/lib/entitlements";
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
      subject: "איפוס סיסמה — ClockBill",
      heading: "איפוס סיסמה",
      intro: "קיבלנו בקשה לאיפוס הסיסמה לחשבון שלך ב-ClockBill.",
      cta: "לחץ על הכפתור כדי לבחור סיסמה חדשה. הקישור תקף לזמן מוגבל.",
      button: "אפס סיסמה",
      ignore: "אם לא ביקשת לאפס סיסמה, אפשר להתעלם מהודעה זו — הסיסמה שלך לא תשתנה.",
    },
    en: {
      subject: "Password reset — ClockBill",
      heading: "Reset your password",
      intro: "We received a request to reset the password for your ClockBill account.",
      cta: "Click the button below to choose a new password. This link is valid for a limited time.",
      button: "Reset password",
      ignore: "If you didn't request a password reset, you can safely ignore this email — your password won't change.",
    },
  },
  verifyEmail: {
    he: {
      subject: "אימות כתובת אימייל — ClockBill",
      heading: "אמת את כתובת האימייל שלך",
      intro: "ברוך הבא ל-ClockBill.",
      cta: "כדי להתחיל, אנא אמת את כתובת האימייל שלך בלחיצה על הכפתור.",
      button: "אמת אימייל",
      ignore: "אם לא נרשמת ל-ClockBill, אפשר להתעלם מהודעה זו.",
    },
    en: {
      subject: "Verify your email — ClockBill",
      heading: "Verify your email address",
      intro: "Welcome to ClockBill.",
      cta: "To get started, please verify your email address by clicking the button below.",
      button: "Verify email",
      ignore: "If you didn't sign up for ClockBill, you can safely ignore this email.",
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

/**
 * Map a Polar subscription-shaped payload → our columns and persist.
 *
 * The Polar SDK deserializes webhook payloads to camelCase with rich types
 * (`currentPeriodEnd` is a `Date`), so we normalize to the ISO strings our
 * `EntitlementUpdate` contract expects. `externalId` is the Better Auth user id
 * (Polar customer `external_id`, set via `createCustomerOnSignUp`).
 */
async function syncSubscription(
  externalId: string | null | undefined,
  sub: {
    status?: string | null;
    productId?: string | null;
    currentPeriodEnd?: Date | string | null;
    id?: string | null;
  }
): Promise<void> {
  if (!externalId) {
    logger.error("Polar webhook: subscription without customer.externalId");
    return;
  }
  const tier = tierForProductId(sub.productId, getProductTierMap());
  if (!tier) {
    logger.error("Polar webhook: unknown productId", { productId: sub.productId });
    return;
  }
  const periodEnd =
    sub.currentPeriodEnd instanceof Date
      ? sub.currentPeriodEnd.toISOString()
      : (sub.currentPeriodEnd ?? null);
  await applyPolarEntitlement(externalId, {
    tier,
    status: sub.status ?? null,
    periodEnd,
    polarSubscriptionId: sub.id ?? null,
  });
}

// Polar Better Auth plugin — gated on POLAR_API_KEY (mirrors emailEnabled /
// googleEnabled). The webhooks() sub-plugin requires a secret at construction,
// so it's additionally gated on POLAR_WEBHOOK_SECRET: in dev without a secret
// the app still boots (checkout/portal work; entitlement sync is inert until a
// secret is set). nextCookies() stays last (see plugins array below).
const polarWebhookSecret = process.env.POLAR_WEBHOOK_SECRET;
const polarPlugin = polarEnabled
  ? polar({
      client: getPolar(),
      createCustomerOnSignUp: true,
      use: [
        checkout({
          products: [
            { productId: process.env.POLAR_PRODUCT_STARTER_MONTHLY ?? "", slug: "starter-monthly" },
            { productId: process.env.POLAR_PRODUCT_STARTER_ANNUAL ?? "", slug: "starter-annual" },
            { productId: process.env.POLAR_PRODUCT_UNLIMITED_MONTHLY ?? "", slug: "unlimited-monthly" },
            { productId: process.env.POLAR_PRODUCT_UNLIMITED_ANNUAL ?? "", slug: "unlimited-annual" },
          ],
          successUrl: process.env.POLAR_SUCCESS_URL ?? "/dashboard?checkout=success",
          authenticatedUsersOnly: true,
        }),
        portal(),
        ...(polarWebhookSecret
          ? [
              webhooks({
                secret: polarWebhookSecret,
                onSubscriptionActive: async (payload) => {
                  const sub = payload.data;
                  await syncSubscription(sub.customer?.externalId, sub);
                },
                onSubscriptionUpdated: async (payload) => {
                  const sub = payload.data;
                  await syncSubscription(sub.customer?.externalId, sub);
                },
                onOrderPaid: async (payload) => {
                  const order = payload.data;
                  if (order.subscription) {
                    await syncSubscription(order.customer?.externalId, order.subscription);
                  }
                },
                onSubscriptionRevoked: async (payload) => {
                  const externalId = payload.data.customer?.externalId;
                  if (!externalId) {
                    logger.error("Polar webhook: subscription revoked without customer.externalId");
                    return;
                  }
                  await revokeEntitlement(externalId);
                },
              }),
            ]
          : []),
      ],
    })
  : null;

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
      // Dev parity / fallback when email isn't configured: log the link — but
      // ONLY outside production. In prod a send failure (e.g. transient Resend
      // outage) must never write the live reset token (the URL is the
      // credential) to logs; log identity only.
      if (!sent && process.env.NODE_ENV !== "production") {
        logger.info(`Password reset link for ${user.email}: ${url}`);
      } else if (!sent) {
        logger.warn("Password reset email failed to send", { userId: user.id });
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
      // Only log the verification link outside production (see reset note above).
      if (!sent && process.env.NODE_ENV !== "production") {
        logger.info(`Email verification link for ${user.email}: ${url}`);
      } else if (!sent) {
        logger.warn("Verification email failed to send", { userId: user.id });
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
  account: {
    // Encrypt OAuth access/refresh/id tokens at rest so a DB read can't recover
    // a live Google credential. Applies to new writes; existing rows re-encrypt
    // on next re-auth.
    encryptOAuthTokens: true,
  },
  verification: {
    // Hash verification identifiers (which embed reset/verify tokens) so a DB
    // read can't recover a live token → no DB-read-to-account-takeover path.
    // Better Auth hashes on both write and lookup, so this is internally
    // consistent; in-flight tokens issued before deploy become invalid.
    storeIdentifier: "hashed",
  },
  session: {
    // Explicit session lifetime (don't rely on library defaults): sessions
    // expire after 7 days, with a sliding refresh once per day of activity so
    // an idle stolen token has a bounded window.
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh at most once per day
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
          // Seed a profile row + start the 14-day Unlimited trial. Best-effort:
          // never fail signup because of this.
          try {
            const { buildTrialStart } = await import("@/lib/trial");
            const { startedAt, endsAt } = buildTrialStart(new Date());
            // Bind the tenant context so the INSERT satisfies RLS once enforced.
            setUserContext(createdUser.id);
            await query(
              `INSERT INTO user_profiles
                 (id, user_id, default_currency, preferred_pdf_template, theme,
                  trial_started_at, trial_ends_at, trial_used, created_at, updated_at)
               VALUES (gen_random_uuid()::text, $1, 'ILS', 'modern', 'dark',
                  $2, $3, true, NOW(), NOW())
               ON CONFLICT (user_id) DO NOTHING`,
              [createdUser.id, startedAt.toISOString(), endsAt.toISOString()]
            );
            // Day-0 welcome (best-effort; sendEmail no-ops without RESEND_API_KEY).
            const { trialWelcomeEmail } = await import("@/lib/emails/trial");
            const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.clock-bill.com";
            const { subject, html } = trialWelcomeEmail("he", appUrl);
            if (createdUser.email) {
              await sendEmail({ to: createdUser.email, subject, html });
            }
          } catch (error) {
            logger.error("Failed to seed user_profile / start trial on signup", error);
          }
        },
      },
    },
  },
  // nextCookies must be last so it can set cookies after other plugins run.
  plugins: [...(polarPlugin ? [polarPlugin] : []), nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
