/**
 * Date and time formatting utilities
 * Formats dates and times according to user preferences
 */

export type DateFormat = "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";
export type TimeFormat = "12h" | "24h";

export interface FormatOptions {
  dateFormat?: DateFormat;
  timeFormat?: TimeFormat;
  locale?: string;
}

/** App locale codes (from next-intl routing) → BCP-47 tags for Intl. */
export type AppLocale = "he" | "en";

/**
 * Resolve an app locale ("he"/"en") or a full BCP-47 tag to a concrete
 * Intl locale. Hebrew renders with he-IL conventions, English with en-US.
 */
function resolveIntlLocale(locale: string): string {
  if (locale === "he" || locale === "he-IL") return "he-IL";
  if (locale === "en" || locale === "en-US") return "en-US";
  // Already a full tag (or unknown) — pass through, falling back to he-IL.
  return locale.includes("-") ? locale : "he-IL";
}

/** Locale-appropriate default date pattern when the user has no preference. */
function defaultDateFormat(locale: string): DateFormat {
  return resolveIntlLocale(locale) === "en-US" ? "MM/DD/YYYY" : "DD/MM/YYYY";
}

/**
 * Format a date string or Date object according to an explicit format.
 *
 * The numeric patterns (DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD) are deterministic
 * and locale-neutral by design so a stored user preference renders identically
 * in both locales. `locale` only selects the default pattern when no explicit
 * `dateFormat` is passed (he → DD/MM/YYYY, en → MM/DD/YYYY).
 *
 * @param date - Date string or Date object
 * @param dateFormat - The date format to use (omit to use the locale default)
 * @param locale - App locale ("he"/"en") or BCP-47 tag (default: "he")
 * @returns Formatted date string
 */
export function formatDate(
  date: string | Date,
  dateFormat?: DateFormat,
  locale: string = "he"
): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;

  if (isNaN(dateObj.getTime())) {
    return "";
  }

  const pattern = dateFormat ?? defaultDateFormat(locale);

  const day = dateObj.getDate();
  const month = dateObj.getMonth() + 1; // Months are 0-indexed
  const year = dateObj.getFullYear();

  // Pad day and month with leading zeros
  const paddedDay = day.toString().padStart(2, "0");
  const paddedMonth = month.toString().padStart(2, "0");

  switch (pattern) {
    case "DD/MM/YYYY":
      return `${paddedDay}/${paddedMonth}/${year}`;
    case "MM/DD/YYYY":
      return `${paddedMonth}/${paddedDay}/${year}`;
    case "YYYY-MM-DD":
      return `${year}-${paddedMonth}-${paddedDay}`;
    default:
      return `${paddedDay}/${paddedMonth}/${year}`;
  }
}

/** Locale-appropriate default time format when the user has no preference. */
function defaultTimeFormat(locale: string): TimeFormat {
  return resolveIntlLocale(locale) === "en-US" ? "12h" : "24h";
}

/**
 * Format a time string or Date object according to an explicit format.
 *
 * 24h/12h output is deterministic so a stored preference renders identically
 * across locales. `locale` only selects the default when `timeFormat` is
 * omitted (he → 24h, en → 12h).
 *
 * @param time - Time string or Date object
 * @param timeFormat - The time format to use (omit to use the locale default)
 * @param locale - App locale ("he"/"en") or BCP-47 tag (default: "he")
 * @returns Formatted time string
 */
export function formatTime(
  time: string | Date,
  timeFormat?: TimeFormat,
  locale: string = "he"
): string {
  const dateObj = typeof time === "string" ? new Date(time) : time;

  if (isNaN(dateObj.getTime())) {
    return "";
  }

  const resolvedFormat = timeFormat ?? defaultTimeFormat(locale);

  let hours = dateObj.getHours();
  const minutes = dateObj.getMinutes();

  if (resolvedFormat === "12h") {
    const period = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12; // Convert 0 to 12 for 12-hour format

    const paddedMinutes = minutes.toString().padStart(2, "0");
    return `${hours}:${paddedMinutes} ${period}`;
  } else {
    // 24-hour format
    const paddedHours = hours.toString().padStart(2, "0");
    const paddedMinutes = minutes.toString().padStart(2, "0");
    return `${paddedHours}:${paddedMinutes}`;
  }
}

/**
 * Format a date and time string or Date object according to the specified formats
 * @param dateTime - Date/time string or Date object
 * @param options - Format options including dateFormat and timeFormat
 * @param locale - App locale ("he"/"en") or BCP-47 tag (default: "he")
 * @returns Formatted date and time string
 */
export function formatDateTime(
  dateTime: string | Date,
  options: FormatOptions = {},
  locale: string = "he"
): string {
  const { dateFormat, timeFormat } = options;

  const dateObj = typeof dateTime === "string" ? new Date(dateTime) : dateTime;

  if (isNaN(dateObj.getTime())) {
    return "";
  }

  const formattedDate = formatDate(dateObj, dateFormat, locale);
  const formattedTime = formatTime(dateObj, timeFormat, locale);

  return `${formattedDate} ${formattedTime}`;
}

/**
 * Format a date range (start and end dates)
 * @param startDate - Start date string or Date object
 * @param endDate - End date string or Date object
 * @param dateFormat - The date format to use (omit to use the locale default)
 * @param locale - App locale ("he"/"en") or BCP-47 tag (default: "he")
 * @returns Formatted date range string
 */
export function formatDateRange(
  startDate: string | Date,
  endDate: string | Date,
  dateFormat?: DateFormat,
  locale: string = "he"
): string {
  const formattedStart = formatDate(startDate, dateFormat, locale);
  const formattedEnd = formatDate(endDate, dateFormat, locale);

  return `${formattedStart} - ${formattedEnd}`;
}

/** Locale-specific compact unit labels for durations. */
const DURATION_UNITS: Record<"he" | "en", { hours: string; minutes: string }> = {
  he: { hours: "שע׳", minutes: "דק׳" },
  en: { hours: "h", minutes: "m" },
};

/**
 * Format a duration in minutes to a compact, locale-appropriate string.
 *
 * he → "2 שע׳ 30 דק׳" (unchanged) · en → "2h 30m". Units stay self-contained
 * here (no message-catalog lookup) so this works in both lib and React code
 * without calling hooks.
 *
 * @param minutes - Duration in minutes
 * @param locale - App locale ("he"/"en") or BCP-47 tag (default: "he")
 * @returns Formatted duration string
 */
export function formatDuration(minutes: number, locale: string = "he"): string {
  const isEn = resolveIntlLocale(locale) === "en-US";
  const units = isEn ? DURATION_UNITS.en : DURATION_UNITS.he;
  // English uses a tight "2h 30m"; Hebrew keeps its native spaced "2 שע׳".
  const sep = isEn ? "" : " ";

  if (minutes < 60) {
    return `${minutes}${sep}${units.minutes}`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return `${hours}${sep}${units.hours}`;
  }

  return `${hours}${sep}${units.hours} ${remainingMinutes}${sep}${units.minutes}`;
}

