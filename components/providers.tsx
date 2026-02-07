"use client";

import { TimerProvider } from "@/contexts/timer-context";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return <TimerProvider>{children}</TimerProvider>;
}
