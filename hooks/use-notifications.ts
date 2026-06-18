/**
 * React hook for browser notifications
 */

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useProfile } from "@/hooks/use-profile";
import {
  checkNotificationPermission,
  requestNotificationPermission,
  showNotification,
  showLongTimerNotification,
  showDailyReminderNotification,
  shouldShowDailyReminder,
  isReminderTime,
} from "@/lib/notifications";

export interface NotificationSettings {
  longTimerEnabled: boolean;
  longTimerThreshold: number;
  dailyReminderEnabled: boolean;
  dailyReminderTime: string;
  lastReminderDate: string | null;
}

export function useNotifications() {
  const t = useTranslations("Dashboard.notifications");
  // Notification settings are derived from the shared profile query — no
  // separate /api/profile fetch (this hook mounts twice per page: once in the
  // timer context and once on the dashboard).
  const { data: profile } = useProfile();
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

  // Map the shared profile into local notification settings whenever it loads
  // or changes. (`updateSettings` and the reminder-shown POST still mutate this
  // local copy for the current session.)
  useEffect(() => {
    if (!profile) return;
    // queueMicrotask keeps setState out of the synchronous effect body
    // (react-hooks/set-state-in-effect).
    queueMicrotask(() =>
      setSettings({
        longTimerEnabled: profile.longTimerEnabled ?? true,
        longTimerThreshold: profile.longTimerThreshold ?? 120,
        dailyReminderEnabled: profile.dailyReminderEnabled ?? false,
        dailyReminderTime: profile.dailyReminderTime ?? "09:00",
        lastReminderDate: profile.lastReminderDate ?? null,
      })
    );
  }, [profile]);

  return {
    permission,
    settings,
    requestPermission,
    notify,
    checkLongTimer,
    resetLongTimerNotification,
    checkDailyReminder,
    updateSettings,
  };
}
