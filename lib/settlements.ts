/**
 * Pure settlement-day math for the reminder feature. All functions take the
 * relevant calendar values (the caller supplies the user-LOCAL "today"), so
 * there is no hidden timezone dependency. "End of month" billing is expressed
 * as storing 31 and clamping to the month's length. See spec
 * 2026-06-21-settlement-reminders.
 */

/** Number of days in a given month (month is 1-12). */
export function daysInMonth(year: number, month1to12: number): number {
  // Day 0 of the next month = last day of this month.
  return new Date(year, month1to12, 0).getDate();
}

/** The billing day clamped to the month's length (so 31 => 28/29/30 as needed). */
export function effectiveBillingDay(billingDay: number, year: number, month1to12: number): number {
  return Math.min(billingDay, daysInMonth(year, month1to12));
}

/** True once the local day-of-month has reached (>=) the effective billing day. */
export function hasReachedBillingDay(
  localDay: number,
  billingDay: number,
  year: number,
  month1to12: number
): boolean {
  return localDay >= effectiveBillingDay(billingDay, year, month1to12);
}

/** True exactly on the effective billing day (used for the once-per-cycle fire). */
export function isBillingDayToday(
  localDay: number,
  billingDay: number,
  year: number,
  month1to12: number
): boolean {
  return localDay === effectiveBillingDay(billingDay, year, month1to12);
}
