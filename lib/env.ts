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
    description: "Secret key for authentication (at least 32 characters)",
    validator: (value) => {
      // Should be at least 32 characters for security
      return value.length >= 32;
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
    description: 'Verified Resend sender, e.g. "Monit <noreply@clock-bill.com>" (optional)',
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
 * Get the database URL
 */
export function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL environment variable is required");
  }
  return url;
}

/**
 * Get the privileged admin database URL for cross-tenant aggregate queries.
 *
 * Returns DATABASE_URL_ADMIN (a BYPASSRLS role, e.g. neondb_owner) when set,
 * otherwise falls back to DATABASE_URL so local dev keeps working. Callers MUST
 * gate usage with getAdminUser(); this connection is not RLS-constrained.
 */
export function getAdminDatabaseUrl(): string {
  return process.env.DATABASE_URL_ADMIN || getDatabaseUrl();
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
