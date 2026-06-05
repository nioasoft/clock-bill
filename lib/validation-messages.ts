/**
 * i18n bridge for the pure validators in `lib/validation.ts`.
 *
 * The validators in `lib/validation.ts` are framework-agnostic and cannot call
 * next-intl hooks, so they return a stable {@link ValidationError} descriptor
 * (`{ code, params }`) instead of a localized string. This module maps that
 * descriptor to a translated message under the `Validation` i18n namespace.
 *
 * Usage (client component):
 *   const tv = useTranslations("Validation");
 *   const message = resolveValidationError(result.code, tv);
 *
 * Or via the convenience hook:
 *   const resolve = useValidationMessage();
 *   const message = resolve(result.code);
 */
"use client";

import { useTranslations } from "next-intl";
import type { ValidationError, ValidationParams } from "@/lib/validation";

/**
 * A next-intl translator scoped to the `Validation` namespace
 * (i.e. the return value of `useTranslations("Validation")`).
 */
export type ValidationTranslator = ReturnType<typeof useTranslations<"Validation">>;

/**
 * Resolve a {@link ValidationError} descriptor to a localized string.
 *
 * - `null`/`undefined` → `undefined` (no error).
 * - `REQUIRED_NAMED` carries a `field` param that is itself a field CODE; it is
 *   first resolved under `Validation.fields.<code>` and then interpolated into
 *   the message, so field names localize too.
 * - All other params are forwarded to next-intl for ICU interpolation.
 *
 * @param error The stable error descriptor returned by a validator, or undefined.
 * @param t     A translator scoped to `Validation` (from `useTranslations("Validation")`).
 * @returns The localized message, or `undefined` when there is no error.
 */
export function resolveValidationError(
  error: ValidationError | undefined | null,
  t: ValidationTranslator
): string | undefined {
  if (!error) return undefined;

  const { code, params } = error;

  if (code === "REQUIRED_NAMED") {
    const fieldCode = params?.field;
    const field =
      typeof fieldCode === "string" && fieldCode.length > 0
        ? t(`fields.${fieldCode}` as Parameters<ValidationTranslator>[0])
        : t("field");
    return t("REQUIRED_NAMED", { field });
  }

  return t(
    code as Parameters<ValidationTranslator>[0],
    params as ValidationParams | undefined
  );
}

/**
 * React hook that returns a memo-free resolver bound to the `Validation`
 * namespace. Call the returned function with a validator's `code` descriptor.
 *
 * @example
 * const resolve = useValidationMessage();
 * if (!res.isValid) errors.name = resolve(res.code);
 */
export function useValidationMessage(): (
  error: ValidationError | undefined | null
) => string | undefined {
  const t = useTranslations("Validation");
  return (error) => resolveValidationError(error, t);
}
