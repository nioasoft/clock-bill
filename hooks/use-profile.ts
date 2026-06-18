"use client";

/**
 * Shared user-profile query.
 *
 * `/api/profile` was previously fetched independently by 3–4 components on a
 * single page load (locale sync, onboarding check, notification settings, theme,
 * dashboard config, …). This hook funnels them all through ONE cached query so
 * the endpoint is hit once per page and shared across consumers. Reads stay
 * fresh via TanStack Query's staleTime; writes go through `usePatchProfile`,
 * which updates the same cache entry.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname } from "next/navigation";

const PUBLIC_ROUTES = ["/", "/login", "/register", "/forgot-password", "/reset-password"];

export const profileQueryKey = ["profile"] as const;

/** Normalized profile shape returned by GET /api/profile (camelCase columns). */
export interface Profile {
  id: string;
  userId: string;
  businessName: string | null;
  logoUrl: string | null;
  signatureUrl: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  addressStreet: string | null;
  addressCity: string | null;
  taxId: string | null;
  website: string | null;
  showWebsiteOnDoc: boolean;
  defaultCurrency: string | null;
  preferredPdfTemplate: string | null;
  invoicePrefix: string | null;
  nextInvoiceNumber: number | null;
  paymentTerms: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankBranch: string | null;
  bankSwift: string | null;
  pdfPrimaryColor: string | null;
  pdfAccentColor: string | null;
  longTimerEnabled: boolean | null;
  longTimerThreshold: number | null;
  dailyReminderEnabled: boolean | null;
  dailyReminderTime: string | null;
  lastReminderDate: string | null;
  workingHours: unknown;
  dateFormat: string | null;
  timeFormat: string | null;
  firstDayOfWeek: number | null;
  locale: string;
  theme: string;
  dashboardConfig: unknown;
  profession: string | null;
  defaultRate: number | null;
  defaultBillingRounding: string;
  onboarded: boolean;
  createdAt: string;
  updatedAt: string;
}

async function fetchProfile(): Promise<Profile> {
  const res = await fetch("/api/profile");
  if (!res.ok) throw new Error("Failed to load profile");
  const data = await res.json();
  if (!data?.success || !data.profile) throw new Error(data?.message ?? "Failed to load profile");
  return data.profile as Profile;
}

/**
 * Read the current user's profile. Disabled on public/auth routes so it never
 * fires a 401 for logged-out visitors. All callers share the same cache entry.
 */
export function useProfile() {
  const pathname = usePathname();
  const isPublicRoute = PUBLIC_ROUTES.some((route) =>
    route === "/" ? pathname === "/" : pathname.startsWith(route)
  );
  return useQuery({
    queryKey: profileQueryKey,
    queryFn: fetchProfile,
    enabled: !isPublicRoute,
  });
}

/**
 * PATCH the profile and write the server's normalized result back into the
 * shared cache so every `useProfile` consumer sees the update immediately.
 */
export function usePatchProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Profile>): Promise<Profile> => {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("save failed");
      const data = await res.json();
      if (!data?.success || !data.profile) throw new Error(data?.message ?? "save failed");
      return data.profile as Profile;
    },
    onSuccess: (profile) => {
      queryClient.setQueryData(profileQueryKey, profile);
    },
  });
}
