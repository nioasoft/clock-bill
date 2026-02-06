/**
 * React hook for browser notifications
 */

import { useState, useEffect, useCallback } from "react";
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
      showLongTimerNotification(elapsedMinutes);
      setLongTimerNotified(true);
    }
  }, [settings, permission, longTimerNotified]);

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

    showDailyReminderNotification(todayHours);

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
  }, [settings, permission]);

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

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

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
