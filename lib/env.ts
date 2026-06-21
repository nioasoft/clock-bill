/**
 * Environment variable validation
 * Validates all required environment variables on startup
 * Throws clear English errors for missing/invalid variables
 */

/**
 * Environment variable schema definition
 */
interface EnvVarSchema {
  name: string;
  required: boolean;
  description: string;
  validator?: (value: string) => boolean;
  defaultValue?: string;
}

/**
 * All environment variables used in the application
 */
const ENV_SCHEMA: EnvVarSchema[] = [
  {
    name: "DATABASE_URL",
    required: true,
    description: "PostgreSQL database connection string",
    validator: (value) => {
      // Should be a valid postgres:// or postgresql:// URL
      return value.startsWith("postgres://") || value.startsWith("postgresql://");
    },
  },
  {
    name: "DATABASE_URL_ADMIN",
    required: false,
    description:
      "Privileged PostgreSQL connection (BYPASSRLS role) for admin-only cross-tenant aggregate queries (optional; falls back to DATABASE_URL)",
    validator: (value) => {
      return value.startsWith("postgres://") || value.startsWith("postgresql://");
    },
  },
  {
    name: "BETTER_AUTH_SECRET",
    required: true,
    description:
      "Secret key for authentication (at least 32 high-entropy characters; not a placeholder)",
    validator: (value) => {
      // At least 32 chars AND not an obvious placeholder / low-entropy value.
      if (value.length < 32) return false;
      const lowered = value.toLowerCase();
      const placeholders = ["your-secret", "changeme", "example", "placeholder", "secret-key-at-least"];
      if (placeholders.some((p) => lowered.includes(p))) return false;
      if (/^(.)\1+$/.test(value)) return false; // all the same character
      return true;
    },
  },
  {
    name: "BETTER_AUTH_URL",
    required: true,
    description: "Base URL for the application (e.g., http://localhost:3000)",
    validator: (value) => {
      // Should be a valid URL
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    },
  },
  {
    name: "NODE_ENV",
    required: false,
    description: "Environment (development, production, test)",
    defaultValue: "development",
    validator: (value) => {
      return ["development", "production", "test"].includes(value);
    },
  },
  // Optional variables (only validated if present)
  {
    name: "GITHUB_CLIENT_ID",
    required: false,
    description: "GitHub OAuth client ID (optional)",
  },
  {
    name: "GITHUB_CLIENT_SECRET",
    required: false,
    description: "GitHub OAuth client secret (optional)",
  },
  {
    name: "GOOGLE_CLIENT_ID",
    required: false,
    description: "Google OAuth client ID (optional)",
  },
  {
    name: "GOOGLE_CLIENT_SECRET",
    required: false,
    description: "Google OAuth client secret (optional)",
  },
  {
    name: "RESEND_API_KEY",
    required: false,
    description: "Resend email service API key (optional)",
  },
  {
    name: "EMAIL_FROM",
    required: false,
    description: 'Verified Resend sender, e.g. "ClockBill <noreply@clock-bill.com>" (optional)',
  },
  {
    name: "R2_BUCKET_NAME",
    required: false,
    description: "Cloudflare R2 bucket name (optional)",
  },
  {
    name: "R2_ACCOUNT_ID",
    required: false,
    description: "Cloudflare R2 account ID (optional)",
  },
  {
    name: "R2_ACCESS_KEY_ID",
    required: false,
    description: "Cloudflare R2 access key ID (optional)",
  },
  {
    name: "R2_SECRET_ACCESS_KEY",
    required: false,
    description: "Cloudflare R2 secret access key (optional)",
  },
  {
    name: "R2_PUBLIC_URL",
    required: false,
    description: "Cloudflare R2 public URL (optional)",
  },
  // Polar billing (all optional — the app boots without Polar configured; the
  // Better Auth plugin only loads when POLAR_API_KEY is set).
  {
    name: "POLAR_API_KEY",
    required: false,
    description: "Polar organization access token (optional; enables billing)",
  },
  {
    name: "POLAR_SERVER",
    required: false,
    description: 'Polar API host: "sandbox" or "production" (optional, default production)',
    validator: (value) => ["sandbox", "production"].includes(value),
  },
  {
    name: "POLAR_WEBHOOK_SECRET",
    required: false,
    description: "Polar webhook signing secret (optional; required for entitlement sync)",
  },
  {
    name: "POLAR_PRODUCT_STARTER_MONTHLY",
    required: false,
    description: "Polar product id for the Starter monthly plan (optional)",
  },
  {
    name: "POLAR_PRODUCT_STARTER_ANNUAL",
    required: false,
    description: "Polar product id for the Starter annual plan (optional)",
  },
  {
    name: "POLAR_PRODUCT_UNLIMITED_MONTHLY",
    required: false,
    description: "Polar product id for the Unlimited monthly plan (optional)",
  },
  {
    name: "POLAR_PRODUCT_UNLIMITED_ANNUAL",
    required: false,
    description: "Polar product id for the Unlimited annual plan (optional)",
  },
  {
    name: "POLAR_SUCCESS_URL",
    required: false,
    description: "Post-checkout redirect URL (optional, default /dashboard?checkout=success)",
  },
  // Web Push (VAPID). All optional — push degrades to a no-op when unset.
  {
    name: "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
    required: false,
    description: "VAPID public key for Web Push (browser-safe; required to enable push)",
  },
  {
    name: "VAPID_PRIVATE_KEY",
    required: false,
    description: "VAPID private key for Web Push (server-only; never expose to the client)",
  },
  {
    name: "VAPID_SUBJECT",
    required: false,
    description: 'VAPID subject contact, e.g. "mailto:support@clock-bill.com" (optional)',
  },
  {
    name: "CRON_SECRET",
    required: false,
    description: "Bearer token Vercel attaches to cron invocations; required to protect /api/cron/* in prod",
  },
  {
    name: "UPSTASH_REDIS_REST_URL",
    required: false,
    description: "Upstash Redis REST URL for durable rate limiting (optional; rate limiting no-ops without it)",
  },
  {
    name: "UPSTASH_REDIS_REST_TOKEN",
    required: false,
    description: "Upstash Redis REST token for durable rate limiting (optional)",
  },
  {
    name: "BLOB_READ_WRITE_TOKEN",
    required: false,
    description: "Vercel Blob storage read-write token (required in production for file uploads)",
    validator: (value) => {
      // Should start with vercel_blob_rw_
      return value.startsWith("vercel_blob_rw_");
    },
  },
];

/**
 * Validation errors collected during validation
 */
interface ValidationError {
  varName: string;
  message: string;
}

/**
 * True when the connection string points at a local/dev database (which won't
 * have TLS), so the production sslmode requirement can safely skip it.
 */
function isLocalDatabaseUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

/**
 * Validate all environment variables
 * Throws an error if validation fails
 */
export function validateEnv(): void {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  for (const schema of ENV_SCHEMA) {
    const value = process.env[schema.name];

    // Check if required variable is missing
    if (schema.required && !value) {
      errors.push({
        varName: schema.name,
        message: `Missing required environment variable: ${schema.name}`,
      });
      continue;
    }

    // Skip validation for optional variables that are not set
    if (!schema.required && !value) {
      continue;
    }

    // Use default value if available
    const actualValue = value || schema.defaultValue;
    if (!actualValue) {
      continue;
    }

    // Run custom validator if provided
    if (schema.validator && !schema.validator(actualValue)) {
      if (schema.required) {
        errors.push({
          varName: schema.name,
          message: `Invalid value for ${schema.name}: ${schema.description}`,
        });
      } else {
        warnings.push({
          varName: schema.name,
          message: `Warning: ${schema.name} has invalid value: ${schema.description}`,
        });
      }
    }
  }

  // Production-only hardening (fail closed). These would break local dev if
  // applied everywhere, so they are gated on NODE_ENV=production.
  if (process.env.NODE_ENV === "production") {
    if (!process.env.CRON_SECRET) {
      errors.push({
        varName: "CRON_SECRET",
        message: "CRON_SECRET is required in production to protect /api/cron/* endpoints",
      });
    }
    const dbUrl = process.env.DATABASE_URL ?? "";
    if (dbUrl && !isLocalDatabaseUrl(dbUrl) && !/[?&]sslmode=(require|verify-ca|verify-full)\b/.test(dbUrl)) {
      errors.push({
        varName: "DATABASE_URL",
        message: "Production DATABASE_URL must enforce TLS (append ?sslmode=verify-full)",
      });
    }
    // Email must be configured in prod, otherwise requireEmailVerification
    // silently falls open and accounts can be created without verification.
    if (!process.env.RESEND_API_KEY) {
      errors.push({
        varName: "RESEND_API_KEY",
        message:
          "RESEND_API_KEY is required in production so email verification is enforced (fail closed)",
      });
    }
  }

  // Log warnings
  for (const warning of warnings) {
    console.warn(`⚠️  ${warning.message}`);
  }

  // If there are errors, throw with detailed message
  if (errors.length > 0) {
    const errorMessage = [
      "",
      "❌ Environment Variable Validation Failed",
      "",
      "Required environment variables are missing or invalid:",
      "",
      ...errors.flatMap((error) => [
        `❌ ${error.varName}`,
        `   ${error.message}`,
        "",
      ]),
      "Please set these environment variables before starting the server.",
      "",
      "You can copy .env.template to .env and fill in the values.",
      "",
    ].join("\n");

    throw new Error(errorMessage);
  }

  // Success message
  console.log("✅ Environment variables validated successfully");
}

/**
 * Get typed environment variable with fallback
 */
export function getEnv(name: string, fallback?: string): string {
  return process.env[name] || fallback || "";
}

/**
 * Get required environment variable or throw
 */
export function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * Check if running in development mode
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === "development";
}

/**
 * Check if running in production mode
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Check if running in test mode
 */
export function isTest(): boolean {
  return process.env.NODE_ENV === "test";
}

/**
 * Get the application base URL
 */
export function getAppUrl(): string {
  return process.env.BETTER_AUTH_URL || "http://localhost:3000";
}

/**
 * pg-connection-string currently treats sslmode=require|verify-ca as aliases for
 * verify-full (full certificate + hostname verification). In pg v9 /
 * pg-connection-string v3 these adopt standard libpq semantics, which are weaker
 * (encrypt, but skip cert verification) — a silent security downgrade on upgrade,
 * and the source of pg's runtime deprecation warning. Pin to verify-full
 * explicitly so behavior stays identical across the upgrade. Local/dev DBs have
 * no TLS, so they are left untouched.
 */
const DEPRECATED_SSL_ALIAS = /([?&]sslmode=)(require|verify-ca)\b/i;

function normalizeDatabaseSsl(url: string): string {
  if (isLocalDatabaseUrl(url)) {
    return url;
  }
  return url.replace(DEPRECATED_SSL_ALIAS, "$1verify-full");
}

/**
 * Get the database URL
 */
export function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL environment variable is required");
  }
  return normalizeDatabaseSsl(url);
}

/**
 * Get the privileged admin database URL for cross-tenant aggregate queries.
 *
 * Returns DATABASE_URL_ADMIN (a BYPASSRLS role, e.g. neondb_owner) when set,
 * otherwise falls back to DATABASE_URL so local dev keeps working. Callers MUST
 * gate usage with getAdminUser(); this connection is not RLS-constrained.
 */
export function getAdminDatabaseUrl(): string {
  const adminUrl = process.env.DATABASE_URL_ADMIN;
  return adminUrl ? normalizeDatabaseSsl(adminUrl) : getDatabaseUrl();
}

/**
 * Get the auth secret
 */
export function getAuthSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET environment variable is required");
  }
  return secret;
}

/**
 * Auto-validate on module import (runs on server startup)
 * Only validate in server context (not during build)
 */
if (typeof window === "undefined" && process.env.NEXT_PHASE !== "phase-production-build") {
  try {
    validateEnv();
  } catch (error) {
    // Re-throw to prevent server from starting
    throw error;
  }
}
