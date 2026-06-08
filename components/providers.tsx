"use client";

import { TimerProvider } from "@/contexts/timer-context";
import { ThemeProvider } from "@/components/theme-provider";
import type { ReactNode } from "react";

export function Providers({
  initialTheme,
  children,
}: {
  initialTheme: string;
  children: ReactNode;
}) {
  return (
    <ThemeProvider initialTheme={initialTheme}>
      <TimerProvider>{children}</TimerProvider>
    </ThemeProvider>
  );
}
