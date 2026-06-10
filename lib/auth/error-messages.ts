"use client";

/**
 * Localized messages for Better Auth client errors.
 *
 * Better Auth returns its errors with an English `message` and a stable `code`
 * (e.g. USER_ALREADY_EXISTS). Raw English messages must never reach the UI —
 * this hook maps the user-reachable codes to `Auth.serverErrors.*` i18n keys
 * and falls back to the caller's generic (already localized) message for
 * anything unmapped.
 */
import { useTranslations } from "next-intl";

/** Shape of the `error` object returned by authClient calls. */
export interface AuthClientError {
  code?: string;
  message?: string;
  status?: number;
}

/** Better Auth error code → Auth.serverErrors.* key (user-reachable codes only). */
const CODE_TO_KEY: Record<string, string> = {
  USER_ALREADY_EXISTS: "userAlreadyExists",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "userAlreadyExists",
  INVALID_EMAIL_OR_PASSWORD: "invalidCredentials",
  INVALID_PASSWORD: "invalidCredentials",
  EMAIL_NOT_VERIFIED: "emailNotVerified",
  INVALID_EMAIL: "invalidEmail",
  PASSWORD_TOO_SHORT: "passwordTooShort",
  PASSWORD_TOO_LONG: "passwordTooLong",
  INVALID_TOKEN: "invalidToken",
  TOKEN_EXPIRED: "invalidToken",
  USER_NOT_FOUND: "userNotFound",
  USER_EMAIL_NOT_FOUND: "userNotFound",
  CREDENTIAL_ACCOUNT_NOT_FOUND: "socialAccountOnly",
};

/**
 * Resolve a Better Auth client error to a localized, user-readable message.
 * Usage: `const resolveAuthError = useAuthErrorMessage();`
 * then `setError(resolveAuthError(authError, t("register.errors.signUpFailed")))`.
 */
export function useAuthErrorMessage() {
  const t = useTranslations("Auth.serverErrors");
  return (error: AuthClientError | null | undefined, fallback: string): string => {
    if (!error) return fallback;
    // Rate limiter responses carry no Better Auth code — match on HTTP status.
    if (error.status === 429) return t("tooManyRequests");
    const key = error.code ? CODE_TO_KEY[error.code] : undefined;
    return key ? t(key) : fallback;
  };
}
