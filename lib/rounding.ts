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

export type RoundingMode = "none" | "hour_up" | "half_hour_up";

/** All valid modes — handy for Zod enums and exhaustive UI lists. */
export const ROUNDING_MODES: readonly RoundingMode[] = ["none", "hour_up", "half_hour_up"];

/** Hebrew labels for the settings UI. */
export const ROUNDING_LABELS: Record<RoundingMode, string> = {
  none: "ללא עיגול",
  hour_up: "עיגול לשעה מלאה (כלפי מעלה)",
  half_hour_up: "עיגול לחצי שעה (כלפי מעלה)",
};

/** Narrow an arbitrary string to a RoundingMode, falling back to 'none'. */
export function asRoundingMode(value: string | null | undefined): RoundingMode {
  return value === "hour_up" || value === "half_hour_up" ? value : "none";
}

/**
 * Resolve the effective rounding mode for an entry: a project override wins,
 * else the client default, else 'none'. Pass the raw column values (a project
 * NULL/empty means "inherit the client").
 */
export function resolveRounding(
  projectMode: string | null | undefined,
  clientMode: string | null | undefined
): RoundingMode {
  if (projectMode === "hour_up" || projectMode === "half_hour_up" || projectMode === "none") {
    return projectMode;
  }
  return asRoundingMode(clientMode);
}

/**
 * Round a worked-minutes value UP to the billing increment for the given mode.
 * 'none' returns the minutes unchanged. Non-positive durations stay as-is.
 *
 * @param minutes - Raw worked minutes on the entry
 * @param mode - Effective rounding mode for the entry
 */
export function roundBillableMinutes(minutes: number, mode: RoundingMode): number {
  if (!Number.isFinite(minutes) || minutes <= 0) return minutes;
  if (mode === "hour_up") return Math.ceil(minutes / 60) * 60;
  if (mode === "half_hour_up") return Math.ceil(minutes / 30) * 30;
  return minutes;
}
