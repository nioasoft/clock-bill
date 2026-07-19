/**
 * Money utilities — avoid floating-point drift in financial calculations.
 *
 * All monetary values are handled at 2-decimal (agorot/cents) precision: every
 * value is snapped to whole cents before and after arithmetic, so repeated
 * additions across many time entries don't accumulate binary-float error
 * (e.g. summing 0.1 + 0.2 should be 0.3, not 0.30000000000000004).
 */

/** Convert a money value to integer cents (whole agorot). */
export function toCents(value: number): number {
  if (!Number.isFinite(value)) return 0;
  // The EPSILON nudge guards against representations like 1.005 rounding down.
  return Math.round((value + Number.EPSILON) * 100);
}

/** Convert integer cents back to a money value. */
export function fromCents(cents: number): number {
  return cents / 100;
}

/** Round a monetary value to whole cents (2 decimals). */
export function roundMoney(value: number): number {
  return fromCents(toCents(value));
}

/** Add two money values, returning a clean 2-decimal result. */
export function addMoney(a: number, b: number): number {
  return fromCents(toCents(a) + toCents(b));
}

/** Sum a list of money values precisely via integer-cents accumulation. */
export function sumMoney(values: number[]): number {
  return fromCents(values.reduce((cents, v) => cents + toCents(v), 0));
}

/**
 * Bill an hourly line: minutes worked × hourly rate, rounded to whole cents.
 * Returns 0 when no rate is set.
 *
 * @param durationMinutes - Minutes worked on the entry
 * @param hourlyRate - Client/project hourly rate, or null/undefined when unset
 */
export function calcHourlyAmount(
  durationMinutes: number,
  hourlyRate: number | null | undefined
): number {
  if (!hourlyRate || !Number.isFinite(hourlyRate)) return 0;
  return roundMoney((durationMinutes / 60) * hourlyRate);
}

/**
 * Bill a fixed-price item line: quantity × unit price, rounded to whole cents.
 * Returns 0 when quantity or rate is missing/zero.
 *
 * @param quantity - Number of units billed
 * @param rate - Price per unit, or null/undefined when unset
 */
export function calcItemAmount(
  quantity: number | null | undefined,
  rate: number | null | undefined
): number {
  if (!rate || !Number.isFinite(rate)) return 0;
  if (!quantity || !Number.isFinite(quantity)) return 0;
  return roundMoney(quantity * rate);
}

/**
 * Apply a per-line percent discount to an amount, rounded to whole cents.
 * Null/0/invalid percent is a no-op; percent is clamped to [0, 100].
 *
 * @param amount - Pre-discount line amount
 * @param percent - Discount percentage (0–100), or null/undefined when unset
 */
export function applyPercentDiscount(
  amount: number,
  percent: number | null | undefined
): number {
  if (!percent || !Number.isFinite(percent) || percent <= 0) return roundMoney(amount);
  const p = Math.min(percent, 100);
  return roundMoney(amount * (1 - p / 100));
}
