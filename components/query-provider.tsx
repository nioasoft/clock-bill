"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

/**
 * Global TanStack Query client. One instance per browser tab (created via
 * useState so it survives re-renders but isn't shared across SSR requests).
 *
 * Defaults tuned for this app: short staleTime keeps user-data fresh while
 * still deduping the burst of identical fetches that fire when a page mounts;
 * window-focus refetch is off because the timer context already re-syncs on
 * focus/visibility and we don't want every cached query to refire on tab-switch.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60, // 1 min — dedupes mount-time bursts, stays fresh
            gcTime: 1000 * 60 * 5, // 5 min
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
