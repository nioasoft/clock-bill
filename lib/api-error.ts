import type { ErrorCode } from "@/lib/error-codes";

/**
 * Shape of a failed API response. Routes return
 * `{ success: false, error_code, message }`; `error_code` is the stable,
 * locale-independent key, `message` is the legacy Hebrew fallback.
 */
export interface ApiErrorData {
  error_code?: ErrorCode | string;
  message?: string;
}

/**
 * Resolves a user-facing error string from an API error response.
 *
 * Prefers the stable `error_code` (looked up under the `errors` namespace),
 * falling back to the legacy Hebrew `message`, and finally to a generic server
 * error. Pass a ROOT translator that resolves full key paths, e.g.
 * `const t = useTranslations()` — the helper prefixes `errors.` itself.
 *
 * @param data - the parsed API error response
 * @param t - translator resolving full keys (e.g. `errors.UNAUTHORIZED`)
 */
export function messageForError(
  data: ApiErrorData,
  t: (key: string) => string
): string {
  return data.error_code
    ? t(`errors.${data.error_code}`)
    : data.message ?? t("errors.SERVER_ERROR");
}
