/**
 * Date helpers for server-side date-boundary math.
 *
 * The app serves Israeli freelancers and stores entry dates as calendar dates
 * (no time component). Server runtimes (e.g. Vercel) run in UTC, so naive
 * `new Date().toISOString()` would roll "today" over at the wrong moment for
 * users. These helpers anchor all boundaries to the app timezone so "today",
 * "this week", and "this month" match what the user sees on their calendar.
 */

/** App timezone — Israeli users. */
export const APP_TIMEZONE = "Asia/Jerusalem";

const ymdFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Today's calendar date (YYYY-MM-DD) in the app timezone. */
export function appToday(now: Date = new Date()): string {
  return ymdFormatter.format(now);
}

/**
 * Anchor a YYYY-MM-DD string at noon UTC. Working at noon keeps date math
 * (adding/subtracting days, weekday lookup) free of DST/offset edge cases.
 */
function anchor(ymd: string): Date {
  return new Date(`${ymd}T12:00:00Z`);
}

/** Format a noon-anchored Date back to YYYY-MM-DD. */
function toYmd(date: Date): string {
  return date.toISOString().split("T")[0];
}

/** Date boundaries (all YYYY-MM-DD) derived from the app-timezone "today". */
export interface DateBoundaries {
  today: string;
  startOfWeek: string;
  startOfMonth: string;
  endOfMonth: string;
}

/**
 * Compute today/week/month boundaries consistently in the app timezone.
 * Week starts on Sunday (Israeli convention).
 */
export function appDateBoundaries(now: Date = new Date()): DateBoundaries {
  const today = appToday(now);
  const todayAnchor = anchor(today);

  const startOfWeekAnchor = new Date(todayAnchor);
  startOfWeekAnchor.setUTCDate(todayAnchor.getUTCDate() - todayAnchor.getUTCDay());

  const [year, month] = today.split("-").map(Number);
  const startOfMonth = `${year}-${String(month).padStart(2, "0")}-01`;
  // Day 0 of the next month is the last day of this month.
  const endOfMonth = toYmd(new Date(Date.UTC(year, month, 0, 12)));

  return {
    today,
    startOfWeek: toYmd(startOfWeekAnchor),
    startOfMonth,
    endOfMonth,
  };
}

/** Add `days` to a YYYY-MM-DD date, returning a YYYY-MM-DD string. */
export function addDays(ymd: string, days: number): string {
  const d = anchor(ymd);
  d.setUTCDate(d.getUTCDate() + days);
  return toYmd(d);
}
