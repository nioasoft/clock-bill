"use client";

import { useState, useEffect } from "react";
import type { DateFormat, TimeFormat, FormatOptions } from "@/lib/format";

export interface FormatPreferences {
  dateFormat: DateFormat;
  timeFormat: TimeFormat;
  loading: boolean;
}

/**
 * Hook to fetch and use user's date/time format preferences
 * Returns the user's preferences and loading state
 */
export function useFormatPreferences(): FormatPreferences {
  const [preferences, setPreferences] = useState<FormatPreferences>({
    dateFormat: "DD/MM/YYYY",
    timeFormat: "24h",
    loading: true,
  });

  useEffect(() => {
    async function fetchPreferences() {
      try {
        const response = await fetch("/api/profile");
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.profile) {
            setPreferences({
              dateFormat: data.profile.dateFormat || "DD/MM/YYYY",
              timeFormat: data.profile.timeFormat || "24h",
              loading: false,
            });
          } else {
            setPreferences((prev) => ({ ...prev, loading: false }));
          }
        } else {
          setPreferences((prev) => ({ ...prev, loading: false }));
        }
      } catch (error) {
        console.error("Failed to fetch format preferences:", error);
        setPreferences((prev) => ({ ...prev, loading: false }));
      }
    }

    fetchPreferences();
  }, []);

  return preferences;
}
