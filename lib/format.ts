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

/**
 * Format a date string or Date object according to the specified format
 * @param date - Date string or Date object
 * @param dateFormat - The date format to use
 * @param locale - The locale to use (default: "he-IL" for Hebrew)
 * @returns Formatted date string
 */
export function formatDate(
  date: string | Date,
  dateFormat: DateFormat = "DD/MM/YYYY",
  locale: string = "he-IL"
): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;

  if (isNaN(dateObj.getTime())) {
    return "";
  }

  const day = dateObj.getDate();
  const month = dateObj.getMonth() + 1; // Months are 0-indexed
  const year = dateObj.getFullYear();

  // Pad day and month with leading zeros
  const paddedDay = day.toString().padStart(2, "0");
  const paddedMonth = month.toString().padStart(2, "0");

  switch (dateFormat) {
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

/**
 * Format a time string or Date object according to the specified format
 * @param time - Time string or Date object
 * @param timeFormat - The time format to use ("12h" or "24h")
 * @param locale - The locale to use (default: "he-IL" for Hebrew)
 * @returns Formatted time string
 */
export function formatTime(
  time: string | Date,
  timeFormat: TimeFormat = "24h",
  locale: string = "he-IL"
): string {
  const dateObj = typeof time === "string" ? new Date(time) : time;

  if (isNaN(dateObj.getTime())) {
    return "";
  }

  let hours = dateObj.getHours();
  const minutes = dateObj.getMinutes();

  if (timeFormat === "12h") {
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
 * @param locale - The locale to use (default: "he-IL" for Hebrew)
 * @returns Formatted date and time string
 */
export function formatDateTime(
  dateTime: string | Date,
  options: FormatOptions = {},
  locale: string = "he-IL"
): string {
  const { dateFormat = "DD/MM/YYYY", timeFormat = "24h" } = options;

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
 * @param dateFormat - The date format to use
 * @param locale - The locale to use (default: "he-IL" for Hebrew)
 * @returns Formatted date range string
 */
export function formatDateRange(
  startDate: string | Date,
  endDate: string | Date,
  dateFormat: DateFormat = "DD/MM/YYYY",
  locale: string = "he-IL"
): string {
  const formattedStart = formatDate(startDate, dateFormat, locale);
  const formattedEnd = formatDate(endDate, dateFormat, locale);

  return `${formattedStart} - ${formattedEnd}`;
}

/**
 * Format duration in minutes to a human-readable format
 * @param minutes - Duration in minutes
 * @param locale - The locale to use (default: "he-IL" for Hebrew)
 * @returns Formatted duration string
 */
export function formatDuration(minutes: number, locale: string = "he-IL"): string {
  if (minutes < 60) {
    return `${minutes} דק׳`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return `${hours} שע׳`;
  }

  return `${hours} שע׳ ${remainingMinutes} דק׳`;
}

