"use client";

import { TimerProvider } from "@/contexts/timer-context";
import { ThemeProvider } from "@/components/theme-provider";
import { Direction } from "radix-ui";
import type { ReactNode } from "react";

export function Providers({
  initialTheme,
  dir,
  children,
}: {
  initialTheme: string;
  dir: "rtl" | "ltr";
  children: ReactNode;
}) {
  return (
    // Radix primitives resolve direction from this provider, NOT from the
    // <html dir> attribute — without it, portal-rendered content (Select
    // dropdowns) defaults to LTR even on Hebrew pages.
    <Direction.Provider dir={dir}>
      <ThemeProvider initialTheme={initialTheme}>
        <TimerProvider>{children}</TimerProvider>
      </ThemeProvider>
    </Direction.Provider>
  );
}
