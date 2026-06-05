/**
 * React hook for browser notifications
 */

import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  checkNotificationPermission,
  requestNotificationPermission,
  showNotification,
  showLongTimerNotification,
  showDailyReminderNotification,
  shouldShowDailyReminder,
  isReminderTime,
} from "@/lib/notifications";

const PUBLIC_ROUTES = ["/", "/login", "/register", "/forgot-password", "/reset-password"];

export interface NotificationSettings {
  longTimerEnabled: boolean;
  longTimerThreshold: number;
  dailyReminderEnabled: boolean;
  dailyReminderTime: string;
  lastReminderDate: string | null;
}

export function useNotifications() {
  const t = useTranslations("Dashboard.notifications");
  const pathname = usePathname();
  const isPublicRoute = PUBLIC_ROUTES.some((route) =>
    route === "/" ? pathname === "/" : pathname.startsWith(route)
  );
  const [permission, setPermission] = useState<NotificationPermission | null>(() =>
    checkNotificationPermission()
  );
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [longTimerNotified, setLongTimerNotified] = useState(false);

  /**
   * Request notification permission
   */
  const requestPermission = useCallback(async () => {
    try {
      const result = await requestNotificationPermission();
      setPermission(result);
      return result === "granted";
    } catch (error) {
      console.error("Failed to request notification permission:", error);
      return false;
    }
  }, []);

  /**
   * Show a notification
   */
  const notify = useCallback((title: string, body: string) => {
    showNotification(title, body);
  }, []);

  /**
   * Show long timer notification if threshold exceeded
   */
  const checkLongTimer = useCallback((elapsedMinutes: number) => {
    if (!settings || !settings.longTimerEnabled || !permission || permission !== "granted") {
      return;
    }

    if (elapsedMinutes >= settings.longTimerThreshold && !longTimerNotified) {
      // Localize the body here (in the hook) and pass it into the plain util.
      const hours = Math.floor(elapsedMinutes / 60);
      const mins = elapsedMinutes % 60;
      const body =
        hours > 0
          ? t("longTimer.bodyWithHours", { hours, mins })
          : t("longTimer.bodyMinutesOnly", { minutes: elapsedMinutes });
      showLongTimerNotification(t("longTimer.title"), body);
      setLongTimerNotified(true);
    }
  }, [settings, permission, longTimerNotified, t]);

  /**
   * Reset long timer notification flag (when timer stops)
   */
  const resetLongTimerNotification = useCallback(() => {
    setLongTimerNotified(false);
  }, []);

  /**
   * Check and show daily reminder if needed
   */
  const checkDailyReminder = useCallback(async (todayHours: number) => {
    if (!settings || !settings.dailyReminderEnabled || !permission || permission !== "granted") {
      return false;
    }

    if (!shouldShowDailyReminder(settings.lastReminderDate)) {
      return false; // Already shown today
    }

    if (!isReminderTime(settings.dailyReminderTime)) {
      return false; // Not the right time yet
    }

    // Localize the body here (in the hook) and pass it into the plain util.
    const reminderBody =
      todayHours > 0
        ? t("dailyReminder.bodyWithHours", { hours: todayHours.toFixed(1) })
        : t("dailyReminder.bodyNoHours");
    showDailyReminderNotification(t("dailyReminder.title"), reminderBody);

    // Update last reminder date in the database
    try {
      await fetch("/api/profile/reminder-shown", { method: "POST" });
      // Update local state
      setSettings((prev) => {
        if (!prev) return null;
        return { ...prev, lastReminderDate: new Date().toISOString().split('T')[0] };
      });
    } catch (error) {
      console.error("Failed to update reminder date:", error);
    }

    return true; // Notification was shown
  }, [settings, permission, t]);

  /**
   * Update notification settings
   */
  const updateSettings = useCallback((newSettings: Partial<NotificationSettings>) => {
    setSettings((prev) => {
      if (!prev) return null;
      return { ...prev, ...newSettings };
    });
  }, []);

  /**
   * Load notification settings from API
   */
  const loadSettings = useCallback(async () => {
    try {
      const response = await fetch("/api/profile");
      const data = await response.json();

      if (data.success && data.profile) {
        setSettings({
          longTimerEnabled: data.profile.longTimerEnabled ?? true,
          longTimerThreshold: data.profile.longTimerThreshold ?? 120,
          dailyReminderEnabled: data.profile.dailyReminderEnabled ?? false,
          dailyReminderTime: data.profile.dailyReminderTime ?? "09:00",
          lastReminderDate: data.profile.lastReminderDate ?? null,
        });
      }
    } catch (error) {
      console.error("Failed to load notification settings:", error);
    }
  }, []);

  // Load settings on mount (skip on public routes)
  useEffect(() => {
    if (isPublicRoute) return;

    let cancelled = false;

    async function fetchSettings() {
      try {
        const response = await fetch("/api/profile");
        const data = await response.json();

        if (!cancelled && data.success && data.profile) {
          setSettings({
            longTimerEnabled: data.profile.longTimerEnabled ?? true,
            longTimerThreshold: data.profile.longTimerThreshold ?? 120,
            dailyReminderEnabled: data.profile.dailyReminderEnabled ?? false,
            dailyReminderTime: data.profile.dailyReminderTime ?? "09:00",
            lastReminderDate: data.profile.lastReminderDate ?? null,
          });
        }
      } catch (error) {
        console.error("Failed to load notification settings:", error);
      }
    }

    fetchSettings();

    return () => {
      cancelled = true;
    };
  }, [isPublicRoute]);

  return {
    permission,
    settings,
    requestPermission,
    notify,
    checkLongTimer,
    resetLongTimerNotification,
    checkDailyReminder,
    updateSettings,
    loadSettings,
  };
}
