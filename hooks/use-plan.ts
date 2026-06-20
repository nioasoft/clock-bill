"use client";

/**
 * Shared plan query.
 *
 * Fetches `/api/account/plan` once per page and shares the result across
 * all consumers (trial pill, trial card, upgrade modal, etc.) via
 * TanStack Query's cache. Uses the same conventions as `useProfile`.
 */

import { useQuery } from "@tanstack/react-query";
import { usePathname } from "next/navigation";

const PUBLIC_ROUTES = ["/", "/login", "/register", "/forgot-password", "/reset-password"];

export const planQueryKey = ["account-plan"] as const;

export interface PlanTrial {
  active: boolean;
  daysLeft: number | null;
  endsAt: string | null;
}

export interface Plan {
  tier: string;
  status: string | null;
  periodEnd: string | null;
  founding: boolean;
  trial: PlanTrial | null;
}

export interface PlanResponse {
  plan: Plan;
  activeClientCount: number;
}

async function fetchPlan(): Promise<PlanResponse> {
  const res = await fetch("/api/account/plan");
  if (!res.ok) throw new Error("Failed to load plan");
  const data = await res.json();
  if (!data?.success) throw new Error(data?.message ?? "Failed to load plan");
  return { plan: data.plan as Plan, activeClientCount: data.activeClientCount as number };
}

/**
 * Read the current user's subscription plan. Disabled on public/auth routes
 * so it never fires a 401 for logged-out visitors.
 */
export function usePlan() {
  const pathname = usePathname();
  const isPublicRoute = PUBLIC_ROUTES.some((route) =>
    route === "/" ? pathname === "/" : pathname.startsWith(route)
  );
  return useQuery({
    queryKey: planQueryKey,
    queryFn: fetchPlan,
    enabled: !isPublicRoute,
    staleTime: 60_000,
  });
}
