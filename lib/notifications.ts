/**
 * Browser notification utilities for timer and daily reminders
 */

/**
 * Check if browser notifications are supported and permitted
 */
export function checkNotificationPermission(): NotificationPermission | null {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return null; // Not supported or SSR
  }
  return Notification.permission;
}

/**
 * Request notification permission from the user
 * @returns Promise resolving to the permission status
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!("Notification" in window)) {
    throw new Error("הדפדפן לא תומך בהתראות");
  }

  if (Notification.permission === "granted") {
    return "granted";
  }

  if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    return permission;
  }

  return "denied";
}

/**
 * Show a browser notification
 * @param title - Notification title
 * @param body - Notification body text
 * @param icon - Optional icon URL
 */
export function showNotification(title: string, body: string, icon?: string): void {
  if (!("Notification" in window)) {
    console.warn("Notifications not supported");
    return;
  }

  if (Notification.permission !== "granted") {
    console.warn("Notification permission not granted");
    return;
  }

  // Use the app logo as default icon (optional)
  const defaultIcon = undefined; // Icon is optional in notifications

  new Notification(title, {
    body,
    icon: icon || defaultIcon,
    badge: icon || defaultIcon,
    dir: "rtl",
    lang: "he",
    tag: `clock-bill-${Date.now()}`, // Unique tag to prevent stacking
    requireInteraction: false,
  });
}

/**
 * Show a long timer notification.
 *
 * Title/body are pre-localized by the React caller (next-intl resolves the ICU
 * `bodyWithHours` / `bodyMinutesOnly` strings), so this util stays hook-free.
 *
 * @param title - Localized notification title
 * @param body - Localized notification body (already formatted with hours/minutes)
 */
export function showLongTimerNotification(title: string, body: string): void {
  showNotification(title, body);
}

/**
 * Show a daily reminder notification.
 *
 * Title/body are pre-localized by the React caller, which picks between the
 * `bodyWithHours` and `bodyNoHours` strings based on hours logged today.
 *
 * @param title - Localized notification title
 * @param body - Localized notification body
 */
export function showDailyReminderNotification(title: string, body: string): void {
  showNotification(title, body);
}

/**
 * Check if we should show a daily reminder based on the last reminder date
 * @param lastReminderDate - Last date reminder was shown
 * @returns true if reminder should be shown
 */
export function shouldShowDailyReminder(lastReminderDate: string | null): boolean {
  if (!lastReminderDate) {
    return true; // Never shown before
  }

  const lastReminder = new Date(lastReminderDate);
  const today = new Date();

  // Reset time part to compare dates only
  lastReminder.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  return today.getTime() > lastReminder.getTime();
}

/**
 * Get the current time in HH:MM format
 * @returns Current time formatted as HH:MM
 */
export function getCurrentTime(): string {
  const now = new Date();
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Check if it's time to show the daily reminder
 * @param reminderTime - The time to show reminder (HH:MM format)
 * @returns true if it's time to show reminder
 */
export function isReminderTime(reminderTime: string): boolean {
  const currentTime = getCurrentTime();
  return currentTime === reminderTime;
}
