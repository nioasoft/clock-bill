/**
 * Billing time-rounding policy for hourly lines.
 *
 * A pure, IO-free module so it stays unit-testable and can run on client and
 * server alike. Rounding is a *billing* convention applied when computing the
 * billable amount — it NEVER mutates the raw worked duration stored on a time
 * entry. It applies only to hourly lines (items and fixed-monthly are exempt).
 *
 * The effective mode for an entry is resolved as:
 *   project.billingRounding ?? client.billingRounding ?? 'none'
 */

export type RoundingMode =
  | "none"
  | "tenth_hour_up"
  | "quarter_hour_up"
  | "half_hour_up"
  | "hour_up";

/** All valid modes, smallest→largest — handy for Zod enums and UI lists. */
export const ROUNDING_MODES: readonly RoundingMode[] = [
  "none",
  "tenth_hour_up",
  "quarter_hour_up",
  "half_hour_up",
  "hour_up",
];

// Labels live in the message catalogs under the `Rounding` namespace. A mode
// value IS its own message key, so resolve at the call site with
// `useTranslations("Rounding")(mode)`.

/** Return the value as a RoundingMode if it is an explicit mode, else null. */
function explicitMode(value: string | null | undefined): RoundingMode | null {
  return value && (ROUNDING_MODES as readonly string[]).includes(value)
    ? (value as RoundingMode)
    : null;
}

/** Narrow an arbitrary string to a RoundingMode, falling back to 'none'. */
export function asRoundingMode(value: string | null | undefined): RoundingMode {
  return explicitMode(value) ?? "none";
}

/**
 * Resolve the effective rounding mode through the billing cascade:
 * project override wins, else client, else the user-profile base, else 'none'.
 * Any level's NULL/empty/unknown value means "inherit from the next level".
 * Note 'none' IS an explicit override (e.g. a project set to 'none' beats a
 * client 'hour_up').
 */
export function resolveRounding(
  projectMode: string | null | undefined,
  clientMode: string | null | undefined,
  profileMode?: string | null | undefined
): RoundingMode {
  return (
    explicitMode(projectMode) ??
    explicitMode(clientMode) ??
    explicitMode(profileMode) ??
    "none"
  );
}

/**
 * Round a worked-minutes value UP to the billing increment for the given mode.
 * 'none' returns the minutes unchanged. Non-positive durations stay as-is.
 */
export function roundBillableMinutes(minutes: number, mode: RoundingMode): number {
  if (!Number.isFinite(minutes) || minutes <= 0) return minutes;
  if (mode === "hour_up") return Math.ceil(minutes / 60) * 60;
  if (mode === "half_hour_up") return Math.ceil(minutes / 30) * 30;
  if (mode === "quarter_hour_up") return Math.ceil(minutes / 15) * 15;
  if (mode === "tenth_hour_up") return Math.ceil(minutes / 6) * 6;
  return minutes;
}
